-- ============================================================================
-- Cricket Academy Manager - Complete Demo Seed
-- Replaces default sample data with full demo academy.
-- ============================================================================

-- ============================================================
-- 1. AUTH USERS
-- ============================================================
-- Note: In Supabase, auth.users can only be inserted via:
--   - signUp() API (requires email confirmation in production)
--   - Admin API (requires service_role key)
--   - Direct SQL INSERT (only works in local dev with service_role)
-- For local development with `supabase db reset`, direct INSERT is allowed.

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, last_sign_in_at)
values
  -- Owner
  ('00000000-0000-4000-8000-000000000001', 'owner@demo.com', '{"full_name":"Rajesh Kumar"}', now(), now()),
  -- Coaches
  ('00000000-0000-4000-8000-000000000002', 'coach1@demo.com', '{"full_name":"Suresh Menon"}', now(), now()),
  ('00000000-0000-4000-8000-000000000003', 'coach2@demo.com', '{"full_name":"Vikram Singh"}', now(), now()),
  -- Players (20)
  ('00000000-0000-4000-8000-000000000010', 'player1@demo.com', '{"full_name":"Arjun Sharma"}', now(), now()),
  ('00000000-0000-4000-8000-000000000011', 'player2@demo.com', '{"full_name":"Rahul Verma"}', now(), now()),
  ('00000000-0000-4000-8000-000000000012', 'player3@demo.com', '{"full_name":"Karthik Iyer"}', now(), now()),
  ('00000000-0000-4000-8000-000000000013', 'player4@demo.com', '{"full_name":"Aditya Patel"}', now(), now()),
  ('00000000-0000-4000-8000-000000000014', 'player5@demo.com', '{"full_name":"Vihaan Gupta"}', now(), now()),
  ('00000000-0000-4000-8000-000000000015', 'player6@demo.com', '{"full_name":"Ishaan Reddy"}', now(), now()),
  ('00000000-0000-4000-8000-000000000016', 'player7@demo.com', '{"full_name":"Arnav Joshi"}', now(), now()),
  ('00000000-0000-4000-8000-000000000017', 'player8@demo.com', '{"full_name":"Dhruv Agarwal"}', now(), now()),
  ('00000000-0000-4000-8000-000000000018', 'player9@demo.com', '{"full_name":"Kabir Singh"}', now(), now()),
  ('00000000-0000-4000-8000-000000000019', 'player10@demo.com', '{"full_name":"Yash Malhotra"}', now(), now()),
  ('00000000-0000-4000-8000-000000000020', 'player11@demo.com', '{"full_name":"Reyansh Khanna"}', now(), now()),
  ('00000000-0000-4000-8000-000000000021', 'player12@demo.com', '{"full_name":"Ananya Mukherjee"}', now(), now()),
  ('00000000-0000-4000-8000-000000000022', 'player13@demo.com', '{"full_name":"Pranav Nair"}', now(), now()),
  ('00000000-0000-4000-8000-000000000023', 'player14@demo.com', '{"full_name":"Siddharth Rao"}', now(), now()),
  ('00000000-0000-4000-8000-000000000024', 'player15@demo.com', '{"full_name":"Tara Choudhury"}', now(), now()),
  ('00000000-0000-4000-8000-000000000025', 'player16@demo.com', '{"full_name":"Vikramjeet Singh"}', now(), now()),
  ('00000000-0000-4000-8000-000000000026', 'player17@demo.com', '{"full_name":"Meera Kapoor"}', now(), now()),
  ('00000000-0000-4000-8000-000000000027', 'player18@demo.com', '{"full_name":"Krishna Pillai"}', now(), now()),
  ('00000000-0000-4000-8000-000000000028', 'player19@demo.com', '{"full_name":"Rohan Das"}', now(), now()),
  ('00000000-0000-4000-8000-000000000029', 'player20@demo.com', '{"full_name":"Aarav Mehta"}', now(), now())
on conflict (id) do nothing;

