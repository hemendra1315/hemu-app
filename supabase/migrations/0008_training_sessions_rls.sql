-- Row level security for training session management

alter table training_sessions enable row level security;

create policy training_sessions_select on training_sessions for select using (
  is_member(academy_id)
);

create policy training_sessions_insert on training_sessions for insert with check (
  is_staff(academy_id)
);

create policy training_sessions_update on training_sessions for update using (
  is_staff(academy_id)
) with check (
  is_staff(academy_id)
);

create policy training_sessions_delete on training_sessions for delete using (
  is_staff(academy_id)
);
