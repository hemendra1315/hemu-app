-- Neither staff nor players had any way to change a drill_assignment's
-- status from the UI — `useUpdateDrillAssignment` existed but nothing
-- called it. Staff can now (DrillsPage got a "Mark complete" button, using
-- their existing RLS UPDATE grant). A player marking their OWN assignment
-- done is a separate, narrower permission: `drill_assignments_update` is
-- staff-only, and a blanket player UPDATE policy would let a player edit
-- any column on their row. This RPC only ever flips `status` on a row that
-- is genuinely theirs.
create or replace function public.player_set_drill_assignment_status(
  p_assignment_id uuid,
  p_status drill_assignment_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
begin
  select pm.user_id into v_owner_user_id
  from drill_assignments da
  join academy_members pm on pm.id = da.player_id
  where da.id = p_assignment_id;

  if v_owner_user_id is null then
    raise exception 'assignment not found' using errcode = 'P0002';
  end if;

  if v_owner_user_id <> auth.uid() then
    raise exception 'not authorized to update this assignment' using errcode = '42501';
  end if;

  update drill_assignments
  set status = p_status, updated_at = now()
  where id = p_assignment_id;
end;
$$;

grant execute on function public.player_set_drill_assignment_status(uuid, drill_assignment_status) to authenticated;
