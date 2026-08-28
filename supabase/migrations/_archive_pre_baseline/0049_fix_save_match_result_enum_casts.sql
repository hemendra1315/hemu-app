-- ============================================================
-- 0049 — Fix save_match_result() enum type mismatch
-- ============================================================
--
-- WHY THIS EXISTS
--
-- 0048 restored the missing cricket_overs_to_decimal() helper so
-- save_match_result() could resolve at execution time, but that only
-- uncovered a second, previously-masked bug in the same statement.
--
-- `matches.match_type`, `matches.format` and `matches.result` are Postgres
-- enums (match_type, match_format, match_result). save_match_result() reads
-- them out of the JSONB payload with the `->>` operator, which always
-- produces `text`, and assigns that text straight into the enum columns with
-- no cast, in both the INSERT and UPDATE branches. Postgres enums have no
-- implicit or assignment cast from `text`, so the statement fails to plan:
--
--   select p_payload -- reproduced end to end with a real wizard payload:
--   {"code":"42804","message":"column \"match_type\" is of type match_type
--   but expression is of type text","hint":"You will need to rewrite or
--   cast the expression."}
--
-- Because this is a type error caught while the INSERT/UPDATE statement is
-- being planned, it fires regardless of whether cricket_overs_to_decimal()
-- exists — it was always going to fail here next, it was simply unreachable
-- (and thus invisible) while the missing-function error masked it. In other
-- words: after 0048, the wizard still could not save a match; this
-- migration is required in addition to 0048, not instead of it.
--
-- Verified live with the exact JSONB payload the match wizard sends (via a
-- direct RPC call carrying a real user's access token, so is_staff() and
-- auth.uid() resolve as they would in the app): before this migration the
-- call above fails 42804; after, it returns {"match_id": "..."} and the
-- inserted row's match_type/format/result columns hold the correct enum
-- values.
--
-- This migration only adds three explicit casts; no other behavior changes.
-- ============================================================

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
      match_type = (v_match->>'match_type')::match_type,
      format = (v_match->>'format')::match_format,
      overs = cricket_overs_to_decimal((v_match->>'overs')::numeric(4,1)),
      team_score = v_match->>'team_score',
      wickets_lost = (v_match->>'wickets_lost')::integer,
      overs_played = cricket_overs_to_decimal((v_match->>'overs_played')::numeric(4,1)),
      result = (v_match->>'result')::match_result,
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
      (v_match->>'match_type')::match_type, (v_match->>'format')::match_format,
      cricket_overs_to_decimal((v_match->>'overs')::numeric(4,1)),
      v_match->>'team_score', (v_match->>'wickets_lost')::integer,
      cricket_overs_to_decimal((v_match->>'overs_played')::numeric(4,1)), (v_match->>'result')::match_result,
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
END
$function$;
