-- player_set_drill_assignment_status compared v_owner_user_id <> auth.uid().
-- For an unauthenticated (anon) caller, auth.uid() is NULL, and in SQL/plpgsql
-- "x <> NULL" evaluates to NULL, which `if ... then` treats as false -- so the
-- authorization check silently never fired for anonymous callers, and the
-- UPDATE ran unconditionally. Anyone, with no account at all, could call this
-- RPC directly and flip the status of any drill assignment in any academy.
--
-- Two independent fixes (defense in depth): make the check null-safe, and
-- revoke EXECUTE from anon entirely -- this function is only ever meant to be
-- called by a signed-in player updating their own assignment.

create or replace function public.player_set_drill_assignment_status(
  p_assignment_id uuid,
  p_status drill_assignment_status
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_owner_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authorized to update this assignment' using errcode = '42501';
  end if;

  select pm.user_id into v_owner_user_id
  from drill_assignments da
  join academy_members pm on pm.id = da.player_id
  where da.id = p_assignment_id;

  if v_owner_user_id is null then
    raise exception 'assignment not found' using errcode = 'P0002';
  end if;

  if v_owner_user_id is distinct from auth.uid() then
    raise exception 'not authorized to update this assignment' using errcode = '42501';
  end if;

  update drill_assignments
  set status = p_status, updated_at = now()
  where id = p_assignment_id;
end;
$function$;

revoke execute on function public.player_set_drill_assignment_status(uuid, drill_assignment_status) from anon;
