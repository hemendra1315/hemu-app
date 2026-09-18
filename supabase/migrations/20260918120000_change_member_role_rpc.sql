-- Fixes "Role change failed: duplicate key value violates unique constraint
-- academy_members_academy_id_user_id_role_key". The application's Change Role
-- flow did a raw UPDATE ... SET role = ... on the member's existing row, which
-- collides with academy_members_academy_id_user_id_role_key whenever the
-- member already has a prior (left/rejected) row for the target role -
-- unlike every other place in this schema that adds/reactivates a member,
-- which uses ON CONFLICT (academy_id, user_id, role) DO UPDATE
-- (see 0024_super_admin_academy_management.sql,
-- 0036_super_admin_academy_creation_and_owner_invitations.sql).
--
-- academy_member_id is referenced by 20+ tables (attendance, match stats,
-- drill assignments, batch membership, announcements, ...), so this never
-- deletes or merges rows - it only reactivates the stale row and marks the
-- old one 'left', preserving all historical data under its original id.
CREATE OR REPLACE FUNCTION public.change_member_role(p_membership_id uuid, p_new_role text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row academy_members;
  v_existing academy_members;
  v_target_id uuid;
  v_new_role app_role;
BEGIN
  SELECT * INTO v_row FROM academy_members WHERE id = p_membership_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'E_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF NOT is_staff(v_row.academy_id) THEN
    RAISE EXCEPTION 'E_FORBIDDEN' USING errcode = '42501';
  END IF;

  IF p_new_role NOT IN ('player', 'coach', 'parent') THEN
    RAISE EXCEPTION 'E_INVALID_ROLE' USING errcode = '22023';
  END IF;
  v_new_role := p_new_role::app_role;

  IF v_row.role = v_new_role THEN
    RETURN v_row.id;
  END IF;

  SELECT * INTO v_existing
  FROM academy_members
  WHERE academy_id = v_row.academy_id
    AND user_id = v_row.user_id
    AND role = v_new_role;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.status NOT IN ('left', 'rejected') THEN
      RAISE EXCEPTION 'E_ROLE_ALREADY_ASSIGNED' USING errcode = '23505';
    END IF;

    UPDATE academy_members
    SET status = 'active', joined_at = now(), updated_at = now(), left_at = NULL
    WHERE id = v_existing.id;

    UPDATE academy_members
    SET status = 'left', left_at = now(), updated_at = now()
    WHERE id = v_row.id;

    v_target_id := v_existing.id;
  ELSE
    UPDATE academy_members
    SET role = v_new_role, updated_at = now()
    WHERE id = v_row.id;

    v_target_id := v_row.id;
  END IF;

  RETURN v_target_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.change_member_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_member_role(uuid, text) TO authenticated;
