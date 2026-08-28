-- Sets an explicit search_path on the remaining public-schema functions that
-- didn't already have one. These are all SECURITY INVOKER (run with the
-- caller's own permissions, not elevated), so this is defense-in-depth
-- rather than closing an active privilege-escalation hole -- but leaving it
-- unset is exactly the kind of drift that has caused real bugs elsewhere in
-- this project (see migration 0036/0041 vs the live database, fixed
-- 2026-08-27), so closing it now while it's cheap and safe.
alter function public.batch_member_count(uuid) set search_path = public;
alter function public.generate_join_code(integer) set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.slugify(text) set search_path = public;
