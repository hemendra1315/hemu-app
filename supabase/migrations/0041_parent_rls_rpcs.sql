-- ============================================================================
-- Phase 3 — Parent Accounts RLS & RPCs
-- ============================================================================

ALTER TABLE parent_player_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY parent_player_links_select ON parent_player_links FOR SELECT USING (
    parent_user_id = auth.uid() OR is_staff(academy_id) OR player_user_id = auth.uid()
);

CREATE POLICY parent_player_links_insert ON parent_player_links FOR INSERT WITH CHECK (
    is_staff(academy_id)
);

CREATE POLICY parent_player_links_update ON parent_player_links FOR UPDATE USING (
    is_staff(academy_id) OR player_user_id = auth.uid()
) WITH CHECK (
    is_staff(academy_id) OR player_user_id = auth.uid()
);

ALTER TABLE parent_linking_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY parent_linking_codes_select ON parent_linking_codes FOR SELECT USING (
    is_staff(academy_id) OR player_user_id = auth.uid()
);

CREATE POLICY parent_linking_codes_insert ON parent_linking_codes FOR INSERT WITH CHECK (
    is_staff(academy_id) OR player_user_id = auth.uid()
);

CREATE POLICY parent_linking_codes_update ON parent_linking_codes FOR UPDATE USING (
    is_staff(academy_id) OR player_user_id = auth.uid()
) WITH CHECK (
    is_staff(academy_id) OR player_user_id = auth.uid()
);

-- Update is_member to include parent
CREATE OR REPLACE FUNCTION is_member(p_academy uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT has_role(p_academy, ARRAY['academy_owner', 'coach', 'player', 'parent']::app_role[]);
$$;

-- Returns user_ids of players linked to the current user (as a parent) in a specific academy
CREATE OR REPLACE FUNCTION my_linked_players(p_academy uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT player_user_id
  FROM parent_player_links
  WHERE academy_id = p_academy
    AND parent_user_id = auth.uid()
    AND status = 'active';
$$;

-- Returns academy_members.id of players linked to the current user
CREATE OR REPLACE FUNCTION my_linked_member_ids(p_academy uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT am.id
  FROM parent_player_links ppl
  JOIN academy_members am ON am.user_id = ppl.player_user_id AND am.academy_id = p_academy
  WHERE ppl.academy_id = p_academy
    AND ppl.parent_user_id = auth.uid()
    AND ppl.status = 'active';
$$;

GRANT EXECUTE ON FUNCTION my_linked_players, my_linked_member_ids TO authenticated;

-- Academy Members: Parents can see members they are linked to.
CREATE POLICY academy_members_select_parents ON academy_members FOR SELECT USING (
  user_id IN (SELECT my_linked_players(academy_id))
);

-- Profiles: Parents can see profiles of players they are linked to.
CREATE POLICY profiles_select_parents ON profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM parent_player_links ppl
    WHERE ppl.parent_user_id = auth.uid()
      AND ppl.player_user_id = profiles.id
      AND ppl.status = 'active'
  )
);

-- Batches: Parents can see batches their linked children are in
CREATE POLICY batches_select_parents ON batches FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM batch_members bm
    WHERE bm.batch_id = batches.id
      AND bm.academy_member_id IN (SELECT my_linked_member_ids(batches.academy_id))
  )
);

-- Batch Members: Parents can see batch_members for their children's batches
CREATE POLICY batch_members_select_parents ON batch_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM batches b
    WHERE b.id = batch_members.batch_id
      AND EXISTS (
        SELECT 1 FROM batch_members my_bm
        WHERE my_bm.batch_id = b.id
          AND my_bm.academy_member_id IN (SELECT my_linked_member_ids(b.academy_id))
      )
  )
);

-- Attendance: Parents can see attendance for their linked children
CREATE POLICY attendance_select_parents ON attendance FOR SELECT USING (
  player_id IN (SELECT my_linked_member_ids(academy_id))
);


-- 8. RPC for generating linking code
CREATE OR REPLACE FUNCTION generate_parent_linking_code(
  p_academy_id uuid,
  p_player_user_id uuid,
  p_relationship_type text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_code text;
BEGIN
  IF NOT (is_staff(p_academy_id) OR auth.uid() = p_player_user_id) THEN
    RAISE EXCEPTION 'E_FORBIDDEN' USING errcode = '42501';
  END IF;

  IF p_relationship_type NOT IN ('father', 'mother', 'guardian', 'other') THEN
    RAISE EXCEPTION 'E_INVALID_RELATIONSHIP' USING errcode = '22023';
  END IF;

  UPDATE parent_linking_codes 
  SET is_active = FALSE 
  WHERE academy_id = p_academy_id 
    AND player_user_id = p_player_user_id 
    AND relationship_type = p_relationship_type
    AND is_active = TRUE;

  v_code := upper(substring(replace(replace(replace(encode(gen_random_bytes(6), 'base64'), '/', 'A'), '+', 'B'), '=', 'C'), 1, 8));

  INSERT INTO parent_linking_codes (
    academy_id, player_user_id, code, relationship_type, expires_at, created_by
  ) VALUES (
    p_academy_id, p_player_user_id, v_code, p_relationship_type, now() + interval '7 days', auth.uid()
  );

  RETURN v_code;
END $$;

GRANT EXECUTE ON FUNCTION generate_parent_linking_code TO authenticated;


-- 9. RPC for redeeming linking code
CREATE OR REPLACE FUNCTION redeem_parent_linking_code(
  p_code text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code_record parent_linking_codes;
  v_academy_member_id uuid;
BEGIN
  SELECT * INTO v_code_record
  FROM parent_linking_codes
  WHERE code = upper(p_code)
    AND is_active = TRUE
    AND expires_at > now()
  FOR UPDATE;

  IF v_code_record.id IS NULL THEN
    RAISE EXCEPTION 'E_INVALID_CODE' USING errcode = 'P0002';
  END IF;

  UPDATE parent_linking_codes SET is_active = FALSE WHERE id = v_code_record.id;

  IF NOT EXISTS (
    SELECT 1 FROM academy_members 
    WHERE academy_id = v_code_record.academy_id 
      AND user_id = auth.uid()
      AND role = 'parent'
  ) THEN
    INSERT INTO academy_members (academy_id, user_id, role, status, joined_at)
    VALUES (v_code_record.academy_id, auth.uid(), 'parent', 'active', now());
  END IF;

  INSERT INTO parent_player_links (
    parent_user_id, player_user_id, academy_id, relationship_type, status
  ) VALUES (
    auth.uid(), v_code_record.player_user_id, v_code_record.academy_id, v_code_record.relationship_type, 'active'
  ) ON CONFLICT (parent_user_id, player_user_id, academy_id) 
  DO UPDATE SET status = 'active', relationship_type = EXCLUDED.relationship_type;

  RETURN v_code_record.academy_id;
END $$;

GRANT EXECUTE ON FUNCTION redeem_parent_linking_code TO authenticated;
