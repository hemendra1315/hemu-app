-- ============================================================
-- Cricket Academy Manager - Demo Data Seed
-- Run this in Supabase SQL Editor or via CLI:
--   supabase db reset && supabase db seed
-- ============================================================

-- Wrap everything in an anonymous block so we can use variables.
-- Runs as the migration role (RLS bypassed). Users are created in auth.users
-- first; the handle_new_user trigger then creates their profiles.
--
-- NOTE on multi-row id collection: PL/pgSQL `RETURNING ... INTO` and plain
-- `SELECT ... INTO` cannot collect multiple rows into an array variable; they
-- raise "query returned more than one row" (SQLSTATE P0003). Every statement
-- that returns more than one id therefore collects the ids with
-- `WITH ins AS (INSERT ... RETURNING id) SELECT array_agg(id ...) INTO var`
-- (or uses one single-row INSERT per value when the array order carries
-- meaning, e.g. batches / coaches). ORDER BY keeps the arrays deterministic.
do $$
declare
  v_academy_id uuid;
  v_owner_user_id uuid;
  v_owner_member_id uuid;
  v_coach_ids uuid[];
  v_coach1_id uuid;
  v_coach2_id uuid;
  v_coach_member_ids uuid[];
  v_player_ids uuid[];
  v_player_member_ids uuid[];
  v_batch_ids uuid[];
  v_batch1_id uuid;
  v_batch2_id uuid;
  v_batch3_id uuid;
  v_session_ids uuid[];
  v_match_ids uuid[];
  v_drill_ids uuid[];
