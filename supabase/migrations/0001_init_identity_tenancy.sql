-- ============================================================================
-- Phase 1 — identity and tenancy
-- Subset of docs/DB-SCHEMA.sql: profiles, academies, memberships, join codes,
-- join requests. Later phases add batches/sessions/billing on top of this.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------- enums -----
create type app_role      as enum ('super_admin', 'academy_owner', 'coach', 'player');
create type member_status as enum ('pending', 'active', 'suspended', 'rejected', 'left');
create type join_status   as enum ('pending', 'approved', 'rejected', 'cancelled');
create type fee_mode      as enum ('academy_pays', 'player_pays');

-- ---------------------------------------------------------- shared trigger --
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ------------------------------------------------------------- profiles -----
create table profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text,
  email          citext not null,
  phone          text,
  avatar_url     text,
  date_of_birth  date,
  gender         text check (gender in ('male', 'female', 'other')),
  locale         text not null default 'en',
  timezone       text not null default 'Asia/Kolkata',
  is_super_admin boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Google sign-in populates name/avatar from the OAuth claims.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------ academies -----
create table academies (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null check (length(btrim(name)) between 2 and 120),
  slug                      citext not null unique,
  logo_url                  text,
  city                      text,
  state                     text,
  country                   text default 'IN',
  address                   text,
  contact_email             citext,
  contact_phone             text,
  timezone                  text not null default 'Asia/Kolkata',
  currency                  char(3) not null default 'INR',
  fee_mode                  fee_mode not null default 'player_pays',
  default_monthly_fee_paise integer not null default 20000,
  grace_period_days         integer not null default 7,
  settings                  jsonb not null default '{}'::jsonb,
  owner_user_id             uuid not null references profiles (id),
  is_active                 boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz
);

create index academies_owner_idx on academies (owner_user_id);

create trigger academies_set_updated_at
  before update on academies
  for each row execute function set_updated_at();

-- ------------------------------------------------------ academy members -----
create table academy_members (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  role       app_role not null check (role <> 'super_admin'),
  status     member_status not null default 'active',
  invited_by uuid references profiles (id),
  joined_at  timestamptz,
  left_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, user_id, role)
);

create index academy_members_user_idx on academy_members (user_id, status);
create index academy_members_academy_idx on academy_members (academy_id, role, status);

create trigger academy_members_set_updated_at
  before update on academy_members
  for each row execute function set_updated_at();

-- ----------------------------------------------------------- join codes -----
create table academy_join_codes (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies (id) on delete cascade,
  code       text not null check (code ~ '^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6,8}$'),
  role       app_role not null default 'player' check (role in ('player', 'coach')),
  is_active  boolean not null default true,
  expires_at timestamptz,
  max_uses   integer check (max_uses is null or max_uses > 0),
  use_count  integer not null default 0,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- Only one live code may exist per value, so lookups stay unambiguous.
create unique index academy_join_codes_active_code_idx
  on academy_join_codes (code) where is_active;
create index academy_join_codes_academy_idx
  on academy_join_codes (academy_id, is_active);

-- -------------------------------------------------------- join requests -----
create table join_requests (
  id               uuid primary key default gen_random_uuid(),
  academy_id       uuid not null references academies (id) on delete cascade,
  user_id          uuid not null references profiles (id) on delete cascade,
  join_code_id     uuid references academy_join_codes (id),
  requested_role   app_role not null default 'player' check (requested_role in ('player', 'coach')),
  status           join_status not null default 'pending',
  message          text,
  reviewed_by      uuid references profiles (id),
  reviewed_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz not null default now()
);

create unique index join_requests_one_pending_idx
  on join_requests (academy_id, user_id) where status = 'pending';
create index join_requests_academy_idx on join_requests (academy_id, status, created_at desc);
create index join_requests_user_idx on join_requests (user_id, created_at desc);
