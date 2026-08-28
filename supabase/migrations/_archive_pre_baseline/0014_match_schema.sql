-- Match Management Module: core match tables + enums

-- ============================================================
-- ENUMS
-- ============================================================
create type match_format as enum ('t20', 'odi', 'test', 't10', 'custom');
create type match_type as enum ('practice', 'friendly', 'league', 'tournament');
create type match_result as enum ('won', 'lost', 'tie', 'no_result');
create type match_status as enum ('created', 'in_progress', 'completed', 'cancelled');
create type milestone_type as enum (
  'debut_match', 'first_fifty', 'first_century', 'first_five_wicket_haul',
  'runs_100', 'runs_500', 'runs_1000', 'wickets_50', 'wickets_100', 'catches_25'
);
create type record_type as enum (
  'highest_team_score', 'lowest_team_score', 'biggest_victory',
  'highest_successful_chase', 'highest_partnership', 'most_runs_one_match',
  'most_wickets_one_match', 'most_sixes', 'most_fours'
);

-- ============================================================
-- MATCHES
-- ============================================================
create table matches (
  id               uuid primary key default gen_random_uuid(),
  academy_id       uuid not null references academies(id) on delete cascade,
  match_name       text not null,
  match_date       date not null,
  venue            text,
  opponent_name    text,
  tournament       text,
  match_type       match_type not null default 'friendly',
  format           match_format not null default 't20',
  overs            numeric(4,1),
  team_score       text,                  -- e.g. "180/7"
  wickets_lost     integer,
  overs_played     numeric(4,1),
  result           match_result,
  winning_margin   text,
  batch_id         uuid references batches(id) on delete set null,
  status           match_status not null default 'created',
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index matches_academy_idx on matches (academy_id);
create index matches_date_idx on matches (academy_id, match_date desc);
create index matches_status_idx on matches (academy_id, status);
create index matches_format_idx on matches (academy_id, format);
create index matches_result_idx on matches (academy_id, result);
create index matches_tournament_idx on matches (tournament);
create index matches_batch_idx on matches (batch_id);

create trigger matches_set_updated_at
  before update on matches
  for each row execute function set_updated_at();

-- ============================================================
-- MATCH LINEUPS (Playing XI)
-- ============================================================
create table match_lineups (
  id               uuid primary key default gen_random_uuid(),
  match_id         uuid not null references matches(id) on delete cascade,
  academy_member_id uuid not null references academy_members(id) on delete cascade,
  batting_order    integer,
  is_captain       boolean not null default false,
  is_vice_captain  boolean not null default false,
  is_wicketkeeper  boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (match_id, academy_member_id)
);
create index match_lineups_match_idx on match_lineups (match_id);
create index match_lineups_player_idx on match_lineups (academy_member_id);

-- ============================================================
-- MATCH BATTING (batting scorecard)
-- ============================================================
create table match_batting (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  academy_member_id uuid not null references academy_members(id) on delete cascade,
  runs              integer not null default 0,
  balls             integer not null default 0,
  fours             integer not null default 0,
  sixes             integer not null default 0,
  is_out            boolean not null default false,
  dismissal_type    text,
  batting_order     integer,
  created_at        timestamptz not null default now(),
  unique (match_id, academy_member_id)
);
create index match_batting_match_idx on match_batting (match_id);

-- ============================================================
-- MATCH BOWLING (bowling scorecard — designed for future spell tracking)
-- ============================================================
create table match_bowling (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  academy_member_id uuid not null references academy_members(id) on delete cascade,
  overs             numeric(4,1) not null default 0,
  maidens           integer not null default 0,
  runs_conceded     integer not null default 0,
  wickets           integer not null default 0,
  wides             integer not null default 0,
  no_balls          integer not null default 0,
  created_at        timestamptz not null default now(),
  unique (match_id, academy_member_id)
);
create index match_bowling_match_idx on match_bowling (match_id);

-- Bowling spells (extensible for per-over ball tracking)
create table match_bowling_spells (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  academy_member_id uuid not null references academy_members(id) on delete cascade,
  start_over        numeric(4,1) not null,
  end_over          numeric(4,1) not null,
  runs_conceded     integer not null default 0,
  wickets           integer not null default 0,
  maidens           integer not null default 0,
  wides             integer not null default 0,
  no_balls          integer not null default 0,
  created_at        timestamptz not null default now()
);
create index match_bowling_spells_match_idx on match_bowling_spells (match_id);

-- ============================================================
-- MATCH FIELDING
-- ============================================================
create table match_fielding (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  academy_member_id uuid not null references academy_members(id) on delete cascade,
  catches           integer not null default 0,
  run_outs          integer not null default 0,
  stumpings         integer not null default 0,
  created_at        timestamptz not null default now(),
  unique (match_id, academy_member_id)
);
create index match_fielding_match_idx on match_fielding (match_id);

-- ============================================================
-- MATCH PARTNERSHIPS
-- ============================================================
create table match_partnerships (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  batter_1_id       uuid not null references academy_members(id) on delete cascade,
  batter_2_id       uuid not null references academy_members(id) on delete cascade,
  runs_added        integer not null,
  wicket_number     integer,
  created_at        timestamptz not null default now()
);
create index match_partnerships_match_idx on match_partnerships (match_id);

-- ============================================================
-- MATCH AWARDS
-- ============================================================
create table match_awards (
  id                    uuid primary key default gen_random_uuid(),
  match_id              uuid not null references matches(id) on delete cascade,
  player_of_match_id    uuid references academy_members(id),
  best_batter_id        uuid references academy_members(id),
  best_bowler_id        uuid references academy_members(id),
  best_fielder_id       uuid references academy_members(id),
  created_at            timestamptz not null default now(),
  unique (match_id)
);
create index match_awards_match_idx on match_awards (match_id);

-- ============================================================
-- MATCH COACH NOTES (per-player notes)
-- ============================================================
create table match_coach_notes (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  academy_member_id uuid not null references academy_members(id) on delete cascade,
  coach_id          uuid references academy_members(id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (match_id, academy_member_id)
);
create index match_coach_notes_match_idx on match_coach_notes (match_id);
create index match_coach_notes_player_idx on match_coach_notes (academy_member_id);

create trigger match_coach_notes_set_updated_at
  before update on match_coach_notes
  for each row execute function set_updated_at();