-- ============================================================
-- 2. PROFILES
-- ============================================================
insert into profiles (id, email, full_name, phone, avatar_url, date_of_birth, locale, timezone, is_super_admin)
values
  ('00000000-0000-4000-8000-000000000001', 'owner@demo.com', 'Rajesh Kumar', '+919876543210', null, '1985-03-15', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000002', 'coach1@demo.com', 'Suresh Menon', '+919876543211', null, '1988-07-22', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000003', 'coach2@demo.com', 'Vikram Singh', '+919876543212', null, '1990-11-30', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000010', 'player1@demo.com', 'Arjun Sharma', '+919876541001', null, '2011-03-15', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000011', 'player2@demo.com', 'Rahul Verma', '+919876541002', null, '2010-07-22', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000012', 'player3@demo.com', 'Karthik Iyer', '+919876541003', null, '2011-01-10', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000013', 'player4@demo.com', 'Aditya Patel', '+919876541004', null, '2009-05-18', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000014', 'player5@demo.com', 'Vihaan Gupta', '+919876541005', null, '2008-11-25', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000015', 'player6@demo.com', 'Ishaan Reddy', '+919876541006', null, '2009-09-03', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000016', 'player7@demo.com', 'Arnav Joshi', '+919876541007', null, '2008-12-12', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000017', 'player8@demo.com', 'Dhruv Agarwal', '+919876541008', null, '2005-04-08', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000018', 'player9@demo.com', 'Kabir Singh', '+919876541009', null, '2004-08-16', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000019', 'player10@demo.com', 'Yash Malhotra', '+919876541010', null, '2006-01-20', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000020', 'player11@demo.com', 'Reyansh Khanna', '+919876541011', null, '2011-06-30', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000021', 'player12@demo.com', 'Ananya Mukherjee', '+919876541012', null, '2010-02-14', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000022', 'player13@demo.com', 'Pranav Nair', '+919876541013', null, '2009-10-05', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000023', 'player14@demo.com', 'Siddharth Rao', '+919876541014', null, '2008-07-19', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000024', 'player15@demo.com', 'Tara Choudhury', '+919876541015', null, '2005-12-01', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000025', 'player16@demo.com', 'Vikramjeet Singh', '+919876541016', null, '2004-05-25', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000026', 'player17@demo.com', 'Meera Kapoor', '+919876541017', null, '2011-09-08', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000027', 'player18@demo.com', 'Krishna Pillai', '+919876541018', null, '2009-03-22', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000028', 'player19@demo.com', 'Rohan Das', '+919876541019', null, '2006-06-14', 'en', 'Asia/Kolkata', false),
  ('00000000-0000-4000-8000-000000000029', 'player20@demo.com', 'Aarav Mehta', '+919876541020', null, '2005-11-30', 'en', 'Asia/Kolkata', false)
on conflict (id) do nothing;

-- ============================================================
-- 3. ACADEMY
-- ============================================================
insert into academies (id, name, slug, city, state, country, owner_user_id, is_active, fee_mode, default_monthly_fee_paise, grace_period_days)
values
  ('00000000-0000-4000-9000-000000000001', 'Elite Cricket Academy', 'elite-cricket-academy', 'Mumbai', 'Maharashtra', 'India', '00000000-0000-4000-8000-000000000001', true, 'none', 0, 0)
on conflict (id) do nothing;

-- ============================================================
-- 4. ACADEMY MEMBERS
-- ============================================================
insert into academy_members (academy_id, user_id, role, status, joined_at)
values
  -- Owner
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000001', 'academy_owner', 'active', now()),
  -- Coaches
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000002', 'coach', 'active', now()),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000003', 'coach', 'active', now()),
  -- Players
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000010', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000011', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000012', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000013', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000014', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000015', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000016', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000017', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000018', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000019', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000020', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000021', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000022', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000023', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000024', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000025', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000026', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000027', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000028', 'player', 'active', now() - (random() * 365)::int * interval '1 day'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000029', 'player', 'active', now() - (random() * 365)::int * interval '1 day')
on conflict do nothing;

