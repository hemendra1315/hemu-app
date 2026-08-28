-- ============================================================================
-- Grant EXECUTE to authenticated for parent RLS functions
-- The previous migration 0045 restored EXECUTE grants for my_player_id
-- and other base helpers, but missed the parent phase (Phase 4) helpers.
-- Because RLS policies are combined using OR (e.g. player_stats_select_parents),
-- when a student reads their stats, PostgreSQL evaluates both their policy
-- AND the parent policy. The parent policy uses my_linked_member_ids,
-- so if EXECUTE is missing, the entire SELECT throws a permission denied error
-- for the student.
-- ============================================================================

GRANT EXECUTE ON FUNCTION my_linked_players(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION my_linked_member_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_parent_linking_code(uuid, uuid, text) TO authenticated;

