-- Match Management Module: statistics, milestones, records, rankings

-- ============================================================
-- PLAYER STATISTICS (career stats — auto-updated by save_match_result RPC)
-- ============================================================
create table player_statistics (
  id                uuid primary key default gen_random_uuid(),
  academy_id        uuid not null references academies(id) on delete cascade,
  player_id         uuid not null references academy_members(id) on delete cascade,
  -- attendance
  matches_played    integer not null default 0,
  -- batting
  batting_innings   integer not null default 0,
  batting_runs      integer not null default 0,
  batting_highest_score integer,
  batting_not_outs  integer not null default 0,
  batting_fifties   integer not null default 0,
  batting_centuries integer not null default 0,
  batting_fours     integer not null default 0,
  batting_sixes     integer not null default 0,
  -- bowling
  bowling_innings   integer not null default 0,
  bowling_overs     numeric(6,1) not null default 0,
  bowling_maidens    integer not null default 0,
  bowling_runs_conceded integer not null default 0,
  bowling_wickets    integer not null default 0,
  bowling_best_bowling text,
  -- fielding
  fielding_catches   integer not null default 0,
  fielding_run_outs  integer not null default 0,
  fielding_stumpings integer not null default 0,
  -- awards
  awards_player_of_match integer not null default 0,
  awards_best_batter     integer not null default 0,
  awards_best_bowler     integer not null default 0,
  awards_best_fielder    integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (academy_id, player_id)
);
create index player_statistics_academy_idx on player_statistics (academy_id);
create index player_statistics_player_idx on player_statistics (player_id);
create index player_statistics_batting_runs on player_statistics (academy_id, batting_runs desc);
create index player_statistics_bowling_wickets on player_statistics (academy_id, bowling_wickets desc);
create index player_statistics_catches on player_statistics (academy_id, fielding_catches desc);
create index player_statistics_pom on player_statistics (academy_id, awards_player_of_match desc);
create index player_statistics_matches on player_statistics (academy_id, matches_played desc);

create trigger player_statistics_set_updated_at
  before update on player_statistics
  for each row execute function set_updated_at();

-- ============================================================
-- PLAYER MILESTONES (one row per milestone type per player)
-- ============================================================
create table player_milestones (
  id                uuid primary key default gen_random_uuid(),
  academy_id        uuid not null references academies(id) on delete cascade,
  player_id         uuid not null references academy_members(id) on delete cascade,
  milestone_type    milestone_type not null,
  match_id          uuid references matches(id),
  achieved_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (player_id, milestone_type)
);
create index player_milestones_player_idx on player_milestones (player_id);
create index player_milestones_type_idx on player_milestones (milestone_type);
create index player_milestones_academy_idx on player_milestones (academy_id);

-- ============================================================
-- ACADEMY RECORDS (single holder per record type per academy)
-- ============================================================
create table academy_records (
  id                uuid primary key default gen_random_uuid(),
  academy_id        uuid not null references academies(id) on delete cascade,
  record_type       record_type not null,
  player_id         uuid references academy_members(id),
  match_id          uuid references matches(id),
  value_numeric     numeric,
  value_text        text,
  achieved_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (academy_id, record_type)
);
create index academy_records_academy_idx on academy_records (academy_id);

-- A helper table so strike_rate can be computed accurately (sum of balls faced)
-- NOTE: must be created BEFORE the ranking views below (they reference it).
-- This column is populated by refresh_player_statistics() when matches complete.
alter table player_statistics add column if not exists balls_faced_sum integer not null default 0;
-- ============================================================
-- RANKING VIEWS (derived from player_statistics — always current)
-- ============================================================
create or replace view v_batting_rankings as
  select
    ps.academy_id,
    ps.player_id,
    am.user_id,
    p.full_name,
    p.avatar_url,
    ps.batting_runs,
    ps.batting_innings,
    ps.batting_highest_score,
    case when ps.batting_innings > 0 then round(ps.batting_runs::numeric / ps.batting_innings, 2) else 0 end as batting_average,
    case when ps.batting_runs > 0 then round(100.0 * ps.batting_runs / nullif(ps.balls_faced_sum, 0), 2) else 0 end as strike_rate_placeholder,
    ps.batting_fifties,
    ps.batting_centuries,
    ps.batting_fours,
    ps.batting_sixes,
    ps.matches_played,
    ps.awards_player_of_match
  from player_statistics ps
  join academy_members am on am.id = ps.player_id
  join profiles p on p.id = am.user_id
  order by ps.batting_runs desc nulls last;

create or replace view v_bowling_rankings as
  select
    ps.academy_id,
    ps.player_id,
    am.user_id,
    p.full_name,
    p.avatar_url,
    ps.bowling_wickets,
    ps.bowling_overs,
    ps.bowling_maidens,
    ps.bowling_runs_conceded,
    ps.bowling_best_bowling,
    case when ps.bowling_wickets > 0 then round(ps.bowling_runs_conceded::numeric / ps.bowling_wickets, 2) else 0 end as bowling_average,
    case when ps.bowling_overs > 0 then round(ps.bowling_runs_conceded::numeric / ps.bowling_overs, 2) else 0 end as economy,
    ps.matches_played,
    ps.awards_player_of_match
  from player_statistics ps
  join academy_members am on am.id = ps.player_id
  join profiles p on p.id = am.user_id
  order by ps.bowling_wickets desc nulls last;

create or replace view v_fielding_rankings as
  select
    ps.academy_id,
    ps.player_id,
    am.user_id,
    p.full_name,
    p.avatar_url,
    ps.fielding_catches,
    ps.fielding_run_outs,
    ps.fielding_stumpings,
    ps.matches_played
  from player_statistics ps
  join academy_members am on am.id = ps.player_id
  join profiles p on p.id = am.user_id
  order by ps.fielding_catches desc nulls last;

create or replace view v_overall_rankings as
  select
    ps.academy_id,
    ps.player_id,
    am.user_id,
    p.full_name,
    p.avatar_url,
    ps.matches_played,
    ps.awards_player_of_match,
    ps.batting_runs,
    ps.bowling_wickets,
    ps.fielding_catches,
    (ps.batting_runs + ps.bowling_wickets * 20 + ps.fielding_catches * 10) as contribution_points
  from player_statistics ps
  join academy_members am on am.id = ps.player_id
  join profiles p on p.id = am.user_id
  order by (ps.batting_runs + ps.bowling_wickets * 20 + ps.fielding_catches * 10) desc nulls last;