begin
  -- ============================================================
  -- 1. AUTH USERS (profiles are created by the on_auth_user_created trigger)
  -- ============================================================
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  values (
    gen_random_uuid(), 'owner@demo.com',
    crypt('Demo@123456', gen_salt('bf')), now(),
    '{"full_name": "Rajesh Kumar"}', 'authenticated', 'authenticated'
  ) returning id into v_owner_user_id;

  -- Coaches: two single-row INSERTs keep v_coach_ids deterministic
  -- (v_coach_ids[1] is always coach1@demo.com, v_coach_ids[2] coach2@demo.com).
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  values (
    gen_random_uuid(), 'coach1@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Suresh Menon"}', 'authenticated', 'authenticated'
  ) returning id into v_coach1_id;

  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
  values (
    gen_random_uuid(), 'coach2@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Vikram Singh"}', 'authenticated', 'authenticated'
  ) returning id into v_coach2_id;

  v_coach_ids := array[v_coach1_id, v_coach2_id];

  -- Players (20). Fixed ids make `order by id` deterministic (player1..player20).
  with ins as (
    insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
    values
      ('00000000-0000-4000-8000-000000000001', 'player1@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Arjun Sharma"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000002', 'player2@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Rahul Verma"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000003', 'player3@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Karthik Iyer"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000004', 'player4@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Aditya Patel"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000005', 'player5@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Vihaan Gupta"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000006', 'player6@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Ishaan Reddy"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000007', 'player7@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Arnav Joshi"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000008', 'player8@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Dhruv Agarwal"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000009', 'player9@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Kabir Singh"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000010', 'player10@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Yash Malhotra"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000011', 'player11@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Reyansh Khanna"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000012', 'player12@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Ananya Mukherjee"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000013', 'player13@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Pranav Nair"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000014', 'player14@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Siddharth Rao"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000015', 'player15@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Tara Choudhury"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000016', 'player16@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Vikramjeet Singh"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000017', 'player17@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Meera Kapoor"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000018', 'player18@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Krishna Pillai"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000019', 'player19@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Rohan Das"}', 'authenticated', 'authenticated'),
      ('00000000-0000-4000-8000-000000000020', 'player20@demo.com', crypt('Demo@123456', gen_salt('bf')), now(), '{"full_name": "Aarav Mehta"}', 'authenticated', 'authenticated')
    returning id
  )
  select array_agg(id order by id) into v_player_ids from ins;

  -- Ensure all auth users have full GoTrue metadata and identities populated for email/password auth
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  select id, id, json_build_object('sub', id::text, 'email', email), 'email', id::text, now(), now(), now()
  from auth.users
  on conflict do nothing;

  update auth.users
  set
    instance_id = '00000000-0000-0000-0000-000000000000',
    raw_app_meta_data = json_build_object('provider', 'email', 'providers', json_build_array('email')),
    is_sso_user = false,
    confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, ''),
    phone_change = coalesce(phone_change, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    reauthentication_token = coalesce(reauthentication_token, ''),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now()),
    confirmation_sent_at = coalesce(confirmation_sent_at, now());

  -- ============================================================
  -- 2. ACADEMY (no join_code column; owner + slug required)
  -- ============================================================
  insert into academies (name, slug, city, state, country, owner_user_id)
  values (
    'Elite Cricket Academy',
    'elite-cricket-academy-' || floor(random() * 900000 + 100000)::text,
    'Mumbai',
    'Maharashtra',
    'IN',
    v_owner_user_id
  ) returning id into v_academy_id;

  -- Insert active join code for easy testing
  insert into academy_join_codes (academy_id, code, role, is_active)
  values (v_academy_id, 'CRCKT1', 'player', true);

  -- ============================================================
  -- 3. PROFILES & ACADEMY_MEMBERS
  -- ============================================================
  update profiles set phone = '+919876543210', date_of_birth = '1980-01-01', locale = 'en', timezone = 'Asia/Kolkata'
  where id = v_owner_user_id;

  update profiles set phone = '+919876543211', locale = 'en', timezone = 'Asia/Kolkata'
  where id = any(v_coach_ids);

  update profiles p
  set phone = '9' || (9900000000 + rn)::text, locale = 'en', timezone = 'Asia/Kolkata'
  from (select id, row_number() over () as rn from unnest(v_player_ids) as id) x
  where p.id = x.id;

  insert into academy_members (academy_id, user_id, role, status, joined_at)
  values (v_academy_id, v_owner_user_id, 'academy_owner', 'active', now())
  returning id into v_owner_member_id;

  with ins as (
    insert into academy_members (academy_id, user_id, role, status, joined_at)
    select v_academy_id, id, 'coach', 'active', now()
    from unnest(v_coach_ids) as id
    returning id, user_id
  )
  select array_agg(id order by array_position(v_coach_ids, user_id)) into v_coach_member_ids from ins;

  with ins as (
    insert into academy_members (academy_id, user_id, role, status, joined_at)
    select v_academy_id, id, 'player', 'active', now() - (random() * 365)::int * interval '1 day'
    from unnest(v_player_ids) as id
    returning id, user_id
  )
  select array_agg(id order by array_position(v_player_ids, user_id)) into v_player_member_ids from ins;

  -- ============================================================
  -- 4. BATCHES (coach_id, training_days, training_time are nullable since 0028/0029)
  -- ============================================================
  -- One single-row INSERT per batch keeps v_batch_ids deterministic
  -- (v_batch_ids[1]='U14', [2]='U16', [3]='Senior').
  insert into batches (academy_id, name, age_group, coach_id, training_days, training_time)
  values (v_academy_id, 'U14', 'Under 14', v_coach_member_ids[1], 'Mon, Wed, Fri', '16:00-18:00')
  returning id into v_batch1_id;

  insert into batches (academy_id, name, age_group, coach_id, training_days, training_time)
  values (v_academy_id, 'U16', 'Under 16', v_coach_member_ids[2], 'Tue, Thu, Sat', '17:00-19:00')
  returning id into v_batch2_id;

  insert into batches (academy_id, name, age_group, coach_id, training_days, training_time)
  values (v_academy_id, 'Senior', 'Senior', v_coach_member_ids[1], 'Mon, Wed, Fri, Sun', '06:00-08:00')
  returning id into v_batch3_id;

  v_batch_ids := array[v_batch1_id, v_batch2_id, v_batch3_id];

  -- U14: players 1-7
  insert into batch_members (batch_id, academy_member_id)
  select v_batch_ids[1], id from unnest(v_player_member_ids[1:7]) as id;

  -- U16: players 8-14
  insert into batch_members (batch_id, academy_member_id)
  select v_batch_ids[2], id from unnest(v_player_member_ids[8:14]) as id;

  -- Senior: players 15-20
  insert into batch_members (batch_id, academy_member_id)
  select v_batch_ids[3], id from unnest(v_player_member_ids[15:20]) as id;

