-- Row level security for attendance records

alter table attendance enable row level security;

create policy attendance_select on attendance for select using (
  is_member(academy_id)
);

create policy attendance_insert on attendance for insert with check (
  is_staff(academy_id)
  and exists (
    select 1 from training_sessions s
    where s.id = session_id
      and s.academy_id = academy_id
  )
);

create policy attendance_update on attendance for update using (
  is_staff(academy_id)
  and exists (
    select 1 from training_sessions s
    where s.id = session_id
      and s.academy_id = academy_id
  )
) with check (
  is_staff(academy_id)
  and exists (
    select 1 from training_sessions s
    where s.id = session_id
      and s.academy_id = academy_id
  )
);

create policy attendance_delete on attendance for delete using (
  is_staff(academy_id)
  and exists (
    select 1 from training_sessions s
    where s.id = session_id
      and s.academy_id = academy_id
  )
);
