-- Phase 5 RLS hardening for announcements

drop policy if exists announcements_select on announcements;

create policy announcements_select on announcements for select using (
  -- Super admins and staff can see all announcements in their academy
  is_staff(academy_id) OR is_super_admin()
  OR
  (
    is_member(academy_id) AND (
      audience = 'all'
      OR (audience = 'players' AND has_role(academy_id, ARRAY['player']::app_role[]))
      OR (audience = 'all_parents' AND has_role(academy_id, ARRAY['parent']::app_role[]))
      OR (audience = 'batch' AND (
         -- Player is in the batch
         EXISTS (
           SELECT 1 FROM batch_members bm 
           JOIN academy_members am ON bm.academy_member_id = am.id 
           WHERE bm.batch_id = announcements.batch_id 
           AND am.user_id = auth.uid()
         )
         OR
         -- Parent's linked child is in the batch
         EXISTS (
           SELECT 1 FROM batch_members bm 
           JOIN academy_members am ON bm.academy_member_id = am.id 
           JOIN parent_player_links ppl ON ppl.player_user_id = am.user_id
           WHERE bm.batch_id = announcements.batch_id 
           AND ppl.parent_user_id = auth.uid() 
           AND ppl.academy_id = announcements.academy_id
         )
      ))
    )
  )
);
