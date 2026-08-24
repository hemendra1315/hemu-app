-- Training session management for academy coaches and owners

create type session_status as enum ('scheduled', 'completed', 'cancelled');

create table training_sessions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  title text not null,
  focus_area text,
  session_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  coach_id uuid not null references academy_members(id) on delete restrict,
  status session_status not null default 'scheduled',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index training_sessions_academy_idx on training_sessions (academy_id, session_date);
create index training_sessions_batch_idx on training_sessions (batch_id, session_date);
create index training_sessions_coach_idx on training_sessions (coach_id, session_date);
