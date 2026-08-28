-- ============================================================
-- FUNCTION: my_player_id
-- Returns the academy_members.id for the current auth user
-- within the supplied academy.
-- ============================================================
create or replace function my_player_id(p_academy uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from academy_members
  where academy_id = p_academy
    and user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

grant execute on function my_player_id(uuid) to authenticated;
-- ============================================================
-- Match Management Module: RLS policies + save_match_result RPC

-- ============================================================
-- RLS POLICIES (matches & related tables)
-- ============================================================
alter table matches enable row level security;
alter table match_lineups enable row level security;
alter table match_batting enable row level security;
alter table match_bowling enable row level security;
alter table match_bowling_spells enable row level security;
alter table match_fielding enable row level security;
alter table match_partnerships enable row level security;
alter table match_awards enable row level security;
alter table match_coach_notes enable row level security;
alter table player_statistics enable row level security;
alter table player_milestones enable row level security;
alter table academy_records enable row level security;

-- matches: members read, staff write
create policy matches_select on matches for select using (is_member(academy_id));
create policy matches_write on matches for all using (is_staff(academy_id)) with check (is_staff(academy_id));

-- Sub-tables only have match_id (no academy_id). Resolve the academy via matches (see 0017) so policies never reference a nonexistent academy_id column.
create policy match_lineups_select on match_lineups for select using (exists (select 1 from matches m where m.id = match_lineups.match_id and is_member(m.academy_id)));
create policy match_lineups_write on match_lineups for all using (exists (select 1 from matches m where m.id = match_lineups.match_id and is_staff(m.academy_id))) with check (exists (select 1 from matches m where m.id = match_lineups.match_id and is_staff(m.academy_id)));

create policy match_batting_select on match_batting for select using (exists (select 1 from matches m where m.id = match_batting.match_id and (is_member(m.academy_id) or match_batting.academy_member_id = my_player_id(m.academy_id))));
create policy match_batting_write on match_batting for all using (exists (select 1 from matches m where m.id = match_batting.match_id and is_staff(m.academy_id))) with check (exists (select 1 from matches m where m.id = match_batting.match_id and is_staff(m.academy_id)));

create policy match_bowling_select on match_bowling for select using (exists (select 1 from matches m where m.id = match_bowling.match_id and (is_member(m.academy_id) or match_bowling.academy_member_id = my_player_id(m.academy_id))));
create policy match_bowling_write on match_bowling for all using (exists (select 1 from matches m where m.id = match_bowling.match_id and is_staff(m.academy_id))) with check (exists (select 1 from matches m where m.id = match_bowling.match_id and is_staff(m.academy_id)));

create policy match_bowling_spells_select on match_bowling_spells for select using (exists (select 1 from matches m where m.id = match_bowling_spells.match_id and is_member(m.academy_id)));
create policy match_bowling_spells_write on match_bowling_spells for all using (exists (select 1 from matches m where m.id = match_bowling_spells.match_id and is_staff(m.academy_id))) with check (exists (select 1 from matches m where m.id = match_bowling_spells.match_id and is_staff(m.academy_id)));

create policy match_fielding_select on match_fielding for select using (exists (select 1 from matches m where m.id = match_fielding.match_id and (is_member(m.academy_id) or match_fielding.academy_member_id = my_player_id(m.academy_id))));
create policy match_fielding_write on match_fielding for all using (exists (select 1 from matches m where m.id = match_fielding.match_id and is_staff(m.academy_id))) with check (exists (select 1 from matches m where m.id = match_fielding.match_id and is_staff(m.academy_id)));

create policy match_partnerships_select on match_partnerships for select using (exists (select 1 from matches m where m.id = match_partnerships.match_id and is_member(m.academy_id)));
create policy match_partnerships_write on match_partnerships for all using (exists (select 1 from matches m where m.id = match_partnerships.match_id and is_staff(m.academy_id))) with check (exists (select 1 from matches m where m.id = match_partnerships.match_id and is_staff(m.academy_id)));

create policy match_awards_select on match_awards for select using (exists (select 1 from matches m where m.id = match_awards.match_id and is_member(m.academy_id)));
create policy match_awards_write on match_awards for all using (exists (select 1 from matches m where m.id = match_awards.match_id and is_staff(m.academy_id))) with check (exists (select 1 from matches m where m.id = match_awards.match_id and is_staff(m.academy_id)));

create policy match_coach_notes_select on match_coach_notes for select using (exists (select 1 from matches m where m.id = match_coach_notes.match_id and is_member(m.academy_id)));
create policy match_coach_notes_write on match_coach_notes for all using (exists (select 1 from matches m where m.id = match_coach_notes.match_id and is_staff(m.academy_id))) with check (exists (select 1 from matches m where m.id = match_coach_notes.match_id and is_staff(m.academy_id)));

create policy player_stats_select on player_statistics for select using (is_staff(academy_id) or player_id = my_player_id(academy_id));
create policy player_stats_write on player_statistics for all using (is_owner(academy_id) or is_super_admin()) with check (true);

create policy player_milestones_select on player_milestones for select using (is_staff(academy_id) or player_id = my_player_id(academy_id));
create policy player_milestones_write on player_milestones for all using (is_owner(academy_id) or is_super_admin()) with check (true);

create policy academy_records_select on academy_records for select using (is_member(academy_id));
create policy academy_records_write on academy_records for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- ============================================================
-- FUNCTION: record_academy_record
-- Updates an academy record if the current match sets a new benchmark.
-- ============================================================
create or replace function record_academy_record(
  p_academy uuid,
  p_record record_type,
  p_player   uuid,
  p_match    uuid,
  p_value_num numeric,
  p_value_txt text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_value_num is null and p_value_txt is null then
    return;
  end if;

  -- Try to insert a new record holder.
  begin
    insert into academy_records (academy_id, record_type, player_id, match_id, value_numeric, value_text)
    values (p_academy, p_record, p_player, p_match, p_value_num, p_value_txt);
  exception
    when unique_violation then
      -- Record exists — compare and potentially upgrade.
      if p_value_num is not null then
        update academy_records
        set player_id = p_player, match_id = p_match, value_numeric = p_value_num, value_text = p_value_txt, achieved_at = now()
        where academy_id = p_academy and record_type = p_record
          and (value_numeric is null or p_value_num > value_numeric);
      end if;
  end;
end $$;

-- ============================================================
-- FUNCTION: detect_player_milestones
-- Checks career totals after a match and inserts any newly-achieved milestones.
-- p_career_* are the player's NEW cumulative totals (after this match).
-- ============================================================
create or replace function detect_player_milestones(
  p_academy  uuid,
  p_player   uuid,
  p_match    uuid,
  p_matches_played integer,
  p_batting_runs   integer,
  p_bowling_wickets integer,
  p_fielding_catches integer,
  p_match_runs     integer,
  p_match_wickets  integer
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  -- Debut match: first completed match where player appeared
  if p_matches_played = 1 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'debut_match';
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'debut_match', p_match);
    end if;
  end if;

  -- First fifty (50+ runs in a single match)
  if p_match_runs >= 50 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'first_fifty';
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'first_fifty', p_match);
    end if;
  end if;

  -- First century (100+ runs in a single match)
  if p_match_runs >= 100 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'first_century';
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'first_century', p_match);
    end if;
  end if;

  -- First five-wicket haul (5+ wickets in a single match)
  if p_match_wickets >= 5 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'first_five_wicket_haul';
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'first_five_wicket_haul', p_match);
    end if;
  end if;

  -- 100 career runs
  if p_batting_runs >= 100 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'runs_100';
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'runs_100', p_match);
    end if;
  end if;

  -- 500 career runs
  if p_batting_runs >= 500 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'runs_500';
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'runs_500', p_match);
    end if;
  end if;

  -- 1000 career runs
  if p_batting_runs >= 1000 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'runs_1000';
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'runs_1000', p_match);
    end if;
  end if;

  -- 50 career wickets
  if p_bowling_wickets >= 50 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'wickets_50';
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'wickets_50', p_match);
    end if;
  end if;

  -- 100 career wickets
  if p_bowling_wickets >= 100 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'wickets_100';
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'wickets_100', p_match);
    end if;
  end if;

  -- 25 career catches
  if p_fielding_catches >= 25 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'catches_25';
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'catches_25', p_match);
    end if;
  end if;
