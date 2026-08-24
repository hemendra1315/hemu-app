-- ============================================================================
-- 0033_overs_check_and_join_approval_batch_assign.sql
-- 1. Normalizes legacy mock data and adds CHECK constraint on match_bowling.overs
-- 2. Completes approve_join_request RPC to assign approved member to p_batch_ids
-- ============================================================================

-- 1. Sanitize any legacy mock rows where fractional ball count was >= 6
UPDATE match_bowling
SET overs = floor(overs) + (CASE
  WHEN round((overs - floor(overs)) * 10) >= 6 THEN 5.0 / 10.0
  ELSE (overs - floor(overs))
END)
WHERE NOT (overs >= 0 AND overs::text ~ '^\d+(\.[0-5])?$');

-- Add base-6 cricket overs notation constraint
ALTER TABLE match_bowling
  DROP CONSTRAINT IF EXISTS match_bowling_overs_cricket_notation_check;

ALTER TABLE match_bowling
  ADD CONSTRAINT match_bowling_overs_cricket_notation_check
  CHECK (overs >= 0 AND overs::text ~ '^\d+(\.[0-5])?$');

-- 2. Complete approve_join_request with batch member insertion
CREATE OR REPLACE FUNCTION approve_join_request(
  p_request_id uuid,
  p_batch_ids uuid[] DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_request join_requests;
  v_new_member_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'E_UNAUTHENTICATED' USING errcode = '28000';
  END IF;

  SELECT * INTO v_request
  FROM join_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'E_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF NOT is_owner(v_request.academy_id) THEN
    RAISE EXCEPTION 'E_FORBIDDEN' USING errcode = '42501';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'E_INVALID_REQUEST' USING errcode = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM academy_members m
    WHERE m.academy_id = v_request.academy_id
      AND m.user_id = v_request.user_id
      AND m.status IN ('active', 'pending')
  ) THEN
    RAISE EXCEPTION 'E_ALREADY_MEMBER' USING errcode = '23505';
  END IF;

  INSERT INTO academy_members (academy_id, user_id, role, status, joined_at)
  VALUES (v_request.academy_id, v_request.user_id, v_request.requested_role, 'active', now())
  RETURNING id INTO v_new_member_id;

  IF p_batch_ids IS NOT NULL AND array_length(p_batch_ids, 1) > 0 THEN
    INSERT INTO batch_members (batch_id, academy_member_id)
    SELECT b_id, v_new_member_id
    FROM unnest(p_batch_ids) AS b_id
    WHERE EXISTS (
      SELECT 1 FROM batches b WHERE b.id = b_id AND b.academy_id = v_request.academy_id
    );
  END IF;

  UPDATE join_requests
  SET status = 'approved', reviewed_by = v_user, reviewed_at = now()
  WHERE id = p_request_id;
END $$;

REVOKE ALL ON FUNCTION approve_join_request(uuid, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION approve_join_request(uuid, uuid[]) TO authenticated;
