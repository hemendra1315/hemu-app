begin;

-- Import pgTAP
create extension if not exists pgtap;
select plan(11);

-- Set up mock data
insert into auth.users (id, email) values
('00000000-0000-0000-0000-000000000001', 'owner@test.com'),
('00000000-0000-0000-0000-000000000002', 'parent1@test.com'),
('00000000-0000-0000-0000-000000000003', 'player1@test.com'),
('00000000-0000-0000-0000-000000000004', 'player2@test.com'),
('00000000-0000-0000-0000-000000000005', 'parent2@test.com');

-- Update profiles with full_name
update profiles set full_name = 'Owner' where id = '00000000-0000-0000-0000-000000000001';
update profiles set full_name = 'Parent 1' where id = '00000000-0000-0000-0000-000000000002';
update profiles set full_name = 'Player 1' where id = '00000000-0000-0000-0000-000000000003';
update profiles set full_name = 'Player 2' where id = '00000000-0000-0000-0000-000000000004';
update profiles set full_name = 'Parent 2' where id = '00000000-0000-0000-0000-000000000005';

insert into academies (id, name, slug, owner_user_id) values
('aaaa0000-0000-0000-0000-000000000001', 'Test Academy', 'test-academy', '00000000-0000-0000-0000-000000000001');

insert into academy_members (id, academy_id, user_id, role, status) values
('11111111-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'academy_owner', 'active'),
('11111111-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'parent', 'active'),
('11111111-0000-0000-0000-000000000003', 'aaaa0000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'player', 'active'),
('11111111-0000-0000-0000-000000000004', 'aaaa0000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'player', 'active'),
('11111111-0000-0000-0000-000000000005', 'aaaa0000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'parent', 'active');

-- Link Parent 1 to Player 1
insert into parent_player_links (parent_user_id, player_user_id, academy_id, relationship_type, status) values
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'aaaa0000-0000-0000-0000-000000000001', 'father', 'active');

-- Link Parent 2 to Player 2
insert into parent_player_links (parent_user_id, player_user_id, academy_id, relationship_type, status) values
('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004', 'aaaa0000-0000-0000-0000-000000000001', 'mother', 'active');

-- Add data for both players
insert into player_statistics (academy_id, player_id, matches_played) values 
('aaaa0000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 10),
('aaaa0000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000004', 20);

-- Insert a batch
insert into batches (id, academy_id, name, age_group) values
('44444444-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000001', 'Test Batch', 'U19');

-- Insert attendance (requires session)
insert into training_sessions (id, academy_id, batch_id, coach_id, title, session_date, start_at, end_at, status) values
('22222222-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Test', '2025-01-01', '2025-01-01 10:00:00+00', '2025-01-01 12:00:00+00', 'completed');
insert into attendance (session_id, academy_id, player_id, status) values
('22222222-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 'present'),
('22222222-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000004', 'present');

-- Insert Announcements
insert into announcements (id, academy_id, title, message, audience, created_by) values
('33333333-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000001', 'For Parents', 'Test', 'all_parents', '00000000-0000-0000-0000-000000000001'),
('33333333-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-000000000001', 'For Players', 'Test', 'players', '00000000-0000-0000-0000-000000000001'),
('33333333-0000-0000-0000-000000000003', 'aaaa0000-0000-0000-0000-000000000001', 'For All', 'Test', 'all', '00000000-0000-0000-0000-000000000001');

-- Authenticate as Parent 1
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002"}', true);
set local role authenticated;

-- Test reads
select results_eq(
  'select id from profiles where id = ''00000000-0000-0000-0000-000000000003''',
  array['00000000-0000-0000-0000-000000000003'::uuid],
  'Parent can read linked Player 1 profile'
);

select is_empty(
  'select id from profiles where id = ''00000000-0000-0000-0000-000000000004''',
  'Parent CANNOT read unlinked Player 2 profile'
);

select results_eq(
  'select player_id from player_statistics',
  array['11111111-0000-0000-0000-000000000003'::uuid],
  'Parent can read Player 1 statistics'
);

select results_eq(
  'select player_id from attendance',
  array['11111111-0000-0000-0000-000000000003'::uuid],
  'Parent can read Player 1 attendance'
);

select results_eq(
  'select id from announcements order by id',
  array['33333333-0000-0000-0000-000000000001'::uuid, '33333333-0000-0000-0000-000000000003'::uuid],
  'Parent can read announcements for all_parents and all'
);

-- Test writes (should fail / return false)
update profiles set full_name = 'Hacked' where id = '00000000-0000-0000-0000-000000000003';
select results_eq(
  'select full_name from profiles where id = ''00000000-0000-0000-0000-000000000003''',
  ARRAY['Player 1'::text],
  'Parent CANNOT update player profile'
);

update player_statistics set matches_played = 100 where player_id = '11111111-0000-0000-0000-000000000003';
select results_eq(
  'select matches_played from player_statistics where player_id = ''11111111-0000-0000-0000-000000000003''',
  ARRAY[10::integer],
  'Parent CANNOT update player statistics'
);

select throws_ok(
  'insert into attendance (session_id, academy_id, player_id, status) values (''22222222-0000-0000-0000-000000000001'', ''aaaa0000-0000-0000-0000-000000000001'', ''11111111-0000-0000-0000-000000000003'', ''present'')',
  '42501',
  NULL,
  'Parent CANNOT insert attendance'
);

select throws_ok(
  'insert into announcements (academy_id, title, message, audience) values (''aaaa0000-0000-0000-0000-000000000001'', ''Hacked'', ''Test'', ''all'')',
  '42501',
  NULL,
  'Parent CANNOT insert announcements'
);

set local role postgres;
insert into announcements (id, academy_id, title, message, audience) values
('33333333-0000-0000-0000-000000000008', 'aaaa0000-0000-0000-0000-000000000001', 'All Msg', 'Msg', 'all'),
('33333333-0000-0000-0000-000000000009', 'aaaa0000-0000-0000-0000-000000000001', 'Coach Msg', 'Msg', 'coaches');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated", "sub":"00000000-0000-0000-0000-000000000002"}', true);

select results_eq(
  'select id from announcements where title = ''All Msg''',
  ARRAY['33333333-0000-0000-0000-000000000008'::uuid],
  'Parent CAN read ''all'' announcements'
);

select is_empty(
  'select id from announcements where title = ''Coach Msg''',
  'Parent CANNOT read ''coaches'' announcements'
);

select * from finish();
rollback;
