-- A revoked parent could still read batch-targeted announcements for a
-- child they used to be linked to. The 'custom' audience branch of
-- announcements_select already required ppl.status = 'active' when
-- joining through parent_player_links; the 'batch' audience branch
-- checked parent_user_id/academy_id but never checked status, so a
-- revoked link kept granting access. Bringing the batch branch in line
-- with the custom branch.

drop policy if exists announcements_select on public.announcements;

create policy announcements_select on public.announcements as PERMISSIVE for SELECT to public
using (
  is_staff(academy_id) OR is_super_admin() OR (
    is_member(academy_id) AND (
      ((audience)::text = 'all'::text)
      OR (((audience)::text = 'players'::text) AND has_role(academy_id, ARRAY['player'::app_role]))
      OR (((audience)::text = 'all_parents'::text) AND has_role(academy_id, ARRAY['parent'::app_role]))
      OR (((audience)::text = 'batch'::text) AND (
        (EXISTS (
          SELECT 1
          FROM batch_members bm
          JOIN academy_members am ON (bm.academy_member_id = am.id)
          WHERE bm.batch_id = announcements.batch_id AND am.user_id = auth.uid()
        ))
        OR (EXISTS (
          SELECT 1
          FROM batch_members bm
          JOIN academy_members am ON (bm.academy_member_id = am.id)
          JOIN parent_player_links ppl ON (
            ppl.player_user_id = am.user_id
            AND ppl.status = 'active'::text
          )
          WHERE bm.batch_id = announcements.batch_id
            AND ppl.parent_user_id = auth.uid()
            AND ppl.academy_id = announcements.academy_id
        ))
      ))
      OR (((audience)::text = 'custom'::text) AND (
        (EXISTS (
          SELECT 1
          FROM announcement_targets t
          JOIN academy_members am ON (am.id = t.academy_member_id)
          WHERE t.announcement_id = announcements.id AND am.user_id = auth.uid()
        ))
        OR (EXISTS (
          SELECT 1
          FROM announcement_targets t
          JOIN batch_members bm ON (bm.batch_id = t.batch_id)
          JOIN academy_members am ON (am.id = bm.academy_member_id)
          WHERE t.announcement_id = announcements.id AND am.user_id = auth.uid()
        ))
        OR (EXISTS (
          SELECT 1
          FROM announcement_targets t
          JOIN batch_members bm ON (bm.batch_id = t.batch_id)
          JOIN academy_members am ON (am.id = bm.academy_member_id)
          JOIN parent_player_links ppl ON (
            ppl.player_user_id = am.user_id
            AND ppl.academy_id = announcements.academy_id
            AND ppl.status = 'active'::text
          )
          WHERE t.announcement_id = announcements.id AND ppl.parent_user_id = auth.uid()
        ))
        OR (EXISTS (
          SELECT 1
          FROM announcement_targets t
          JOIN academy_members am ON (am.id = t.academy_member_id)
          JOIN parent_player_links ppl ON (
            ppl.player_user_id = am.user_id
            AND ppl.academy_id = announcements.academy_id
            AND ppl.status = 'active'::text
          )
          WHERE t.announcement_id = announcements.id AND ppl.parent_user_id = auth.uid()
        ))
      ))
    )
  )
);
