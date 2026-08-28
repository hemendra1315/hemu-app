-- ============================================================================
-- Migration 0030: Security hardening (adversarial audit follow-up)
--
-- Fixes privilege-escalation and cross-tenant write paths identified during a
-- production audit of migrations 0001-0029:
--   1. profiles_update_self let any user set is_super_admin = true on their
--      own row (is_super_admin() reads that column) -> full platform takeover.
--   2. player_statistics / player_milestones write policies used
--      WITH CHECK (true) -> any user could insert/update rows for ANY academy.
--   3. Ranking views were not SECURITY INVOKER -> every academy's players were
--      readable through PostgREST by any authenticated user.
--   4. record_academy_record / detect_player_milestones / refresh_player_statistics
--      / refresh_academy_records were SECURITY DEFINER, granted to authenticated,
--      with no authorization check -> arbitrary writes to any academy.
--   5. save_match_result() UPDATE path re-inserted scorecard rows for a match id
--      without confirming that match belongs to the payload academy -> a staff
--      member could overwrite another academy's match data.
--   6. join_requests_cancel_own let the requester change requested_role to
--      'coach' on a pending request -> role escalation on approval.
--   7. cricheroes_player_mappings RLS allowed direct table writes by any
--      member (including players) and ignored member status.
--   8. Revoked PUBLIC EXECUTE on the internal statistics RPCs (client should
--      only ever call save_match_result / refresh_academy_records).
-- ============================================================================

-- ---------------------------------------------------------------- profiles --
-- Block privileged-column changes by anyone who is not themselves a super admin.
-- RLS cannot compare OLD vs NEW rows, so this is enforced in a trigger. The
-- check only applies to authenticated (non-null auth.uid()) callers so that
-- server-side contexts (handle_new_user, service role, migrations) keep working.
-- is_super_admin() is SECURITY DEFINER and reads the caller's own row, so it
-- cannot be fooled by a partial self-update.
create or replace function protect_profiles_privileged_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and (new.is_super_admin is distinct from old.is_super_admin
          or new.id is distinct from old.id)
     and not is_super_admin() then
    raise exception 'E_FORBIDDEN: Only a super admin may change privileged profile columns'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists profiles_privileged_columns_guard on profiles;
create trigger profiles_privileged_columns_guard
  before update on profiles
  for each row execute function protect_profiles_privileged_columns();

-- ------------------------------------------------- stats / milestones RLS --
-- WITH CHECK must mirror USING so writes can never escape the caller's academy.
drop policy if exists player_stats_write on player_statistics;
create policy player_stats_write on player_statistics for all
  using (is_owner(academy_id) or is_super_admin())
  with check (is_owner(academy_id) or is_super_admin());

drop policy if exists player_milestones_write on player_milestones;
create policy player_milestones_write on player_milestones for all
  using (is_owner(academy_id) or is_super_admin())
  with check (is_owner(academy_id) or is_super_admin());

-- ------------------------------------------------------------ ranking views --
-- SECURITY INVOKER re-applies RLS of the underlying tables to the caller, so a
-- member of academy A can never see academy B's players/stats through the views.
create or replace view v_batting_rankings
with (security_invoker = true) as
  select
    ps.academy_id,
    ps.player_id,
    am.user_id,
    p.full_name,
    p.avatar_url,
    ps.batting_runs,
    ps.batting_innings,
    ps.batting_highest_score,
    case
      when (ps.batting_innings - ps.batting_not_outs) > 0
        then round(ps.batting_runs::numeric / (ps.batting_innings - ps.batting_not_outs), 2)
      when ps.batting_innings > 0
        then ps.batting_runs::numeric
      else 0
    end as batting_average,
    case
      when ps.balls_faced_sum > 0
        then round(100.0 * ps.batting_runs / ps.balls_faced_sum, 2)
      else 0
    end as strike_rate_placeholder,
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

create or replace view v_bowling_rankings
with (security_invoker = true) as
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

create or replace view v_fielding_rankings
with (security_invoker = true) as
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

create or replace view v_overall_rankings
with (security_invoker = true) as
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

