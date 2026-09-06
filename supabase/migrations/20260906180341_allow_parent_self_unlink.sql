-- A parent had no way to unlink themselves from a child -- not just
-- missing UI, the RLS policy itself never allowed it.
-- parent_player_links_update only let staff or the PLAYER (player_user_id
-- = auth.uid()) update a link; the PARENT (parent_user_id = auth.uid())
-- was never included, so even a client change calling the existing
-- revokeParentLink() as the parent would have failed with a 42501.

drop policy if exists parent_player_links_update on public.parent_player_links;

create policy parent_player_links_update on public.parent_player_links as PERMISSIVE for UPDATE to public
using (is_staff(academy_id) OR player_user_id = auth.uid() OR parent_user_id = auth.uid())
with check (is_staff(academy_id) OR player_user_id = auth.uid() OR parent_user_id = auth.uid());