-- ============================================================
-- 5. BATCHES
-- ============================================================
insert into batches (academy_id, name, age_group, coach_id, training_days, training_time, status)
values
  ('00000000-0000-4000-9000-000000000001', 'U14', 'Under 14', '00000000-0000-4000-8000-000000000002', 'Mon, Wed, Fri', '16:00-18:00', 'active'),
  ('00000000-0000-4000-9000-000000000001', 'U16', 'Under 16', '00000000-0000-4000-8000-000000000003', 'Tue, Thu, Sat', '17:00-19:00', 'active'),
  ('00000000-0000-4000-9000-000000000001', 'Senior', 'Senior', '00000000-0000-4000-8000-000000000002', 'Mon, Wed, Fri, Sun', '06:00-08:00', 'active')
on conflict do nothing;

-- ============================================================
-- 6. BATCH MEMBERS
-- ============================================================
-- U14: players 1-7 (younger players)
insert into batch_members (batch_id, player_id)
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000010' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000011' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000012' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000013' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000014' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000015' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000016'
on conflict do nothing;

-- U16: players 8-14
insert into batch_members (batch_id, player_id)
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000017' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000018' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000019' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000020' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000021' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000022' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000023'
on conflict do nothing;

-- Senior: players 15-20
insert into batch_members (batch_id, player_id)
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000024' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000025' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000026' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000027' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000028' union all
select '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000029'
on conflict do nothing;

-- ============================================================
-- 7. TRAINING SESSIONS (40 sessions)
-- ============================================================
insert into sessions (academy_id, title, session_date, start_at, end_at, batch_id, coach_id, status, ground)
select
  '00000000-0000-4000-9000-000000000001',
  title,
  current_date - (random() * 60)::int,
  lpad((6 + floor(random() * 4))::text, 2, '0') || ':00',
  lpad((6 + floor(random() * 4))::text, 2, '0') || ':30',
  (select id from batches where academy_id = '00000000-0000-4000-9000-000000000001' order by random() limit 1),
  (select id from unnest(array['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003']) order by random() limit 1),
  'completed',
  'Main Ground'
from (
  select unnest(array[
    'Batting Technique', 'Bowling Speed', 'Fielding Drills', 'Fitness Training',
    'Net Practice', 'Match Simulation', 'Spin Bowling', 'Fast Bowling',
    'Wicketkeeping Skills', 'Running Between Wickets', 'Power Hitting',
    'Death Bowling', 'Slip Fielding', 'Yoga & Flexibility', 'Reaction Training',
    'Catching Practice', 'Throwdown Session', 'Video Analysis', 'Team Strategy',
    'Practice Match', 'Batting Timing', 'Bowling Accuracy', 'Agility Training',
    'Core Strength', 'Speed Work', 'Endurance Run', 'Reaction Drills',
    'Throwdown Session', 'Net Session', 'Match Preparation'
  ]) as title
) as titles
limit 40
returning id into :session_ids;

-- ============================================================
-- 8. ATTENDANCE (80% attendance rate)
-- ============================================================
insert into attendance (academy_id, session_id, player_id, status)
select
  '00000000-0000-4000-9000-000000000001',
  s.id,
  p.user_id,
  case when random() < 0.8 then 'present' else 'absent' end
from sessions s
cross join (select user_id from academy_members where academy_id = '00000000-0000-4000-9000-000000000001' and role = 'player') p
where s.academy_id = '00000000-0000-4000-9000-000000000001'
  and s.id in (select id from unnest(:session_ids));

-- ============================================================
-- 9. DRILL ASSIGNMENTS
-- ============================================================
insert into drill_assignments (academy_id, player_id, drill_name, drill_category, status, assigned_at, due_date)
select
  '00000000-0000-4000-9000-000000000001',
  p.user_id,
  drill_name,
  category,
  case when random() < 0.6 then 'completed' else 'pending' end,
  current_timestamp - (random() * 30)::int * interval '1 day',
  current_date + (random() * 15)::int