end $$;

-- ============================================================
-- ============================================================
-- FUNCTION: cricket_overs_to_decimal
-- Converts cricket overs notation (e.g. 4.2 = 4 overs + 2 balls)
-- to true decimal overs so economy and related stats are accurate.
-- ============================================================
create or replace function cricket_overs_to_decimal(p_overs numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_overs is null then null
    else floor(p_overs) + ((p_overs - floor(p_overs)) * 10.0 / 6.0)
  end;
$$;

-- ============================================================
-- FUNCTION: refresh_player_statistics
-- Recomputes career statistics for a single player from all
-- completed matches. Also triggers milestone detection.
-- ============================================================
create or replace function refresh_player_statistics(p_academy uuid, p_player uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_stats jsonb;
  v_matches_played integer;
  v_batting_runs integer;
  v_fielding_catches integer;
  v_match_runs integer;
  v_match_wickets integer;
  v_match_id uuid;
  v_best_bowling text;
  -- 0016 fix: the *_dummy SELECT INTO targets used below were never declared,
  -- which raised PL/pgSQL errors (this made the whole match RPC unusable).
  v_batting_innings_dummy integer;
  v_batting_highest_dummy integer;
  v_batting_not_outs_dummy integer;
  v_batting_fifties_dummy integer;
  v_batting_centuries_dummy integer;
  v_batting_fours_dummy integer;
  v_batting_sixes_dummy integer;
  v_balls_faced_dummy integer;
  v_bowling_innings_dummy integer;
  v_bowling_overs_dummy numeric(6,1);
  v_bowling_maidens_dummy integer;
  v_bowling_runs_dummy integer;
  v_bowling_wickets_dummy integer;
  v_fielding_catches_dummy integer;
  v_fielding_run_outs_dummy integer;
  v_fielding_stumpings_dummy integer;
  v_awards_pom_dummy integer;
  v_awards_best_batter_dummy integer;
  v_awards_best_bowler_dummy integer;
  v_awards_best_fielder_dummy integer;
begin
  -- Aggregate batting stats from all completed matches where the player batted
  select
    coalesce(sum(mb.runs), 0),
    count(*),
    coalesce(max(mb.runs), 0),
    count(*) filter (where not mb.is_out),
    coalesce(sum(mb.fours), 0),
    coalesce(sum(mb.sixes), 0),
    coalesce(sum(mb.balls), 0),
    count(*) filter (where mb.runs >= 50 and mb.runs < 100),
    count(*) filter (where mb.runs >= 100)
  into v_batting_runs, v_batting_innings_dummy, v_batting_highest_dummy, v_batting_not_outs_dummy,
       v_batting_fours_dummy, v_batting_sixes_dummy, v_balls_faced_dummy,
       v_batting_fifties_dummy, v_batting_centuries_dummy
  from match_batting mb
  join matches m on m.id = mb.match_id
  where mb.academy_member_id = p_player and m.academy_id = p_academy and m.status = 'completed';
  v_batting_runs := coalesce(v_batting_runs, 0);

  -- Aggregate bowling stats (convert cricket overs notation to decimal for economy)
  select
    count(*),
    round(coalesce(sum(cricket_overs_to_decimal(b.overs)), 0)::numeric, 1),
    coalesce(sum(b.maidens), 0),
    coalesce(sum(b.runs_conceded), 0),
    coalesce(sum(b.wickets), 0)
  into v_bowling_innings_dummy, v_bowling_overs_dummy, v_bowling_maidens_dummy,
       v_bowling_runs_dummy, v_bowling_wickets_dummy
  from match_bowling b
  join matches m on m.id = b.match_id
  where b.academy_member_id = p_player and m.academy_id = p_academy and m.status = 'completed';

  -- Best bowling: most wickets, tie-break by fewer runs
  select b.wickets || '/' || b.runs_conceded
  into v_best_bowling
  from match_bowling b
  join matches m on m.id = b.match_id
  where b.academy_member_id = p_player and m.academy_id = p_academy and m.status = 'completed' and b.wickets > 0
  order by b.wickets desc, b.runs_conceded asc
  limit 1;

  -- Aggregate fielding stats
  select
    coalesce(sum(f.catches), 0),
    coalesce(sum(f.run_outs), 0),
    coalesce(sum(f.stumpings), 0)
  into v_fielding_catches_dummy, v_fielding_run_outs_dummy, v_fielding_stumpings_dummy
  from match_fielding f
  join matches m on m.id = f.match_id
  where f.academy_member_id = p_player and m.academy_id = p_academy and m.status = 'completed';

  -- Matches played (distinct completed matches where player was in lineup or had stats)
  select count(distinct m.id)
  into v_matches_played
  from (
    select m.id from match_lineups ml join matches m on m.id = ml.match_id
     where ml.academy_member_id = p_player and m.academy_id = p_academy and m.status = 'completed'
    union
    select m.id from match_batting mb join matches m on m.id = mb.match_id
     where mb.academy_member_id = p_player and m.academy_id = p_academy and m.status = 'completed'
    union
    select m.id from match_fielding mf join matches m on m.id = mf.match_id
     where mf.academy_member_id = p_player and m.academy_id = p_academy and m.status = 'completed'
  ) m;

  -- Awards counts (restricted to p_academy — awards from other academies must not leak)
  select
    coalesce(sum(case when ma.player_of_match_id = p_player then 1 else 0 end), 0),
    coalesce(sum(case when ma.best_batter_id = p_player then 1 else 0 end), 0),
    coalesce(sum(case when ma.best_bowler_id = p_player then 1 else 0 end), 0),
    coalesce(sum(case when ma.best_fielder_id = p_player then 1 else 0 end), 0)
  into v_awards_pom_dummy, v_awards_best_batter_dummy, v_awards_best_bowler_dummy, v_awards_best_fielder_dummy
  from match_awards ma
  join matches m on m.id = ma.match_id
  where m.academy_id = p_academy and m.status = 'completed';

  -- Upsert player_statistics
  insert into player_statistics (
    academy_id, player_id, matches_played,
    batting_innings, batting_runs, batting_highest_score, batting_not_outs,
    batting_fifties, batting_centuries, batting_fours, batting_sixes, balls_faced_sum,
    bowling_innings, bowling_overs, bowling_maidens, bowling_runs_conceded, bowling_wickets, bowling_best_bowling,
    fielding_catches, fielding_run_outs, fielding_stumpings,
    awards_player_of_match, awards_best_batter, awards_best_bowler, awards_best_fielder
  ) values (
    p_academy, p_player, v_matches_played,
    v_batting_innings_dummy, v_batting_runs, v_batting_highest_dummy, v_batting_not_outs_dummy,
    v_batting_fifties_dummy, v_batting_centuries_dummy, v_batting_fours_dummy, v_batting_sixes_dummy, v_balls_faced_dummy,
    v_bowling_innings_dummy, v_bowling_overs_dummy, v_bowling_maidens_dummy, v_bowling_runs_dummy, v_bowling_wickets_dummy, v_best_bowling,
    v_fielding_catches_dummy, v_fielding_run_outs_dummy, v_fielding_stumpings_dummy,
    v_awards_pom_dummy, v_awards_best_batter_dummy, v_awards_best_bowler_dummy, v_awards_best_fielder_dummy
  )
  on conflict (academy_id, player_id) do update set
    matches_played = excluded.matches_played,
    batting_innings = excluded.batting_innings,
    batting_runs = excluded.batting_runs,
    batting_highest_score = excluded.batting_highest_score,
    batting_not_outs = excluded.batting_not_outs,
    batting_fifties = excluded.batting_fifties,
    batting_centuries = excluded.batting_centuries,
    batting_fours = excluded.batting_fours,
    batting_sixes = excluded.batting_sixes,
    balls_faced_sum = excluded.balls_faced_sum,
    bowling_innings = excluded.bowling_innings,
    bowling_overs = excluded.bowling_overs,
    bowling_maidens = excluded.bowling_maidens,
    bowling_runs_conceded = excluded.bowling_runs_conceded,
    bowling_wickets = excluded.bowling_wickets,
    bowling_best_bowling = excluded.bowling_best_bowling,
    fielding_catches = excluded.fielding_catches,
    fielding_run_outs = excluded.fielding_run_outs,
    fielding_stumpings = excluded.fielding_stumpings,
    awards_player_of_match = excluded.awards_player_of_match,
    awards_best_batter = excluded.awards_best_batter,
    awards_best_bowler = excluded.awards_best_bowler,
    awards_best_fielder = excluded.awards_best_fielder;

  -- Find the latest completed match for this player to attribute milestones
  select m.id into v_match_id
  from matches m
  join match_lineups ml on ml.match_id = m.id
  where ml.academy_member_id = p_player and m.status = 'completed'
  order by m.match_date desc limit 1;

  -- Per-match data for the latest match (for first_fifty/century/haul milestones)
  select coalesce(mb.runs, 0) into v_match_runs
  from match_batting mb where mb.match_id = v_match_id and mb.academy_member_id = p_player;
  select coalesce(b.wickets, 0) into v_match_wickets
  from match_bowling b where b.match_id = v_match_id and b.academy_member_id = p_player;

  -- Detect milestones
  perform detect_player_milestones(
    p_academy, p_player, v_match_id,
    v_matches_played, v_batting_runs, v_bowling_wickets_dummy,
    v_fielding_catches_dummy, v_match_runs, v_match_wickets
  );

  v_stats := jsonb_build_object(
    'matches_played', v_matches_played,
    'batting_runs', v_batting_runs,
    'bowling_wickets', v_bowling_wickets_dummy,
    'fielding_catches', v_fielding_catches_dummy
  );
  return v_stats;
end $$;

-- ============================================================
-- RPC: save_match_result (primary entry point for completing a match)
-- ============================================================
create or replace function save_match_result(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academy_id     uuid;
  v_match          jsonb;
  v_match_id       uuid;
  v_lineups        jsonb;
  v_batting        jsonb;
  v_bowling        jsonb;
  v_fielding       jsonb;
  v_partnerships   jsonb;
  v_awards         jsonb;
  v_notes          jsonb;
  rec              record;
  v_player_id      uuid;
begin
  v_academy_id := (p_payload->>'academy_id')::uuid;
  v_match      := p_payload->'match';
  v_lineups    := p_payload->'lineups';
  v_batting    := p_payload->'batting';
  v_bowling    := p_payload->'bowling';
  v_fielding   := p_payload->'fielding';
  v_partnerships := p_payload->'partnerships';
  v_awards     := p_payload->'awards';
  v_notes      := p_payload->'notes';

  -- 1. Create or update the match record
  if v_match ? 'id' and v_match->>'id' is not null then
    v_match_id := (v_match->>'id')::uuid;
    update matches set
      match_name = v_match->>'match_name',
      match_date = (v_match->>'match_date')::date,
      venue = v_match->>'venue',
      opponent_name = v_match->>'opponent_name',
      tournament = v_match->>'tournament',
      match_type = v_match->>'match_type',
      format = v_match->>'format',
      overs = cricket_overs_to_decimal((v_match->>'overs')::numeric(4,1)),
      team_score = v_match->>'team_score',
      wickets_lost = (v_match->>'wickets_lost')::integer,
      overs_played = cricket_overs_to_decimal((v_match->>'overs_played')::numeric(4,1)),
      result = v_match->>'result',
      winning_margin = v_match->>'winning_margin',
      batch_id = nullif(v_match->>'batch_id', '')::uuid,
      status = 'completed',
      updated_at = now()
    where id = v_match_id and academy_id = v_academy_id;
  else
    insert into matches (
      academy_id, match_name, match_date, venue, opponent_name, tournament,
      match_type, format, overs, team_score, wickets_lost, overs_played,
      result, winning_margin, batch_id, status, created_by
    ) values (
      v_academy_id, v_match->>'match_name', (v_match->>'match_date')::date,
      v_match->>'venue', v_match->>'opponent_name', v_match->>'tournament',
      v_match->>'match_type', v_match->>'format', cricket_overs_to_decimal((v_match->>'overs')::numeric(4,1)),
      v_match->>'team_score', (v_match->>'wickets_lost')::integer,
      cricket_overs_to_decimal((v_match->>'overs_played')::numeric(4,1)), v_match->>'result',
      v_match->>'winning_margin', nullif(v_match->>'batch_id', '')::uuid,
      'completed', auth.uid()
    ) returning id into v_match_id;
  end if;

  -- 2. Save lineups (clear + reinsert for idempotency)
  if v_lineups is not null and v_lineups != '[]'::jsonb then
    delete from match_lineups where match_id = v_match_id;
    for rec in select * from jsonb_to_recordset(v_lineups)
      as x(academy_member_id uuid, batting_order integer, is_captain boolean, is_vice_captain boolean, is_wicketkeeper boolean)
    loop
      insert into match_lineups (match_id, academy_member_id, batting_order, is_captain, is_vice_captain, is_wicketkeeper)
      values (v_match_id, rec.academy_member_id, rec.batting_order, rec.is_captain, rec.is_vice_captain, rec.is_wicketkeeper);
    end loop;
  end if;

  -- 3. Save batting scorecard
  if v_batting is not null and v_batting != '[]'::jsonb then
    delete from match_batting where match_id = v_match_id;
    for rec in select * from jsonb_to_recordset(v_batting)
      as x(academy_member_id uuid, runs integer, balls integer, fours integer, sixes integer,
           is_out boolean, dismissal_type text, batting_order integer)
    loop
      insert into match_batting (match_id, academy_member_id, runs, balls, fours, sixes, is_out, dismissal_type, batting_order)
      values (v_match_id, rec.academy_member_id, rec.runs, rec.balls, rec.fours, rec.sixes,
              rec.is_out, rec.dismissal_type, rec.batting_order);
    end loop;
  end if;

  -- 4. Save bowling scorecard
  if v_bowling is not null and v_bowling != '[]'::jsonb then
    delete from match_bowling where match_id = v_match_id;
    for rec in select * from jsonb_to_recordset(v_bowling)
      as x(academy_member_id uuid, overs numeric(4,1), maidens integer, runs_conceded integer,
           wickets integer, wides integer, no_balls integer)
    loop
      insert into match_bowling (match_id, academy_member_id, overs, maidens, runs_conceded, wickets, wides, no_balls)
      values (v_match_id, rec.academy_member_id, rec.overs, rec.maidens, rec.runs_conceded,
              rec.wickets, rec.wides, rec.no_balls);
    end loop;
  end if;

  -- 5. Save fielding
  if v_fielding is not null and v_fielding != '[]'::jsonb then
    delete from match_fielding where match_id = v_match_id;
    for rec in select * from jsonb_to_recordset(v_fielding)
      as x(academy_member_id uuid, catches integer, run_outs integer, stumpings integer)
    loop
      insert into match_fielding (match_id, academy_member_id, catches, run_outs, stumpings)
      values (v_match_id, rec.academy_member_id, rec.catches, rec.run_outs, rec.stumpings);
    end loop;
  end if;

  -- 6. Save partnerships
  if v_partnerships is not null and v_partnerships != '[]'::jsonb then
    delete from match_partnerships where match_id = v_match_id;
    for rec in select * from jsonb_to_recordset(v_partnerships)
      as x(batter_1_id uuid, batter_2_id uuid, runs_added integer, wicket_number integer)
    loop
      insert into match_partnerships (match_id, batter_1_id, batter_2_id, runs_added, wicket_number)
      values (v_match_id, rec.batter_1_id, rec.batter_2_id, rec.runs_added, rec.wicket_number);
    end loop;
  end if;

  -- 7. Save awards
  if v_awards is not null then
    insert into match_awards (match_id, player_of_match_id, best_batter_id, best_bowler_id, best_fielder_id)
    values (v_match_id,
            (v_awards->>'player_of_match_id')::uuid,
            (v_awards->>'best_batter_id')::uuid,
            (v_awards->>'best_bowler_id')::uuid,
            (v_awards->>'best_fielder_id')::uuid)
    on conflict (match_id) do update set
      player_of_match_id = excluded.player_of_match_id,
      best_batter_id = excluded.best_batter_id,
      best_bowler_id = excluded.best_bowler_id,
      best_fielder_id = excluded.best_fielder_id;
  end if;

  -- 8. Save coach notes
  if v_notes is not null and v_notes != '[]'::jsonb then
    for rec in select * from jsonb_to_recordset(v_notes)
      as x(academy_member_id uuid, coach_id uuid, notes text)
    loop
      insert into match_coach_notes (match_id, academy_member_id, coach_id, notes)
      values (v_match_id, rec.academy_member_id, rec.coach_id, rec.notes)
      on conflict (match_id, academy_member_id) do update set
        coach_id = excluded.coach_id, notes = excluded.notes, updated_at = now();
    end loop;
  end if;

  -- 9. Refresh player statistics for all involved players
  for v_player_id in
    select distinct pm.academy_member_id
    from (
      select academy_member_id from match_lineups where match_id = v_match_id
      union select academy_member_id from match_batting where match_id = v_match_id
      union select academy_member_id from match_bowling where match_id = v_match_id
      union select academy_member_id from match_fielding where match_id = v_match_id
    ) pm
  loop
    perform refresh_player_statistics(v_academy_id, v_player_id);
  end loop;

  -- 10. Update academy records based on this match
  -- Team score records
  if v_match->>'team_score' is not null and v_match->>'team_score' != '' then
    perform record_academy_record(
      v_academy_id, 'most_runs_one_match',
      (select academy_member_id from match_batting where match_id = v_match_id order by runs desc limit 1),
      v_match_id,
      (select max(runs) from match_batting where match_id = v_match_id),
      null
    );
  end if;

  -- Most wickets in one match
  perform record_academy_record(
    v_academy_id, 'most_wickets_one_match',
    (select academy_member_id from match_bowling where match_id = v_match_id order by wickets desc, runs_conceded asc limit 1),
    v_match_id,
    (select max(wickets) from match_bowling where match_id = v_match_id),
    null
  );

  -- Most sixes in one match
  perform record_academy_record(
    v_academy_id, 'most_sixes',
    (select academy_member_id from match_batting where match_id = v_match_id order by sixes desc limit 1),
    v_match_id,
    (select max(sixes) from match_batting where match_id = v_match_id),
    null
  );

  -- Most fours in one match
  perform record_academy_record(
    v_academy_id, 'most_fours',
    (select academy_member_id from match_batting where match_id = v_match_id order by fours desc limit 1),
    v_match_id,
    (select max(fours) from match_batting where match_id = v_match_id),
    null
  );

  -- Highest partnership
  perform record_academy_record(
    v_academy_id, 'highest_partnership',
    null,
    v_match_id,
    (select max(runs_added) from match_partnerships where match_id = v_match_id),
    null
  );

  return jsonb_build_object('match_id', v_match_id, 'academy_id', v_academy_id, 'status', 'completed');
end;
$$;

-- ============================================================
-- FUNCTION: refresh_academy_records (recompute all records for an academy)
-- Useful when matches are edited or for initial backfill.
-- ============================================================
create or replace function refresh_academy_records(p_academy uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Highest team score
  perform record_academy_record(
    p_academy, 'highest_team_score',
    null,
    null,
    (select max((split_part(team_score, '/', 1))::integer) from matches
     where academy_id = p_academy and status = 'completed' and team_score is not null
     and split_part(team_score, '/', 1) ~ '^[0-9]+$'),
    null
  );

  -- Lowest team score
  perform record_academy_record(
    p_academy, 'lowest_team_score',
    null,
    null,
    (select min((split_part(team_score, '/', 1))::integer) from matches
     where academy_id = p_academy and status = 'completed' and team_score is not null
     and split_part(team_score, '/', 1) ~ '^[0-9]+$'),
    null
  );

  -- Biggest victory (max runs in winning_margin string - simplified)
  perform record_academy_record(
    p_academy, 'biggest_victory',
    null,
    (select id from matches where academy_id = p_academy and status = 'completed' and result = 'won'
     order by match_date desc limit 1),
    null,
    (select winning_margin from matches
     where academy_id = p_academy and status = 'completed' and result = 'won'
     order by match_date desc limit 1)
  );

  -- Highest successful chase (highest team_score where result = 'won')
  perform record_academy_record(
    p_academy, 'highest_successful_chase',
    null,
    null,
    (select max((split_part(team_score, '/', 1))::integer) from matches
     where academy_id = p_academy and status = 'completed' and result = 'won' and team_score is not null
     and split_part(team_score, '/', 1) ~ '^[0-9]+$'),
    null
  );
end $$;
