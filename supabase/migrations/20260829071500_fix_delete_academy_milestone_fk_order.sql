-- delete_platform_academy deleted `matches` before `player_milestones` and
-- `academy_records`. Those two are the only children of `matches` whose foreign
-- key is NO ACTION rather than ON DELETE CASCADE, so the delete aborted with
--   violates foreign key constraint "player_milestones_match_id_fkey"
-- for any academy that had ever recorded a milestone or an academy record.
-- The super admin saw only "Failed to delete academy".
--
-- Both are now cleared before `matches`, and by match_id as well as academy_id:
-- a milestone pointing at one of this academy's matches has to go even if its
-- own academy_id somehow differs, or the same constraint fires again.
--
-- `match_bowling_spells` was also missing from the list. It cascades, so it was
-- never the cause of a failure, but leaving it out made the FK-order intent of
-- this function harder to trust.

CREATE OR REPLACE FUNCTION public.delete_platform_academy(p_academy_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Super Admin authorization check
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'E_FORBIDDEN: Access restricted to platform super admins'
      USING errcode = '42501';
  END IF;

  -- 2. Verify academy exists
  IF NOT EXISTS (SELECT 1 FROM academies WHERE id = p_academy_id) THEN
    RAISE EXCEPTION 'E_NOT_FOUND: Academy does not exist'
      USING errcode = 'P0002';
  END IF;

  -- 3. Safely delete dependent records in proper foreign-key order
  DELETE FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM match_batting WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM match_bowling WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM match_bowling_spells WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM match_fielding WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM match_partnerships WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM match_awards WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM match_coach_notes WHERE match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);

  -- These two reference matches with NO ACTION, so they must go first.
  DELETE FROM player_milestones
    WHERE academy_id = p_academy_id
       OR match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);
  DELETE FROM academy_records
    WHERE academy_id = p_academy_id
       OR match_id IN (SELECT id FROM matches WHERE academy_id = p_academy_id);

  DELETE FROM matches WHERE academy_id = p_academy_id;

  DELETE FROM attendance WHERE session_id IN (SELECT id FROM training_sessions WHERE academy_id = p_academy_id);
  DELETE FROM training_sessions WHERE academy_id = p_academy_id;

  DELETE FROM batch_members WHERE batch_id IN (SELECT id FROM batches WHERE academy_id = p_academy_id);
  DELETE FROM batches WHERE academy_id = p_academy_id;

  DELETE FROM player_statistics WHERE academy_id = p_academy_id;
  DELETE FROM cricheroes_player_mappings WHERE academy_id = p_academy_id;
  DELETE FROM drill_assignments WHERE academy_id = p_academy_id;
  DELETE FROM drills WHERE academy_id = p_academy_id;
  DELETE FROM activity_log WHERE academy_id = p_academy_id;
  DELETE FROM academy_join_codes WHERE academy_id = p_academy_id;
  DELETE FROM join_requests WHERE academy_id = p_academy_id;
  DELETE FROM academy_members WHERE academy_id = p_academy_id;

  -- 4. Delete academy record
  DELETE FROM academies WHERE id = p_academy_id;
END $function$;