-- ------------------------------------------- internal statistics RPC guards --
-- These are SECURITY DEFINER. Callers that run with auth.uid() = NULL (migrations,
-- service role, internal RPC chains such as save_match_result -> refresh_player_statistics)
-- must keep working, so only reject an explicit non-staff authenticated caller.
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
  if auth.uid() is not null and not is_staff(p_academy) then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;

  if p_value_num is null and p_value_txt is null then
    return;
  end if;

  begin
    insert into academy_records (academy_id, record_type, player_id, match_id, value_numeric, value_text)
    values (p_academy, p_record, p_player, p_match, p_value_num, p_value_txt);
  exception
    when unique_violation then
      if p_value_num is not null then
        update academy_records
        set player_id = p_player, match_id = p_match, value_numeric = p_value_num, value_text = p_value_txt, achieved_at = now()
        where academy_id = p_academy and record_type = p_record
          and (value_numeric is null or p_value_num > value_numeric);
      end if;
  end;
end $$;

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
  if auth.uid() is not null and not is_staff(p_academy) then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;

  if p_matches_played = 1 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'debut_match' and academy_id = p_academy;
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'debut_match', p_match);
    end if;
  end if;

  if p_match_runs >= 50 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'first_fifty' and academy_id = p_academy;
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'first_fifty', p_match);
    end if;
  end if;

  if p_match_runs >= 100 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'first_century' and academy_id = p_academy;
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'first_century', p_match);
    end if;
  end if;

  if p_match_wickets >= 5 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'first_five_wicket_haul' and academy_id = p_academy;
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'first_five_wicket_haul', p_match);
    end if;
  end if;

  if p_batting_runs >= 100 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'runs_100' and academy_id = p_academy;
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'runs_100', p_match);
    end if;
  end if;

  if p_batting_runs >= 500 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'runs_500' and academy_id = p_academy;
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'runs_500', p_match);
    end if;
  end if;

  if p_batting_runs >= 1000 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'runs_1000' and academy_id = p_academy;
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'runs_1000', p_match);
    end if;
  end if;

  if p_bowling_wickets >= 50 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'wickets_50' and academy_id = p_academy;
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'wickets_50', p_match);
    end if;
  end if;

  if p_bowling_wickets >= 100 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'wickets_100' and academy_id = p_academy;
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'wickets_100', p_match);
    end if;
  end if;

  if p_fielding_catches >= 25 then
    select 1 into v_count from player_milestones where player_id = p_player and milestone_type = 'catches_25' and academy_id = p_academy;
    if v_count is null then
      insert into player_milestones (academy_id, player_id, milestone_type, match_id)
      values (p_academy, p_player, 'catches_25', p_match);
    end if;
  end if;
end $$;

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
  if auth.uid() is not null and not is_staff(p_academy) then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;

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

  select b.wickets || '/' || b.runs_conceded
  into v_best_bowling
  from match_bowling b
  join matches m on m.id = b.match_id
  where b.academy_member_id = p_player and m.academy_id = p_academy and m.status = 'completed' and b.wickets > 0
  order by b.wickets desc, b.runs_conceded asc
  limit 1;

  select
    coalesce(sum(f.catches), 0),
    coalesce(sum(f.run_outs), 0),
    coalesce(sum(f.stumpings), 0)
  into v_fielding_catches_dummy, v_fielding_run_outs_dummy, v_fielding_stumpings_dummy
  from match_fielding f
  join matches m on m.id = f.match_id
  where f.academy_member_id = p_player and m.academy_id = p_academy and m.status = 'completed';

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

  select
    coalesce(sum(case when ma.player_of_match_id = p_player then 1 else 0 end), 0),
    coalesce(sum(case when ma.best_batter_id = p_player then 1 else 0 end), 0),
    coalesce(sum(case when ma.best_bowler_id = p_player then 1 else 0 end), 0),
    coalesce(sum(case when ma.best_fielder_id = p_player then 1 else 0 end), 0)
  into v_awards_pom_dummy, v_awards_best_batter_dummy, v_awards_best_bowler_dummy, v_awards_best_fielder_dummy
  from match_awards ma
  join matches m on m.id = ma.match_id
  where m.academy_id = p_academy and m.status = 'completed';

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

  select m.id into v_match_id
  from matches m
  join match_lineups ml on ml.match_id = m.id
  where ml.academy_member_id = p_player and m.academy_id = p_academy and m.status = 'completed'
  order by m.match_date desc limit 1;

  select coalesce(mb.runs, 0) into v_match_runs
  from match_batting mb where mb.match_id = v_match_id and mb.academy_member_id = p_player;
  select coalesce(b.wickets, 0) into v_match_wickets
  from match_bowling b where b.match_id = v_match_id and b.academy_member_id = p_player;

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