from (select user_id from academy_members where academy_id = '00000000-0000-4000-9000-000000000001' and role = 'player') p
cross join (
  select unnest(array['Cone Drill', 'Throwdown Batting', 'Yorker Practice', 'Catching Drills']) as drill_name,
         unnest(array['fielding', 'batting', 'bowling', 'fielding']) as category
) drills
where random() < 0.5
limit 100;

-- ============================================================
-- 10. MATCHES (25 completed matches)
-- ============================================================
insert into matches (academy_id, match_name, match_date, venue, opponent_name, tournament, match_type, format, overs, team_score, wickets_lost, overs_played, result, winning_margin, status, created_by)
select
  '00000000-0000-4000-9000-000000000001',
  'Match ' || i || ' vs ' || opponent,
  current_date - (random() * 90)::int,
  'Main Cricket Ground',
  opponent,
  case when random() < 0.5 then 'League 2024' else null end,
  case when random() < 0.3 then 'practice' when random() < 0.6 then 'friendly' when random() < 0.9 then 'league' else 'tournament' end,
  case when random() < 0.5 then 't20' else 'odi' end,
  case when random() < 0.5 then 20 else 50 end,
  (random() * 200 + 100)::int || '/' || (random() * 8 + 1)::int,
  (random() * 8 + 1)::int,
  (random() * 10 + 15)::numeric(4,1),
  case when random() < 0.6 then 'won' when random() < 0.95 then 'lost' else 'tie' end,
  'by ' || (random() * 45 + 5)::int || ' runs',
  'completed',
  '00000000-0000-4000-8000-000000000002'
from generate_series(1, 25) as i,
     unnest(array[
       'City Cricket Club', 'Riverside CC', 'Royal XI', 'Thunderbolts CC',
       'Phoenix Cricket Academy', 'National School XI', 'District Select', 'Young Stars CC',
       'Premier League XI', 'Cricket Warriors', 'Victory CC', 'Sunrise Academy',
       'Champions XI', 'Sports Authority XI', 'Talent Hunt CC', 'Metro Cricket Club',
       'Galaxy CC', 'Star Cricket Academy', 'Rising Stars', 'Power Play XI',
       'Elite CC', 'Pro Cricket Academy', 'Dynamic XI', 'Goal CC',
       'Supreme Cricket Club'
     ]) as opponent
where i = generate_series
returning id, academy_id into :match_ids, null;

-- ============================================================
-- 11. MATCH LINEUPS, BATTING, BOWLING, FIELDING, AWARDS
-- ============================================================
do $$
declare
  match_record record;
begin
  for match_record in select id from unnest(:match_ids) as id loop
    -- Lineup (11 players)
    insert into match_lineups (match_id, academy_member_id, batting_order, is_captain, is_vice_captain, is_wicketkeeper)
    select
      match_record.id,
      am.id,
      row_number() over (order by random()),
      row_number() over (order by random()) = 1,
      row_number() over (order by random()) = 2,
      row_number() over (order by random()) = 3
    from academy_members am
    where am.academy_id = '00000000-0000-4000-9000-000000000001'
      and am.role = 'player'
    order by random()
    limit 11;

    -- Batting scorecard
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

    -- Bowling figures (max 7 players bowl)
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

    -- Fielding statistics
    insert into match_fielding (match_id, academy_member_id, catches, run_outs, stumpings)
    select
      match_record.id,
      academy_member_id,
      (random() * 3)::int,
      (random() * 2)::int,
      (random() * 2)::int
    from match_lineups
    where match_id = match_record.id;

    -- Match awards
    insert into match_awards (match_id, player_of_match_id, best_batter_id, best_bowler_id, best_fielder_id)
    select
      match_record.id,
      (select academy_member_id from match_lineups where match_id = match_record.id order by random() limit 1),
      (select academy_member_id from match_lineups where match_id = match_record.id order by random() limit 1),
      (select academy_member_id from match_lineups where match_id = match_record.id order by random() limit 1),
      (select academy_member_id from match_lineups where match_id = match_record.id order by random() limit 1);
  end loop;
end $$;

