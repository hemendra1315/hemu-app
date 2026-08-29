-- Second ordering fault in delete_platform_academy, found the same way the
-- first one was: by a super admin clicking delete and getting a foreign key
-- error. join_requests.join_code_id references academy_join_codes with NO
-- ACTION, and the codes were being deleted first.
--
-- Rather than wait for a third, every NO ACTION foreign key whose parent this
-- function deletes was read out of the catalogue and checked:
--
--   join_requests     -> academy_join_codes   (fixed here)
--   academy_records   -> academy_members      (already ordered correctly)
--   batches           -> academy_members      (already ordered correctly)
--   match_awards      -> academy_members      (already ordered correctly)
--   academy_records   -> matches              (fixed in 20260829071500)
--   player_milestones -> matches              (fixed in 20260829071500)
--
-- Everything else under an academy is ON DELETE CASCADE and needs no ordering.

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

  -- join_requests.join_code_id references academy_join_codes with NO ACTION,
  -- so the requests must go before the codes.
  DELETE FROM join_requests
    WHERE academy_id = p_academy_id
       OR join_code_id IN (SELECT id FROM academy_join_codes WHERE academy_id = p_academy_id);
  DELETE FROM academy_join_codes WHERE academy_id = p_academy_id;
  DELETE FROM academy_members WHERE academy_id = p_academy_id;

  -- 4. Delete academy record
  DELETE FROM academies WHERE id = p_academy_id;
END $function$;
