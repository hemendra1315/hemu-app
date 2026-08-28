-- Drills and assignments for coaches and academy owners

create type skill_level as enum ('beginner', 'intermediate', 'advanced', 'elite');
create type drill_category as enum ('batting', 'bowling', 'fielding', 'fitness');
create type drill_assignment_status as enum ('assigned', 'completed');

create table drills (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  name text not null,
  category drill_category not null,
  description text,
  duration_minutes integer,
  difficulty skill_level not null default 'beginner',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index drills_academy_idx on drills (academy_id, category);

create table drill_assignments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  drill_id uuid not null references drills(id) on delete cascade,
  player_id uuid references academy_members(id) on delete cascade,
  batch_id uuid references batches(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  due_date timestamptz,
  status drill_assignment_status not null default 'assigned',
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  check ((player_id is not null)::int + (batch_id is not null)::int = 1)
);
create index drill_assignments_academy_idx on drill_assignments (academy_id);
create index drill_assignments_drill_idx on drill_assignments (drill_id);
create index drill_assignments_player_idx on drill_assignments (player_id);
create index drill_assignments_batch_idx on drill_assignments (batch_id);
