-- Players could see their own drill_assignments rows (drill_assignments_select
-- already allows this) but not the linked drills row itself, because
-- `drills_select` only allows staff. `fetchPlayerDrillSummary` embeds
-- `drills!inner(...)`, and an inner embed silently drops the whole
-- assignment row when the embedded row is RLS-blocked — so every player saw
-- zero assigned drills, always, no matter what a coach assigned them.
--
-- This adds a second SELECT policy on `drills` (policies on the same
-- command are OR'd together, so the existing staff policy is untouched)
-- letting a player read a drill if they have an active assignment for it.
create policy drills_select_assigned_player on drills for select using (
  exists (
    select 1
    from drill_assignments da
    join academy_members pm on pm.id = da.player_id
    where da.drill_id = drills.id
      and pm.user_id = auth.uid()
      and pm.status = 'active'
  )
);
