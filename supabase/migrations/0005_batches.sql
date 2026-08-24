-- Batch management tables for academy owners and coaches

create table batches (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies (id) on delete cascade,
  name text not null,
  age_group text not null,
  description text,
  training_days text not null,
  training_time text not null,
  coach_id uuid not null references academy_members (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index batches_academy_idx on batches (academy_id);
create index batches_coach_idx on batches (coach_id);

create table batch_members (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches (id) on delete cascade,
  academy_member_id uuid not null references academy_members (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (batch_id, academy_member_id)
);

create index batch_members_batch_idx on batch_members (batch_id);
create index batch_members_member_idx on batch_members (academy_member_id);

create or replace function batch_member_count(p_batch_id uuid)
returns integer language sql stable as $$
  select count(*) from batch_members where batch_id = p_batch_id;
$$;
