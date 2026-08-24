-- Attendance tracking for training sessions

create type attendance_status as enum ('present', 'absent');

create table attendance (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  session_id uuid not null references training_sessions(id) on delete cascade,
  player_id uuid not null references academy_members(id) on delete cascade,
  status attendance_status not null,
  marked_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, player_id)
);

create index attendance_session_idx on attendance (session_id);
create index attendance_player_idx on attendance (player_id);
create index attendance_academy_idx on attendance (academy_id);

create trigger attendance_set_updated_at
  before update on attendance
  for each row execute function set_updated_at();
