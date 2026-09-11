-- The prior migration's `revoke ... from anon` didn't actually block anon: new
-- functions get an implicit EXECUTE grant to PUBLIC, which anon inherits
-- regardless of a per-role revoke. Revoke from PUBLIC directly and grant back
-- only to authenticated (the null-safe auth check inside the function is
-- still the primary fix; this closes the same door at the grant level too).

revoke execute on function public.player_set_drill_assignment_status(uuid, drill_assignment_status) from public;
grant execute on function public.player_set_drill_assignment_status(uuid, drill_assignment_status) to authenticated;
