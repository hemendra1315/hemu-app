-- Adds the ability to review and fix past CricHeroes imports:
-- 1. matches.cricheroes_source_url — optional link back to the original scorecard.
-- 2. cricheroes_imports — a per-match snapshot of the player-mapping decisions made
--    at import time (name, matched member, confidence score, guest flag), so staff
--    can review and correct them later without re-uploading the PDF.
--
-- Applied live via Supabase MCP on 2026-09-11; this file mirrors that migration
-- for the repo's own history, same as the other 2026-09-08 migrations in this
-- folder.

alter table matches add column if not exists cricheroes_source_url text;

create table if not exists cricheroes_imports (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  match_id uuid not null unique references matches(id) on delete cascade,
  source_filename text,
  player_mappings jsonb not null default '[]'::jsonb,
  imported_by uuid references profiles(id) on delete set null,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No delete policy is defined below (rows only get created or corrected, and
-- cascade-delete automatically when their match is deleted), so DELETE is
-- deliberately left out of this grant.
grant select, insert, update on cricheroes_imports to anon, authenticated;

alter table cricheroes_imports enable row level security;

-- Only academy staff (owner/coach) can see or touch a match's import record —
-- same authorization boundary as save_match_result itself.
create policy cricheroes_imports_staff_select on cricheroes_imports
  for select using (is_staff(academy_id));

create policy cricheroes_imports_staff_insert on cricheroes_imports
  for insert with check (is_staff(academy_id));

create policy cricheroes_imports_staff_update on cricheroes_imports
  for update using (is_staff(academy_id)) with check (is_staff(academy_id));

create index if not exists idx_cricheroes_imports_academy on cricheroes_imports(academy_id);

-- save_match_result now also persists the scorecard link, in both the create
-- and update paths. Everything else in the function is unchanged from the
-- version baselined on 2026-08-27.
create or replace function public.save_match_result(p_payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  IF NOT is_staff(v_academy_id) THEN
    RAISE EXCEPTION 'E_FORBIDDEN: User is not authorized to save match results for this academy'
      USING errcode = '42501';
  END IF;

  IF v_match ? 'id' AND v_match->>'id' IS NOT NULL THEN
    v_match_id := (v_match->>'id')::uuid;

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
      match_type = (v_match->>'match_type')::match_type,
      format = (v_match->>'format')::match_format,
      overs = cricket_overs_to_decimal((v_match->>'overs')::numeric(4,1)),
      team_score = v_match->>'team_score',
      wickets_lost = (v_match->>'wickets_lost')::integer,
      overs_played = cricket_overs_to_decimal((v_match->>'overs_played')::numeric(4,1)),
      result = (v_match->>'result')::match_result,
      winning_margin = v_match->>'winning_margin',
      batch_id = nullif(v_match->>'batch_id', '')::uuid,
      cricheroes_source_url = nullif(v_match->>'cricheroes_source_url', ''),
      status = 'completed',
      updated_at = now()
    WHERE id = v_match_id AND academy_id = v_academy_id;
  ELSE
    INSERT INTO matches (
      academy_id, match_name, match_date, venue, opponent_name, tournament,
      match_type, format, overs, team_score, wickets_lost, overs_played,
      result, winning_margin, batch_id, cricheroes_source_url, status, created_by
    ) VALUES (
      v_academy_id, v_match->>'match_name', (v_match->>'match_date')::date,
      v_match->>'venue', v_match->>'opponent_name', v_match->>'tournament',
      (v_match->>'match_type')::match_type, (v_match->>'format')::match_format,
      cricket_overs_to_decimal((v_match->>'overs')::numeric(4,1)),
      v_match->>'team_score', (v_match->>'wickets_lost')::integer,
      cricket_overs_to_decimal((v_match->>'overs_played')::numeric(4,1)), (v_match->>'result')::match_result,
      v_match->>'winning_margin', nullif(v_match->>'batch_id', '')::uuid,
      nullif(v_match->>'cricheroes_source_url', ''),
      'completed', auth.uid()
    ) RETURNING id INTO v_match_id;
  END IF;

  IF v_lineups IS NOT NULL AND v_lineups != '[]'::jsonb THEN
    DELETE FROM match_lineups WHERE match_id = v_match_id;
    FOR rec IN SELECT * FROM jsonb_to_recordset(v_lineups)
      AS x(academy_member_id uuid, batting_order integer, is_captain boolean, is_vice_captain boolean, is_wicketkeeper boolean, is_guest boolean, guest_name text)
    LOOP
      INSERT INTO match_lineups (match_id, academy_member_id, batting_order, is_captain, is_vice_captain, is_wicketkeeper, is_guest, guest_name)
      VALUES (v_match_id, rec.academy_member_id, rec.batting_order, coalesce(rec.is_captain, false), coalesce(rec.is_vice_captain, false), coalesce(rec.is_wicketkeeper, false), coalesce(rec.is_guest, false), rec.guest_name);
    END LOOP;
  END IF;

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

  IF v_fielding IS NOT NULL AND v_fielding != '[]'::jsonb THEN
    DELETE FROM match_fielding WHERE match_id = v_match_id;
    FOR rec IN SELECT * FROM jsonb_to_recordset(v_fielding)
      AS x(academy_member_id uuid, catches integer, run_outs integer, stumpings integer, is_guest boolean, guest_name text)
    LOOP
      INSERT INTO match_fielding (match_id, academy_member_id, catches, run_outs, stumpings, is_guest, guest_name)
      VALUES (v_match_id, rec.academy_member_id, coalesce(rec.catches, 0), coalesce(rec.run_outs, 0), coalesce(rec.stumpings, 0), coalesce(rec.is_guest, false), rec.guest_name);
    END LOOP;
  END IF;

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
END
$function$;
