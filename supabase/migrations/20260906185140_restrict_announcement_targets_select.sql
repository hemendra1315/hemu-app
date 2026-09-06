-- Announcements audit finding: `announcement_targets_select` was too broad --
-- any active academy member (any role) could read every row in
-- announcement_targets for their academy, including rows belonging to
-- OTHER members. That let a player see exactly which named individuals
-- (or which other batches) a "custom"-audience announcement was privately
-- addressed to, even when they were not one of its targets themselves.
--
-- This replaces it with a policy that only lets a caller see a target row
-- when: they are academy staff (who already need this for management), OR
-- the row's academy_member_id/batch_id actually resolves to them as a
-- player, OR it resolves to them as an actively-linked parent of the
-- targeted player. Same shape as the batch/parent visibility checks added
-- in earlier rounds (training sessions, matches).
drop policy if exists announcement_targets_select on public.announcement_targets;

create policy announcement_targets_select on public.announcement_targets as PERMISSIVE for SELECT to public
using (
  is_staff(academy_id) OR is_super_admin() OR
  (academy_member_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM academy_members am
    WHERE am.id = announcement_targets.academy_member_id AND am.user_id = auth.uid()
  )) OR
  (batch_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM batch_members bm
    JOIN academy_members am ON am.id = bm.academy_member_id
    WHERE bm.batch_id = announcement_targets.batch_id AND am.user_id = auth.uid()
  )) OR
  (academy_member_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM academy_members am
    JOIN parent_player_links ppl ON (
      ppl.player_user_id = am.user_id
      AND ppl.academy_id = announcement_targets.academy_id
      AND ppl.status = 'active'
    )
    WHERE am.id = announcement_targets.academy_member_id AND ppl.parent_user_id = auth.uid()
  )) OR
  (batch_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM batch_members bm
    JOIN academy_members am ON am.id = bm.academy_member_id
    JOIN parent_player_links ppl ON (
      ppl.player_user_id = am.user_id
      AND ppl.academy_id = announcement_targets.academy_id
      AND ppl.status = 'active'
    )
    WHERE bm.batch_id = announcement_targets.batch_id AND ppl.parent_user_id = auth.uid()
  ))
);
