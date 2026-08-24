-- Migration 0027: Fix super_admin_seed_academy_demo_data NOT NULL violation on attendance.academy_id
--
-- Background: 0025 deployed `super_admin_seed_academy_demo_data`, but its attendance INSERTs
-- omitted the `academy_id` column. The live `attendance.academy_id` is NOT NULL, so seeding
-- failed with:
--   ERROR: 23502: null value in column "academy_id" of relation "attendance" violates not-null
--   (PL/pgSQL function super_admin_seed_academy_demo_data)
-- The seed is atomic, so nothing was persisted. 0025 is already applied, so this is a
-- forward `CREATE OR REPLACE FUNCTION` of the SAME function (grants preserved).
-- Behaviour-preserving fix: only the two attendance INSERTs are patched to supply p_academy_id.

GRANT USAGE ON SCHEMA public TO authenticated;

CREATE OR REPLACE FUNCTION super_admin_seed_academy_demo_data(p_academy_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_academy_name text;
  v_owner_user_id uuid;

  v_coach1_user uuid; v_coach1_mem uuid;
  v_coach2_user uuid; v_coach2_mem uuid;
  v_coach3_user uuid; v_coach3_mem uuid;

  v_batch1_id uuid;
  v_batch2_id uuid;
  v_batch3_id uuid;

  v_player_mems uuid[] := '{}';

  v_sess1_id uuid;
  v_sess2_id uuid;
  v_sess3_id uuid;
  v_sess4_id uuid;

  v_match1_id uuid;
  v_match2_id uuid;

  i integer;
  v_pname text;
  v_pemail text;
  v_puser uuid;
  v_pmem uuid;
BEGIN
  -- Super Admin authorization check
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'E_FORBIDDEN: Access restricted to platform super admins'
      USING errcode = '42501';
  END IF;

  -- Verify target academy exists
  SELECT name, owner_user_id INTO v_academy_name, v_owner_user_id
  FROM academies WHERE id = p_academy_id;

  IF v_academy_name IS NULL THEN
    RAISE EXCEPTION 'E_NOT_FOUND: Target academy does not exist'
      USING errcode = 'P0002';
  END IF;

  -- Duplicate seed protection
  IF EXISTS (
    SELECT 1 FROM academy_members
    WHERE academy_id = p_academy_id AND notes = 'demo_seed'
  ) THEN
    RAISE EXCEPTION 'E_DUPLICATE: Demo data already exists for this academy'
      USING errcode = '23505';
  END IF;

  -- Create 3 Coaches
  v_coach1_user := super_admin_get_or_create_user('coach.vikram@' || slugify(v_academy_name) || '.demo', 'Vikram Rathour', '+919876543210');
  INSERT INTO academy_members (academy_id, user_id, role, status, joined_at, notes)
  VALUES (p_academy_id, v_coach1_user, 'coach', 'active', now() - interval '90 days', 'demo_seed')
  RETURNING id INTO v_coach1_mem;

  v_coach2_user := super_admin_get_or_create_user('coach.bharat@' || slugify(v_academy_name) || '.demo', 'Bharat Arun', '+919876543211');
  INSERT INTO academy_members (academy_id, user_id, role, status, joined_at, notes)
  VALUES (p_academy_id, v_coach2_user, 'coach', 'active', now() - interval '60 days', 'demo_seed')
  RETURNING id INTO v_coach2_mem;

  v_coach3_user := super_admin_get_or_create_user('coach.rsridhar@' || slugify(v_academy_name) || '.demo', 'R Sridhar', '+919876543212');
  INSERT INTO academy_members (academy_id, user_id, role, status, joined_at, notes)
  VALUES (p_academy_id, v_coach3_user, 'coach', 'active', now() - interval '30 days', 'demo_seed')
  RETURNING id INTO v_coach3_mem;

  -- Create 3 Batches
  INSERT INTO batches (academy_id, name, age_group, description, coach_id, training_days, training_time)
  VALUES (p_academy_id, 'U14 Junior Stars', 'U14', 'Development squad focusing on fundamentals and technique.', v_coach1_mem, ARRAY['Mon', 'Wed', 'Fri'], '06:30 - 08:30')
  RETURNING id INTO v_batch1_id;

  INSERT INTO batches (academy_id, name, age_group, description, coach_id, training_days, training_time)
  VALUES (p_academy_id, 'U16 Advanced Squad', 'U16', 'Competitive match-play and advanced tactical drills.', v_coach2_mem, ARRAY['Tue', 'Thu', 'Sat'], '16:00 - 18:30')
  RETURNING id INTO v_batch2_id;

  INSERT INTO batches (academy_id, name, age_group, description, coach_id, training_days, training_time)
  VALUES (p_academy_id, 'Senior Elite XI', 'Senior', 'High performance squad for league & tournament cricket.', v_coach3_mem, ARRAY['Wed', 'Sat', 'Sun'], '07:00 - 10:00')
    RETURNING id INTO v_batch3_id;

  -- Create 18 Players
  FOR i IN 1..18 LOOP
    CASE i
      WHEN 1 THEN v_pname := 'Aarav Sharma';
      WHEN 2 THEN v_pname := 'Rohan Verma';
      WHEN 3 THEN v_pname := 'Kabir Mehta';
      WHEN 4 THEN v_pname := 'Dhruv Patel';
      WHEN 5 THEN v_pname := 'Yash Nambiar';
      WHEN 6 THEN v_pname := 'Ishaan Kishan';
      WHEN 7 THEN v_pname := 'Devdutt Padikkal';
      WHEN 8 THEN v_pname := 'Prithvi Shaw';
      WHEN 9 THEN v_pname := 'Riyan Parag';
      WHEN 10 THEN v_pname := 'Umran Malik';
      WHEN 11 THEN v_pname := 'Arshdeep Singh';
      WHEN 12 THEN v_pname := 'Kuldeep Yadav';
      WHEN 13 THEN v_pname := 'Ravi Bishnoi';
      WHEN 14 THEN v_pname := 'Varun Chakravarthy';
      WHEN 15 THEN v_pname := 'Tilak Varma';
      WHEN 16 THEN v_pname := 'Sai Sudharsan';
      WHEN 17 THEN v_pname := 'Abhishek Sharma';
      WHEN 18 THEN v_pname := 'Harshit Rana';
    END CASE;

    v_pemail := lower(replace(v_pname, ' ', '.')) || '.' || i || '@' || slugify(v_academy_name) || '.demo';
    v_puser := super_admin_get_or_create_user(v_pemail, v_pname, '+9199000' || lpad(i::text, 5, '0'));

    INSERT INTO academy_members (academy_id, user_id, role, status, joined_at, notes)
    VALUES (p_academy_id, v_puser, 'player', 'active', now() - (i || ' days')::interval, 'demo_seed')
    RETURNING id INTO v_pmem;

    v_player_mems := array_append(v_player_mems, v_pmem);

    IF i <= 6 THEN
      INSERT INTO batch_members (batch_id, academy_member_id, joined_at) VALUES (v_batch1_id, v_pmem, now());
    ELSIF i <= 12 THEN
      INSERT INTO batch_members (batch_id, academy_member_id, joined_at) VALUES (v_batch2_id, v_pmem, now());
    ELSE
      INSERT INTO batch_members (batch_id, academy_member_id, joined_at) VALUES (v_batch3_id, v_pmem, now());
    END IF;
    END LOOP;

  -- Create 4 Training Sessions
  INSERT INTO training_sessions (academy_id, batch_id, coach_id, title, session_date, start_at, end_at, status)
  VALUES (
    p_academy_id, v_batch2_id, v_coach2_mem, 'Advanced Net Practice & Range Hitting',
    (current_date - interval '5 days')::date,
    ((current_date - interval '5 days')::date + time '16:00')::timestamptz,
    ((current_date - interval '5 days')::date + time '18:30')::timestamptz,
    'completed'
  )
  RETURNING id INTO v_sess1_id;

  INSERT INTO training_sessions (academy_id, batch_id, coach_id, title, session_date, start_at, end_at, status)
  VALUES (
    p_academy_id, v_batch3_id, v_coach3_mem, 'Match Simulation & Death Overs Bowling',
    (current_date - interval '2 days')::date,
    ((current_date - interval '2 days')::date + time '07:00')::timestamptz,
    ((current_date - interval '2 days')::date + time '10:00')::timestamptz,
    'completed'
  )
  RETURNING id INTO v_sess2_id;

  INSERT INTO training_sessions (academy_id, batch_id, coach_id, title, session_date, start_at, end_at, status)
  VALUES (
    p_academy_id, v_batch1_id, v_coach1_mem, 'Fielding Drills & Catching Technique',
    (current_date + interval '1 day')::date,
    ((current_date + interval '1 day')::date + time '06:30')::timestamptz,
    ((current_date + interval '1 day')::date + time '08:30')::timestamptz,
    'scheduled'
  )
  RETURNING id INTO v_sess3_id;

  INSERT INTO training_sessions (academy_id, batch_id, coach_id, title, session_date, start_at, end_at, status)
  VALUES (
    p_academy_id, v_batch2_id, v_coach2_mem, 'Spin Bowling vs Fast Bowling Tactics',
    (current_date + interval '3 days')::date,
    ((current_date + interval '3 days')::date + time '16:00')::timestamptz,
    ((current_date + interval '3 days')::date + time '18:30')::timestamptz,
    'scheduled'
  )
  RETURNING id INTO v_sess4_id;

  -- Insert Attendance Records (academy_id now supplied to satisfy NOT NULL)
  FOR i IN 1..array_length(v_player_mems, 1) LOOP
    INSERT INTO attendance (academy_id, session_id, player_id, status, marked_by)
    VALUES (
      p_academy_id,
      v_sess1_id,
      v_player_mems[i],
      CASE WHEN i % 5 = 0 THEN 'absent'::attendance_status ELSE 'present'::attendance_status END,
      v_coach2_user
    );

    INSERT INTO attendance (academy_id, session_id, player_id, status, marked_by)
    VALUES (
      p_academy_id,
      v_sess2_id,
      v_player_mems[i],
      CASE WHEN i % 4 = 0 THEN 'absent'::attendance_status ELSE 'present'::attendance_status END,
      v_coach3_user
    );
  END LOOP;

    -- Create 2 Completed Matches with Scorecards
  INSERT INTO matches (
    academy_id, match_name, match_date, venue, opponent_name, match_type, format, overs, team_score, result, winning_margin, batch_id, status, created_by
  ) VALUES (
    p_academy_id, 'Academy Cup T20 Qualifier', (current_date - interval '10 days')::date, 'National Cricket Ground', 'Royal Sports Academy', 'league', 't20', 20.0, '184/5', 'won', 'Won by 24 runs', v_batch3_id, 'completed', v_owner_user_id
  ) RETURNING id INTO v_match1_id;

  FOR i IN 1..11 LOOP
    INSERT INTO match_lineups (match_id, academy_member_id, batting_order, is_captain, is_vice_captain, is_wicketkeeper)
    VALUES (v_match1_id, v_player_mems[i], i, (i = 1), (i = 2), (i = 6));
  END LOOP;

  INSERT INTO match_batting (match_id, academy_member_id, batting_order, runs, balls, fours, sixes, is_out, dismissal_type)
  VALUES
    (v_match1_id, v_player_mems[1], 1, 68, 42, 7, 3, true, 'Caught'),
    (v_match1_id, v_player_mems[2], 2, 45, 30, 5, 1, true, 'Bowled'),
    (v_match1_id, v_player_mems[3], 3, 32, 20, 3, 1, false, 'Not Out'),
    (v_match1_id, v_player_mems[4], 4, 18, 12, 2, 0, true, 'Run Out'),
    (v_match1_id, v_player_mems[5], 5, 12, 8, 1, 0, false, 'Not Out');

  INSERT INTO match_bowling (match_id, academy_member_id, overs, maidens, runs_conceded, wickets, wides, no_balls)
  VALUES
    (v_match1_id, v_player_mems[10], 4.0, 1, 22, 3, 1, 0),
    (v_match1_id, v_player_mems[11], 4.0, 0, 28, 2, 0, 1),
    (v_match1_id, v_player_mems[12], 4.0, 0, 34, 1, 2, 0),
    (v_match1_id, v_player_mems[13], 4.0, 0, 30, 2, 1, 0);

  INSERT INTO match_fielding (match_id, academy_member_id, catches, run_outs, stumpings)
  VALUES
    (v_match1_id, v_player_mems[6], 2, 1, 1),
    (v_match1_id, v_player_mems[3], 2, 0, 0);

  INSERT INTO match_awards (match_id, player_of_match_id, best_batter_id, best_bowler_id)
  VALUES (v_match1_id, v_player_mems[1], v_player_mems[1], v_player_mems[10]);

  INSERT INTO matches (
    academy_id, match_name, match_date, venue, opponent_name, match_type, format, overs, team_score, result, winning_margin, batch_id, status, created_by
  ) VALUES (
    p_academy_id, 'Regional Series Match 2', (current_date - interval '4 days')::date, 'City Sports Complex', 'City Strikers CC', 'friendly', 'odi', 50.0, '242/8', 'won', 'Won by 18 runs', v_batch2_id, 'completed', v_owner_user_id
  ) RETURNING id INTO v_match2_id;

  FOR i IN 7..17 LOOP
    INSERT INTO match_lineups (match_id, academy_member_id, batting_order, is_captain, is_vice_captain, is_wicketkeeper)
    VALUES (v_match2_id, v_player_mems[i], (i - 6), (i = 7), (i = 8), (i = 12));
  END LOOP;

  INSERT INTO match_batting (match_id, academy_member_id, batting_order, runs, balls, fours, sixes, is_out, dismissal_type)
  VALUES
    (v_match2_id, v_player_mems[7], 1, 84, 92, 9, 2, true, 'Caught'),
    (v_match2_id, v_player_mems[8], 2, 56, 64, 6, 1, true, 'LBW'),
    (v_match2_id, v_player_mems[9], 3, 41, 38, 4, 1, true, 'Bowled'),
    (v_match2_id, v_player_mems[15], 4, 30, 25, 3, 0, false, 'Not Out');

  INSERT INTO match_bowling (match_id, academy_member_id, overs, maidens, runs_conceded, wickets, wides, no_balls)
  VALUES
    (v_match2_id, v_player_mems[13], 10.0, 2, 38, 4, 1, 0),
    (v_match2_id, v_player_mems[14], 10.0, 1, 44, 3, 0, 0),
    (v_match2_id, v_player_mems[18], 8.0, 0, 42, 2, 2, 0);

  INSERT INTO match_awards (match_id, player_of_match_id, best_batter_id, best_bowler_id)
  VALUES (v_match2_id, v_player_mems[7], v_player_mems[7], v_player_mems[13]);

  -- Refresh Player Statistics (refresh_player_statistics takes (p_academy uuid, p_player uuid))
  FOR i IN 1..array_length(v_player_mems, 1) LOOP
    PERFORM refresh_player_statistics(p_academy_id, v_player_mems[i]);
  END LOOP;

  RETURN jsonb_build_object(
    'academyId', p_academy_id,
    'academyName', v_academy_name,
    'coachesCount', 3,
    'playersCount', 18,
    'batchesCount', 3,
    'sessionsCount', 4,
    'matchesCount', 2
  );
END $$;

GRANT EXECUTE ON FUNCTION super_admin_seed_academy_demo_data(uuid) TO authenticated;