-- ============================================================
  -- 5. TRAINING SESSIONS (table is training_sessions; start_at/end_at timestamptz)
  -- ============================================================
  with ins as (
    insert into training_sessions (academy_id, batch_id, title, session_date, start_at, end_at, coach_id, status, created_by)
    select
      v_academy_id,
      v_batch_ids[1 + ((i - 1) % 3)],
      title,
      base_day,
      base_day + make_interval(hours => 6),
      base_day + make_interval(hours => 8),
      v_coach_member_ids[1 + ((i - 1) % 2)],
      'completed',
      v_owner_user_id
    from (
      select
        i,
        title,
        current_date - (random() * 60)::int as base_day
      from (
        select i, unnest(array[
        'Batting Technique', 'Bowling Speed', 'Fielding Drills', 'Fitness Training',
        'Net Practice', 'Match Simulation', 'Spin Bowling', 'Fast Bowling',
        'Wicketkeeping Skills', 'Running Between Wickets', 'Power Hitting',
        'Death Bowling', 'Slip Fielding', 'Yoga & Flexibility', 'Reaction Training',
        'Catching Practice', 'Throwdown Session', 'Video Analysis', 'Team Strategy',
        'Practice Match', 'Batting Timing', 'Bowling Accuracy', 'Agility Training',
        'Core Strength', 'Speed Work', 'Endurance Run', 'Reaction Drills',
        'Throwdown Session', 'Net Session', 'Match Preparation'
      ]) as title
        from generate_series(1, 30) as i
      ) as titles
    ) as s
    limit 40
    returning id
  )
  select array_agg(id order by id) into v_session_ids from ins;

  -- ============================================================
  -- 6. ATTENDANCE (80% present)
  -- ============================================================
  insert into attendance (academy_id, session_id, player_id, status, marked_by)
  select
    v_academy_id,
    s.id,
    p.id,
    case when random() < 0.8 then 'present'::attendance_status else 'absent'::attendance_status end,
    v_owner_user_id
  from training_sessions s
  cross join unnest(v_player_member_ids) as p(id)
  where s.academy_id = v_academy_id
    and s.id = any(v_session_ids);

  -- ============================================================
  -- 7. DRILLS + DRILL ASSIGNMENTS
  -- ============================================================
  with ins as (
    insert into drills (academy_id, name, category, description, duration_minutes, difficulty, created_by)
    values
      (v_academy_id, 'Cone Drill', 'fielding', 'Agility through cones', 10, 'beginner', v_owner_user_id),
      (v_academy_id, 'Throwdown Batting', 'batting', 'Batting vs throwdowns', 20, 'intermediate', v_owner_user_id),
      (v_academy_id, 'Yorker Practice', 'bowling', 'Yorker accuracy', 15, 'advanced', v_owner_user_id),
      (v_academy_id, 'Catching Drills', 'fielding', 'High and slip catches', 15, 'beginner', v_owner_user_id)
    returning id
  )
  select array_agg(id order by id) into v_drill_ids from ins;

  insert into drill_assignments (academy_id, drill_id, player_id, assigned_at, due_date, status, created_by)
  select
    v_academy_id,
    d.id,
    p.id,
    current_timestamp - (random() * 30)::int * interval '1 day',
    current_date + (random() * 15)::int,
    case when random() < 0.6 then 'completed'::drill_assignment_status else 'assigned'::drill_assignment_status end,
    v_owner_user_id
  from unnest(v_player_member_ids) as p(id)
  cross join unnest(v_drill_ids) as d(id)
  where random() < 0.5;

  -- ============================================================
  -- 8. MATCHES (25 matches with full scorecards)
  -- ============================================================
  with ins as (
    insert into matches (academy_id, match_name, match_date, venue, opponent_name, tournament, match_type, format, overs, team_score, wickets_lost, overs_played, result, winning_margin, status, created_by)
    select
      v_academy_id,
      'Match ' || i || ' vs ' || opponent,
      current_date - (random() * 90)::int,
      'Main Cricket Ground',
      opponent,
      case when random() < 0.5 then 'League 2024' else null end,
      case when random() < 0.3 then 'practice'::match_type when random() < 0.6 then 'friendly'::match_type when random() < 0.9 then 'league'::match_type else 'tournament'::match_type end,
      case when random() < 0.5 then 't20'::match_format else 'odi'::match_format end,
      case when random() < 0.5 then 20 else 50 end,
      ((random() * 200 + 100)::int || '/' || (random() * 8 + 1)::int),
      (random() * 8 + 1)::int,
      (random() * 10 + 15)::numeric(4,1),
      case when random() < 0.6 then 'won'::match_result when random() < 0.95 then 'lost'::match_result else 'tie'::match_result end,
      'by ' || (random() * 45 + 5)::int || ' runs',
      'completed',
      v_owner_user_id
    from (
      select i, unnest(array[
        'City Cricket Club', 'Riverside CC', 'Royal XI', 'Thunderbolts CC',
        'Phoenix Cricket Academy', 'National School XI', 'District Select', 'Young Stars CC',
        'Premier League XI', 'Cricket Warriors', 'Victory CC', 'Sunrise Academy',
        'Champions XI', 'Sports Authority XI', 'Talent Hunt CC', 'Metro Cricket Club',
        'Galaxy CC', 'Star Cricket Academy', 'Rising Stars', 'Power Play XI',
        'Elite CC', 'Pro Cricket Academy', 'Dynamic XI', 'Goal CC',
        'Supreme Cricket Club'
      ]) as opponent
      from generate_series(1, 25) as i
    ) as opponents
    limit 25
    returning id
  )
  select array_agg(id order by id) into v_match_ids from ins;

  -- Scorecards
  declare
    match_record record;
  begin
    for match_record in select id from unnest(v_match_ids) as id loop
      insert into match_lineups (match_id, academy_member_id, batting_order, is_captain, is_vice_captain, is_wicketkeeper)
      select
        match_record.id,
        players.id,
        row_number() over (order by random()),
        row_number() over (order by random()) = 1,
        row_number() over (order by random()) = 2,
        row_number() over (order by random()) = 3
      from (select unnest(v_player_member_ids) as id order by random() limit 11) as players;

      insert into match_batting (match_id, academy_member_id, runs, balls, fours, sixes, is_out, dismissal_type, batting_order)
      select
        match_record.id,
        academy_member_id,
        (random() * 80)::int,
        (random() * 60 + 10)::int,
        (random() * 8)::int,
        (random() * 4)::int,
        random() < 0.7,
        case when random() < 0.7 then 'bowled' when random() < 0.8 then 'caught' when random() < 0.9 then 'lbw' else 'run_out' end,
        batting_order
      from match_lineups
      where match_id = match_record.id;

      insert into match_bowling (match_id, academy_member_id, overs, maidens, runs_conceded, wickets, wides, no_balls)
      select
        match_record.id,
        academy_member_id,
        (floor(random() * 8 + 2) + (floor(random() * 6) / 10.0))::numeric(4,1),
        (random() * 2)::int,
        (random() * 50 + 20)::int,
        (random() * 5)::int,
        (random() * 5)::int,
        (random() * 2)::int
      from match_lineups
      where match_id = match_record.id
      order by random()
      limit 7;

      insert into match_fielding (match_id, academy_member_id, catches, run_outs, stumpings)
      select
        match_record.id,
        academy_member_id,
        (random() * 3)::int,
        (random() * 2)::int,
        (random() * 2)::int
      from match_lineups
      where match_id = match_record.id;

      insert into match_awards (match_id, player_of_match_id, best_batter_id, best_bowler_id, best_fielder_id)
      select
        match_record.id,
        (select academy_member_id from match_lineups where match_id = match_record.id order by random() limit 1),
        (select academy_member_id from match_lineups where match_id = match_record.id order by random() limit 1),
        (select academy_member_id from match_lineups where match_id = match_record.id order by random() limit 1),
        (select academy_member_id from match_lineups where match_id = match_record.id order by random() limit 1);
    end loop;
  end;


  -- ============================================================
  -- 9. COACH NOTES (50% of players per match)
  -- ============================================================
  insert into match_coach_notes (match_id, academy_member_id, coach_id, notes)
  select
    m.id,
    ml.academy_member_id,
    (select unnest(v_coach_member_ids) order by random() limit 1),
    'Good performance. Keep practicing hard!'
  from matches m
  join match_lineups ml on ml.match_id = m.id
  where random() < 0.5;

  -- ============================================================
  -- 10. REFRESH STATISTICS & RECORDS
  -- ============================================================
  perform refresh_academy_records(v_academy_id);

  declare
    player_record record;
  begin
    for player_record in select id from unnest(v_player_member_ids) as id loop
      perform refresh_player_statistics(v_academy_id, player_record.id);
    end loop;
  end;

  -- ============================================================
  -- VERIFICATION
  -- ============================================================
  raise info 'Academy: %', (select name from academies where id = v_academy_id);
  raise info 'Owner: %', (select email from profiles where id = v_owner_user_id);
  raise info 'Coaches: %', (select count(*) from academy_members where academy_id = v_academy_id and role = 'coach');
  raise info 'Players: %', (select count(*) from academy_members where academy_id = v_academy_id and role = 'player');
  raise info 'Batches: %', (select count(*) from batches where academy_id = v_academy_id);
  raise info 'Sessions: %', (select count(*) from training_sessions where academy_id = v_academy_id);
  raise info 'Matches: %', (select count(*) from matches where academy_id = v_academy_id);
  raise info 'Attendance Records: %', (select count(*) from attendance where academy_id = v_academy_id);

end $$;


-- ============================================================
-- DEMO CREDENTIALS
-- ============================================================
-- Owner:  owner@demo.com / Demo@123456
-- Coach1: coach1@demo.com / Demo@123456
-- Coach2: coach2@demo.com / Demo@123456
-- Players: player1@demo.com through player20@demo.com / Demo@123456
-- ============================================================

