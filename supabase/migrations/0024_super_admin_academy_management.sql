-- Migration 0024: Super Admin Academy Creation & Deletion RPCs
-- Provides secure platform-level functions for super admins to create and delete academies.

-- 1. Secure RPC to create an academy on behalf of a selected owner user
CREATE OR REPLACE FUNCTION create_platform_academy(
  p_name text,
  p_owner_user_id uuid,
  p_city text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_timezone text DEFAULT 'Asia/Kolkata',
  p_fee_mode fee_mode DEFAULT 'player_pays'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug     text;
  v_suffix   integer := 0;
  v_academy  academies;
  v_code     text;
BEGIN
  -- 1. Super Admin authorization check
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'E_FORBIDDEN: Access restricted to platform super admins'
      USING errcode = '42501';
  END IF;

  -- 2. Validate input name
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'E_VALIDATION: Academy name must not be empty'
      USING errcode = '22023';
  END IF;

  -- 3. Verify owner profile exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_owner_user_id) THEN
    RAISE EXCEPTION 'E_NOT_FOUND: Selected owner profile does not exist'
      USING errcode = 'P0002';
  END IF;

  -- 4. Generate unique platform slug
  v_slug := slugify(p_name);
  IF v_slug = '' THEN
    RAISE EXCEPTION 'E_VALIDATION: Academy name must contain letters or digits'
      USING errcode = '22023';
  END IF;

  WHILE EXISTS (SELECT 1 FROM academies a WHERE a.slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := slugify(p_name) || '-' || v_suffix;
  END LOOP;

  -- 5. Insert academy record
  INSERT INTO academies (
    name, slug, city, contact_email, contact_phone, timezone, fee_mode, owner_user_id
  ) VALUES (
    btrim(p_name),
    v_slug,
    nullif(btrim(coalesce(p_city, '')), ''),
    nullif(btrim(coalesce(p_contact_email, '')), ''),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    p_timezone,
    p_fee_mode,
    p_owner_user_id
  ) RETURNING * INTO v_academy;

  -- 6. Insert owner academy membership
  INSERT INTO academy_members (academy_id, user_id, role, status, joined_at)
  VALUES (v_academy.id, p_owner_user_id, 'academy_owner', 'active', now())
  ON CONFLICT (academy_id, user_id, role) DO UPDATE SET status = 'active', updated_at = now();

  -- 7. Generate default active join code for players
  LOOP
    v_code := generate_join_code(6);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM academy_join_codes c WHERE c.code = v_code AND c.is_active
    );
  END LOOP;

  INSERT INTO academy_join_codes (academy_id, code, role, created_by)
  VALUES (v_academy.id, v_code, 'player', p_owner_user_id);

  RETURN jsonb_build_object(
    'id', v_academy.id,
    'name', v_academy.name,
    'slug', v_academy.slug,
    'city', v_academy.city,
    'ownerUserId', v_academy.owner_user_id,
    'createdAt', v_academy.created_at
  );
END $$;

GRANT EXECUTE ON FUNCTION create_platform_academy(text, uuid, text, text, text, text, fee_mode) TO authenticated;

-- 2. Secure RPC to safely delete an academy and purge dependent tenant records
CREATE OR REPLACE FUNCTION delete_platform_academy(p_academy_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Super Admin authorization check
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'E_FORBIDDEN: Access restricted to platform super admins'
      USING errcode = '42501';
  END IF;

  -- 2. Verify academy exists
  IF NOT EXISTS (SELECT 1 FROM academies WHERE id = p_academy_id) THEN
    RAISE EXCEPTION 'E_NOT_FOUND: Academy does not exist'
      USING errcode = 'P0002';
  END IF;

  -- 3. Safely delete dependent records in proper foreign-key order
  DELETE FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM match_batting WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM match_bowling WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM match_fielding WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM match_partnerships WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM match_awards WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM match_coach_notes WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM matches WHERE academy_id = p_academy_id;

  DELETE FROM attendance WHERE session_id IN (SELECT id FROM training_sessions WHERE academy_id = p_academy_id);
  DELETE FROM training_sessions WHERE academy_id = p_academy_id;

  DELETE FROM batch_members WHERE batch_id IN (SELECT id FROM batches WHERE academy_id = p_academy_id);
  DELETE FROM batches WHERE academy_id = p_academy_id;

  DELETE FROM player_statistics WHERE academy_id = p_academy_id;
  DELETE FROM player_milestones WHERE academy_id = p_academy_id;
  DELETE FROM academy_records WHERE academy_id = p_academy_id;
  DELETE FROM cricheroes_player_mappings WHERE academy_id = p_academy_id;
  DELETE FROM drill_assignments WHERE academy_id = p_academy_id;
  DELETE FROM drills WHERE academy_id = p_academy_id;
  DELETE FROM activity_log WHERE academy_id = p_academy_id;
  DELETE FROM academy_join_codes WHERE academy_id = p_academy_id;
  DELETE FROM join_requests WHERE academy_id = p_academy_id;
  DELETE FROM academy_members WHERE academy_id = p_academy_id;

  -- 4. Delete academy record
  DELETE FROM academies WHERE id = p_academy_id;
END $$;

GRANT EXECUTE ON FUNCTION delete_platform_academy(uuid) TO authenticated;
