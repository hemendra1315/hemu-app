-- ============================================================================
-- Phase 4: Parent RLS Security Hardening
-- Ensure parents only have read access to their linked children's stats, milestones, etc.
-- ============================================================================

GRANT ALL ON parent_player_links TO authenticated;
GRANT ALL ON parent_linking_codes TO authenticated;
GRANT ALL ON announcements TO authenticated;
GRANT ALL ON notifications TO authenticated;

-- 1. Player Statistics
CREATE POLICY player_stats_select_parents ON player_statistics FOR SELECT USING (
  player_id IN (SELECT my_linked_member_ids(academy_id))
);

-- 2. Player Milestones
CREATE POLICY player_milestones_select_parents ON player_milestones FOR SELECT USING (
  player_id IN (SELECT my_linked_member_ids(academy_id))
);

-- 3. Drill Assignments
CREATE POLICY drill_assignments_select_parents ON drill_assignments FOR SELECT USING (
  player_id IN (SELECT my_linked_member_ids(academy_id))
  OR 
  batch_id IN (
    SELECT batch_id FROM batch_members WHERE academy_member_id IN (SELECT my_linked_member_ids(drill_assignments.academy_id))
  )
);

-- 4. Match Batting, Bowling, Fielding, Awards (already readable via matches_select, but let's be explicit if needed)
-- matches_select uses is_member(academy_id), which is fine for academy-wide match visibility.

-- 5. Announcements Security
-- Drop the overly permissive announcements_select policy
DROP POLICY IF EXISTS announcements_select ON announcements;

-- Re-create announcements_select with strict audience filtering
CREATE POLICY announcements_select ON announcements FOR SELECT USING (
  is_staff(academy_id) OR is_super_admin()
  OR
  (
    has_role(academy_id, ARRAY['player']::app_role[]) AND (
      audience IN ('all', 'players')
      OR (audience = 'batch' AND batch_id IN (SELECT batch_id FROM batch_members WHERE academy_member_id = my_player_id(academy_id)))
    )
  )
  OR
  (
    has_role(academy_id, ARRAY['parent']::app_role[]) AND (
      audience IN ('all', 'all_parents')
      OR (audience = 'batch' AND batch_id IN (SELECT batch_id FROM batch_members WHERE academy_member_id IN (SELECT my_linked_member_ids(academy_id))))
    )
  )
);

-- 6. Fix infinite recursion in batch_members_select_parents
DROP POLICY IF EXISTS batch_members_select_parents ON batch_members;
CREATE POLICY batch_members_select_parents ON batch_members FOR SELECT USING (
  academy_member_id IN (
    SELECT am.id FROM academy_members am 
    WHERE am.id = batch_members.academy_member_id 
    AND am.id IN (SELECT my_linked_member_ids(am.academy_id))
  )
);

-- 7. Fix attendance_select allowing parents to see all attendance
DROP POLICY IF EXISTS attendance_select ON attendance;
CREATE POLICY attendance_select ON attendance FOR SELECT USING (
  is_staff(academy_id) OR player_id = my_player_id(academy_id)
);
-- Note: attendance_select_parents already handles the parent access case securely.

-- 8. Fix batches_select_parents infinite recursion
DROP POLICY IF EXISTS batches_select_parents ON batches;
CREATE POLICY batches_select_parents ON batches FOR SELECT USING (
  has_role(academy_id, ARRAY['parent']::app_role[])
);