-- ============================================================
-- 12. COACH NOTES
-- ============================================================
insert into match_coach_notes (match_id, academy_member_id, coach_id, notes)
select
  m.id,
  ml.academy_member_id,
  (select id from academy_members where academy_id = '00000000-0000-4000-9000-000000000001' and role = 'coach' order by random() limit 1),
  'Good performance. Keep practicing hard!'
from matches m
join match_lineups ml on ml.match_id = m.id
where random() < 0.5;

-- ============================================================
-- 13. PARTNERSHIPS (sample)
-- ============================================================
insert into match_partnerships (match_id, batter_1_id, batter_2_id, runs_added, wicket_number)
select
  m.id,
  ml1.academy_member_id,
  ml2.academy_member_id,
  (random() * 100 + 20)::int,
  (random() * 10 + 1)::int
from matches m
join match_lineups ml1 on ml1.match_id = m.id
join match_lineups ml2 on ml2.match_id = m.id and ml2.batting_order = ml1.batting_order + 1
where random() < 0.3;

-- ============================================================
-- 14. REFRESH STATISTICS & RECORDS
-- ============================================================
select refresh_academy_records('00000000-0000-4000-9000-000000000001');

do $$
declare
  player_record record;
begin
  for player_record in select id from academy_members where academy_id = '00000000-0000-4000-9000-000000000001' and role = 'player' loop
    perform refresh_player_statistics('00000000-0000-4000-9000-000000000001', player_record.id);
  end loop;
end $$;

-- ============================================================
-- 15. VERIFICATION
-- ============================================================
select 'Academy: ' || (select count(*) from academies where id = '00000000-0000-4000-9000-000000000001') as academies;
select 'Owner: ' || (select count(*) from academy_members where academy_id = '00000000-0000-4000-9000-000000000001' and role = 'academy_owner') as owners;
select 'Coaches: ' || (select count(*) from academy_members where academy_id = '00000000-0000-4000-9000-000000000001' and role = 'coach') as coaches;
select 'Players: ' || (select count(*) from academy_members where academy_id = '00000000-0000-4000-9000-000000000001' and role = 'player') as players;
select 'Batches: ' || (select count(*) from batches where academy_id = '00000000-0000-4000-9000-000000000001') as batches;
select 'Sessions: ' || (select count(*) from sessions where academy_id = '00000000-0000-4000-9000-000000000001') as sessions;
select 'Matches: ' || (select count(*) from matches where academy_id = '00000000-0000-4000-9000-000000000001') as matches;
select 'Attendance: ' || (select count(*) from attendance where academy_id = '00000000-0000-4000-9000-000000000001') as attendance;
select 'Drill Assignments: ' || (select count(*) from drill_assignments where academy_id = '00000000-0000-4000-9000-000000000001') as drills;
select 'Match Lineups: ' || (select count(*) from match_lineups where match_id in (select id from matches where academy_id = '00000000-0000-4000-9000-000000000001')) as lineups;
select 'Batting Records: ' || (select count(*) from match_batting where match_id in (select id from matches where academy_id = '00000000-0000-4000-9000-000000000001')) as batting;
select 'Bowling Records: ' || (select count(*) from match_bowling where match_id in (select id from matches where academy_id = '00000000-0000-4000-9000-000000000001')) as bowling;
select 'Fielding Records: ' || (select count(*) from match_fielding where match_id in (select id from matches where academy_id = '00000000-0000-4000-9000-000000000001')) as fielding;
select 'Match Awards: ' || (select count(*) from match_awards where match_id in (select id from matches where academy_id = '00000000-0000-4000-9000-000000000001')) as awards;
select 'Coach Notes: ' || (select count(*) from match_coach_notes where match_id in (select id from matches where academy_id = '00000000-0000-4000-9000-000000000001')) as coach_notes;
select 'Player Statistics: ' || (select count(*) from player_statistics where academy_id = '00000000-0000-4000-9000-000000000001') as statistics;
select 'Academy Records: ' || (select count(*) from academy_records where academy_id = '00000000-0000-4000-9000-000000000001') as records;