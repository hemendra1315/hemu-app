-- The attendance_insert/update/delete RLS policies compared s.academy_id to
-- itself (always true) instead of to attendance.academy_id, which meant a
-- staff member of academy A (correctly authorized for academy A) could write
-- an attendance row tagged academy_id = A but pointing session_id at a
-- training session that actually belongs to a different academy. Reads were
-- unaffected (attendance_select/attendance_select_parents already scope
-- correctly by attendance.academy_id), so this was a tenancy-integrity bug,
-- not a cross-tenant data leak — but a real one, flagged by the 2026-09-11
-- production-readiness audit (Critical Issue #3).
--
-- Applied live via Supabase MCP on 2026-09-11; this file mirrors that change
-- for the repo's own history, same as the other 2026-09 migrations here.

alter policy attendance_insert on attendance
  with check (
    is_staff(academy_id) and exists (
      select 1 from training_sessions s
      where s.id = attendance.session_id and s.academy_id = attendance.academy_id
    )
  );

alter policy attendance_update on attendance
  using (
    is_staff(academy_id) and exists (
      select 1 from training_sessions s
      where s.id = attendance.session_id and s.academy_id = attendance.academy_id
    )
  )
  with check (
    is_staff(academy_id) and exists (
      select 1 from training_sessions s
      where s.id = attendance.session_id and s.academy_id = attendance.academy_id
    )
  );

alter policy attendance_delete on attendance
  using (
    is_staff(academy_id) and exists (
      select 1 from training_sessions s
      where s.id = attendance.session_id and s.academy_id = attendance.academy_id
    )
  );