create or replace function refresh_academy_records(p_academy uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_staff(p_academy) then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;

  perform record_academy_record(
    p_academy, 'highest_team_score',
    null,
    null,
    (select max((split_part(team_score, '/', 1))::integer) from matches
     where academy_id = p_academy and status = 'completed' and team_score is not null
     and split_part(team_score, '/', 1) ~ '^[0-9]+$'),
    null
  );

  perform record_academy_record(
    p_academy, 'lowest_team_score',
    null,
    null,
    (select min((split_part(team_score, '/', 1))::integer) from matches
     where academy_id = p_academy and status = 'completed' and team_score is not null
     and split_part(team_score, '/', 1) ~ '^[0-9]+$'),
    null
  );

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

-- ------------------------------------------------------------------ RPC grants --
-- Only the two client-facing entry points stay exposed. The internal helpers
-- are still executable by postgres (owner), service role, and internal chains.
revoke all on function record_academy_record(uuid, record_type, uuid, uuid, numeric, text) from public, anon, authenticated;
revoke all on function detect_player_milestones(uuid, uuid, uuid, integer, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function refresh_player_statistics(uuid, uuid) from public, anon, authenticated;

grant execute on function refresh_academy_records(uuid) to authenticated;

-- ------------------------------------------- save_match_result cross-academy --
-- Recreate so the UPDATE path can never touch another academy's match: confirm
-- the target match row belongs to v_academy_id before any scorecard writes.
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
  v_owns_match     boolean;
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

  -- Authorization check: caller must be a staff member (owner or coach) of p_academy
  IF NOT is_staff(v_academy_id) THEN
    RAISE EXCEPTION 'E_FORBIDDEN: User is not authorized to save match results for this academy'
      USING errcode = '42501';
  END IF;

  -- 1. Create or update the match record
  IF v_match ? 'id' AND v_match->>'id' IS NOT NULL THEN
    v_match_id := (v_match->>'id')::uuid;

    -- The match must belong to the payload academy, otherwise the caller is
    -- trying to overwrite another academy's scorecard.
    SELECT EXISTS (
      SELECT 1 FROM matches WHERE id = v_match_id AND academy_id = v_academy_id
    ) INTO v_owns_match;

    IF NOT v_owns_match THEN
      RAISE EXCEPTION 'E_FORBIDDEN: Match does not belong to this academy'
        USING errcode = '42501';
    END IF;

    UPDATE matches SET
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
    WHERE id = v_match_id AND academy_id = v_academy_id;
  ELSE
    INSERT INTO matches (
      academy_id, match_name, match_date, venue, opponent_name, tournament,
      match_type, format, overs, team_score, wickets_lost, overs_played,
      result, winning_margin, batch_id, status, created_by
    ) VALUES (
      v_academy_id, v_match->>'match_name', (v_match->>'match_date')::date,
      v_match->>'venue', v_match->>'opponent_name', v_match->>'tournament',
      v_match->>'match_type', v_match->>'format', cricket_overs_to_decimal((v_match->>'overs')::numeric(4,1)),
      v_match->>'team_score', (v_match->>'wickets_lost')::integer,
      cricket_overs_to_decimal((v_match->>'overs_played')::numeric(4,1)), v_match->>'result',
      v_match->>'winning_margin', nullif(v_match->>'batch_id', '')::uuid,
      'completed', auth.uid()
    ) RETURNING id INTO v_match_id;
  END IF;

  -- 2. Save lineups
  IF v_lineups IS NOT NULL AND v_lineups != '[]'::jsonb THEN
    DELETE FROM match_lineups WHERE match_id = v_match_id;
    FOR rec IN SELECT * FROM jsonb_to_recordset(v_lineups)
      AS x(academy_member_id uuid, batting_order integer, is_captain boolean, is_vice_captain boolean, is_wicketkeeper boolean, is_guest boolean, guest_name text)
    LOOP
      INSERT INTO match_lineups (match_id, academy_member_id, batting_order, is_captain, is_vice_captain, is_wicketkeeper, is_guest, guest_name)
      VALUES (v_match_id, rec.academy_member_id, rec.batting_order, coalesce(rec.is_captain, false), coalesce(rec.is_vice_captain, false), coalesce(rec.is_wicketkeeper, false), coalesce(rec.is_guest, false), rec.guest_name);
    END LOOP;
  END IF;

  -- 3. Save batting scorecard
  IF v_batting IS NOT NULL AND v_batting != '[]'::jsonb THEN
    DELETE FROM match_batting WHERE match_id = v_match_id;
    FOR rec IN SELECT * FROM jsonb_to_recordset(v_batting)
      AS x(academy_member_id uuid, runs integer, balls integer, fours integer, sixes integer,
           is_out boolean, dismissal_type text, batting_order integer, is_guest boolean, guest_name text)
    LOOP
      INSERT INTO match_batting (match_id, academy_member_id, runs, balls, fours, sixes, is_out, dismissal_type, batting_order, is_guest, guest_name)
      VALUES (v_match_id, rec.academy_member_id, coalesce(rec.runs, 0), coalesce(rec.balls, 0), coalesce(rec.fours, 0), coalesce(rec.sixes, 0),
              coalesce(rec.is_out, false), rec.dismissal_type, rec.batting_order, coalesce(rec.is_guest, false), rec.guest_name);
    END LOOP;
  END IF;

  -- 4. Save bowling scorecard
  IF v_bowling IS NOT NULL AND v_bowling != '[]'::jsonb THEN
    DELETE FROM match_bowling WHERE match_id = v_match_id;
    FOR rec IN SELECT * FROM jsonb_to_recordset(v_bowling)
      AS x(academy_member_id uuid, overs numeric(4,1), maidens integer, runs_conceded integer,
           wickets integer, wides integer, no_balls integer, is_guest boolean, guest_name text)
    LOOP
      INSERT INTO match_bowling (match_id, academy_member_id, overs, maidens, runs_conceded, wickets, wides, no_balls, is_guest, guest_name)
      VALUES (v_match_id, rec.academy_member_id, coalesce(rec.overs, 0), coalesce(rec.maidens, 0), coalesce(rec.runs_conceded, 0),
              coalesce(rec.wickets, 0), coalesce(rec.wides, 0), coalesce(rec.no_balls, 0), coalesce(rec.is_guest, false), rec.guest_name);
    END LOOP;
  END IF;

  -- 5. Save fielding
  IF v_fielding IS NOT NULL AND v_fielding != '[]'::jsonb THEN
    DELETE FROM match_fielding WHERE match_id = v_match_id;
    FOR rec IN SELECT * FROM jsonb_to_recordset(v_fielding)
      AS x(academy_member_id uuid, catches integer, run_outs integer, stumpings integer, is_guest boolean, guest_name text)
    LOOP
      INSERT INTO match_fielding (match_id, academy_member_id, catches, run_outs, stumpings, is_guest, guest_name)
      VALUES (v_match_id, rec.academy_member_id, coalesce(rec.catches, 0), coalesce(rec.run_outs, 0), coalesce(rec.stumpings, 0), coalesce(rec.is_guest, false), rec.guest_name);
    END LOOP;
  END IF;

  -- 6. Save partnerships
  IF v_partnerships IS NOT NULL AND v_partnerships != '[]'::jsonb THEN
    DELETE FROM match_partnerships WHERE match_id = v_match_id;
    FOR rec IN SELECT * FROM jsonb_to_recordset(v_partnerships)
      AS x(batter_1_id uuid, batter_2_id uuid, runs_added integer, wicket_number integer)
    LOOP
      IF rec.batter_1_id IS NOT NULL AND rec.batter_2_id IS NOT NULL THEN
        INSERT INTO match_partnerships (match_id, batter_1_id, batter_2_id, runs_added, wicket_number)
        VALUES (v_match_id, rec.batter_1_id, rec.batter_2_id, rec.runs_added, rec.wicket_number);
      END IF;
    END LOOP;
  END IF;

  -- 7. Save awards
  IF v_awards IS NOT NULL AND v_awards != '{}'::jsonb THEN
    IF nullif(v_awards->>'player_of_match_id', '') IS NOT NULL OR
       nullif(v_awards->>'best_batter_id', '') IS NOT NULL OR
       nullif(v_awards->>'best_bowler_id', '') IS NOT NULL OR
       nullif(v_awards->>'best_fielder_id', '') IS NOT NULL THEN
      INSERT INTO match_awards (match_id, player_of_match_id, best_batter_id, best_bowler_id, best_fielder_id)
      VALUES (v_match_id,
              nullif(v_awards->>'player_of_match_id', '')::uuid,
              nullif(v_awards->>'best_batter_id', '')::uuid,
              nullif(v_awards->>'best_bowler_id', '')::uuid,
              nullif(v_awards->>'best_fielder_id', '')::uuid)
      ON CONFLICT (match_id) DO UPDATE SET
        player_of_match_id = excluded.player_of_match_id,
        best_batter_id = excluded.best_batter_id,
        best_bowler_id = excluded.best_bowler_id,
        best_fielder_id = excluded.best_fielder_id;
    END IF;
  END IF;

  -- 8. Refresh player statistics ONLY for non-guest academy members
  FOR v_player_id IN
    SELECT DISTINCT pm.academy_member_id
    FROM (
      SELECT academy_member_id FROM match_lineups WHERE match_id = v_match_id AND academy_member_id IS NOT NULL
      UNION SELECT academy_member_id FROM match_batting WHERE match_id = v_match_id AND academy_member_id IS NOT NULL
      UNION SELECT academy_member_id FROM match_bowling WHERE match_id = v_match_id AND academy_member_id IS NOT NULL
      UNION SELECT academy_member_id FROM match_fielding WHERE match_id = v_match_id AND academy_member_id IS NOT NULL
    ) pm
  LOOP
    PERFORM refresh_player_statistics(v_academy_id, v_player_id);
  END LOOP;

  RETURN jsonb_build_object('match_id', v_match_id);
END $$;

-- ------------------------------------------- join request role escalation --
-- A requester may cancel their own pending request, but must not be able to
-- change requested_role / academy_id, which would let them escalate to coach.
create or replace function protect_join_request_requester_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.user_id then
    if new.requested_role is distinct from old.requested_role
       or new.academy_id is distinct from old.academy_id
       or new.user_id is distinct from old.user_id then
      raise exception 'E_FORBIDDEN: Cannot modify request fields after submission'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists join_request_requester_fields_guard on join_requests;
create trigger join_request_requester_fields_guard
  before update on join_requests
  for each row execute function protect_join_request_requester_fields();

-- ------------------------------------------- cricheroes player mappings RLS --
-- Reads: any ACTIVE member. Writes: staff only (mirrors upsert_cricheroes_player_mappings).
drop policy if exists cricheroes_mappings_tenant_isolation on cricheroes_player_mappings;

create policy cricheroes_mappings_select on cricheroes_player_mappings
  for select using (
    academy_id in (
      select m.academy_id from academy_members m
      where m.user_id = auth.uid() and m.status = 'active'
    )
  );

create policy cricheroes_mappings_write on cricheroes_player_mappings
  for insert with check (is_staff(academy_id));

create policy cricheroes_mappings_update on cricheroes_player_mappings
  for update using (is_staff(academy_id)) with check (is_staff(academy_id));

create policy cricheroes_mappings_delete on cricheroes_player_mappings
  for delete using (is_staff(academy_id));

-- Keep the bulk-import RPC consistent with the hardened write policies.
CREATE OR REPLACE FUNCTION upsert_cricheroes_player_mappings(
  p_academy_id uuid,
  p_mappings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  IF NOT is_staff(p_academy_id) THEN
    RAISE EXCEPTION 'E_FORBIDDEN: User is not authorized to manage player mappings for this academy'
      USING errcode = '42501';
  END IF;

  IF p_mappings IS NULL OR p_mappings = '[]'::jsonb THEN
    RETURN;
  END IF;

  FOR rec IN SELECT * FROM jsonb_to_recordset(p_mappings)
    AS x(cricheroes_player_id text, cricheroes_name text, academy_member_id uuid, is_guest boolean, confidence_score integer)
  LOOP
    INSERT INTO cricheroes_player_mappings (
      academy_id, cricheroes_player_id, cricheroes_name, academy_member_id, is_guest, confidence_score, updated_at
    ) VALUES (
      p_academy_id, rec.cricheroes_player_id, rec.cricheroes_name, rec.academy_member_id, coalesce(rec.is_guest, false), coalesce(rec.confidence_score, 100), now()
    )
    ON CONFLICT (academy_id, cricheroes_name) DO UPDATE SET
      cricheroes_player_id = coalesce(excluded.cricheroes_player_id, cricheroes_player_mappings.cricheroes_player_id),
      academy_member_id = excluded.academy_member_id,
      is_guest = excluded.is_guest,
      confidence_score = excluded.confidence_score,
      updated_at = now();
  END LOOP;
END;
$$;

grant execute on function upsert_cricheroes_player_mappings(uuid, jsonb) to authenticated;
