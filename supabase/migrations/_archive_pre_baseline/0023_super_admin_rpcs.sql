-- Migration 0023: Super Admin Control Panel RPCs
-- Provides platform-level analytics and management RPCs for super admins.

-- 1. Function to fetch high-level platform KPI analytics
CREATE OR REPLACE FUNCTION get_platform_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_academies integer;
  v_active_academies integer;
  v_total_users integer;
  v_total_players integer;
  v_total_coaches integer;
  v_total_owners integer;
  v_total_matches integer;
  v_total_sessions integer;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'E_FORBIDDEN: Access restricted to platform super admins'
      USING errcode = '42501';
  END IF;

  SELECT count(*) INTO v_total_academies FROM academies;
  -- Academies with at least 1 active member are counted active
  SELECT count(DISTINCT academy_id) INTO v_active_academies FROM academy_members WHERE status = 'active';
  SELECT count(*) INTO v_total_users FROM profiles;
  SELECT count(*) INTO v_total_players FROM academy_members WHERE role = 'player' AND status = 'active';
  SELECT count(*) INTO v_total_coaches FROM academy_members WHERE role = 'coach' AND status = 'active';
  SELECT count(*) INTO v_total_owners FROM academy_members WHERE role = 'academy_owner' AND status = 'active';
  SELECT count(*) INTO v_total_matches FROM matches;
  SELECT count(*) INTO v_total_sessions FROM training_sessions;

  RETURN jsonb_build_object(
    'totalAcademies', v_total_academies,
    'activeAcademies', v_active_academies,
    'totalUsers', v_total_users,
    'totalPlayers', v_total_players,
    'totalCoaches', v_total_coaches,
    'totalOwners', v_total_owners,
    'totalMatches', v_total_matches,
    'totalSessions', v_total_sessions
  );
END $$;

GRANT EXECUTE ON FUNCTION get_platform_analytics() TO authenticated;

-- 2. Function to list platform academies with member & match statistics
CREATE OR REPLACE FUNCTION get_platform_academies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'E_FORBIDDEN: Access restricted to platform super admins'
      USING errcode = '42501';
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'name', a.name,
          'slug', a.slug,
          'city', a.city,
          'timezone', a.timezone,
          'feeMode', a.fee_mode,
          'createdAt', a.created_at,
          'ownerName', coalesce(p.full_name, p.email),
          'ownerEmail', p.email,
          'playerCount', (SELECT count(*) FROM academy_members m WHERE m.academy_id = a.id AND m.role = 'player' AND m.status = 'active'),
          'coachCount', (SELECT count(*) FROM academy_members m WHERE m.academy_id = a.id AND m.role = 'coach' AND m.status = 'active'),
          'memberCount', (SELECT count(*) FROM academy_members m WHERE m.academy_id = a.id AND m.status = 'active'),
          'batchCount', (SELECT count(*) FROM batches b WHERE b.academy_id = a.id),
          'matchCount', (SELECT count(*) FROM matches mat WHERE mat.academy_id = a.id)
        )
        ORDER BY a.created_at DESC
      )
      FROM academies a
      LEFT JOIN profiles p ON p.id = a.owner_user_id
    ),
    '[]'::jsonb
  );
END $$;

GRANT EXECUTE ON FUNCTION get_platform_academies() TO authenticated;

-- 3. Function to list all registered platform users and their academy memberships
CREATE OR REPLACE FUNCTION get_platform_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'E_FORBIDDEN: Access restricted to platform super admins'
      USING errcode = '42501';
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'fullName', pr.full_name,
          'email', pr.email,
          'isSuperAdmin', pr.is_super_admin,
          'createdAt', pr.created_at,
          'memberships', coalesce(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'academyId', m.academy_id,
                  'academyName', ac.name,
                  'role', m.role,
                  'status', m.status
                )
              )
              FROM academy_members m
              JOIN academies ac ON ac.id = m.academy_id
              WHERE m.user_id = pr.id
            ),
            '[]'::jsonb
          )
        )
        ORDER BY pr.created_at DESC
      )
      FROM profiles pr
    ),
    '[]'::jsonb
  );
END $$;

GRANT EXECUTE ON FUNCTION get_platform_users() TO authenticated;

-- 4. Function to fetch detailed information for a single academy
CREATE OR REPLACE FUNCTION get_platform_academy_details(p_academy_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_academy jsonb;
  v_members jsonb;
  v_batches jsonb;
  v_matches jsonb;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'E_FORBIDDEN: Access restricted to platform super admins'
      USING errcode = '42501';
  END IF;

  SELECT jsonb_build_object(
    'id', a.id,
    'name', a.name,
    'slug', a.slug,
    'city', a.city,
    'timezone', a.timezone,
    'feeMode', a.fee_mode,
    'createdAt', a.created_at,
    'ownerName', coalesce(p.full_name, p.email),
    'ownerEmail', p.email
  ) INTO v_academy
  FROM academies a
  LEFT JOIN profiles p ON p.id = a.owner_user_id
  WHERE a.id = p_academy_id;

  IF v_academy IS NULL THEN
    RAISE EXCEPTION 'E_NOT_FOUND: Academy not found' USING errcode = 'P0002';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'userId', m.user_id,
        'role', m.role,
        'status', m.status,
        'name', coalesce(pr.full_name, pr.email),
        'email', pr.email
      )
    ),
    '[]'::jsonb
  ) INTO v_members
  FROM academy_members m
  JOIN profiles pr ON pr.id = m.user_id
  WHERE m.academy_id = p_academy_id;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'description', b.description
      )
    ),
    '[]'::jsonb
  ) INTO v_batches
  FROM batches b
  WHERE b.academy_id = p_academy_id;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', mat.id,
        'matchName', mat.match_name,
        'matchDate', mat.match_date,
        'opponentName', mat.opponent_name,
        'result', mat.result,
        'teamScore', mat.team_score
      )
    ),
    '[]'::jsonb
  ) INTO v_matches
  FROM matches mat
  WHERE mat.academy_id = p_academy_id;

  RETURN jsonb_build_object(
    'academy', v_academy,
    'members', v_members,
    'batches', v_batches,
    'matches', v_matches
  );
END $$;

GRANT EXECUTE ON FUNCTION get_platform_academy_details(uuid) TO authenticated;
