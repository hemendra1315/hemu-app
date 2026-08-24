-- ============================================================================
-- Cricket Academy Manager — Complete Database Schema (PostgreSQL / Supabase)
-- Version 1.0 (design for approval; ships as numbered migrations)
-- Conventions:
--   * uuid PKs (gen_random_uuid), timestamptz everywhere (UTC), snake_case
--   * every tenant table carries academy_id (denormalized on purpose, for RLS)
--   * soft delete via deleted_at; created_at/updated_at on all tables
--   * money in integer paise (avoid float), currency fixed 'INR' in v1
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";      -- scheduled jobs
create extension if not exists "citext";

-- ============================ 1. ENUMS ======================================
create type app_role          as enum ('super_admin','academy_owner','coach','player');
create type member_status     as enum ('pending','active','suspended','rejected','left');
create type join_status       as enum ('pending','approved','rejected','cancelled');
create type session_status    as enum ('scheduled','completed','cancelled');
create type attendance_status as enum ('present','absent','late','excused');
create type fee_mode          as enum ('academy_pays','player_pays');
create type sub_status        as enum ('trialing','active','grace','expired','paused','cancelled');
create type invoice_status    as enum ('draft','open','partially_paid','paid','void','overdue');
create type payment_method    as enum ('upi','card','netbanking','wallet','cash','bank_transfer','other');
create type payment_status    as enum ('created','pending','succeeded','failed','refunded');
create type payer_type        as enum ('academy','player');
create type drill_category    as enum ('batting','bowling','fielding','fitness','wicketkeeping','mental','other');
create type skill_level       as enum ('beginner','intermediate','advanced','elite');
create type match_format      as enum ('t20','odi','test','t10','custom');
create type notif_channel     as enum ('in_app','push','email');
create type notif_status      as enum ('queued','sent','failed','read');
create type job_status        as enum ('queued','processing','ready','failed');
create type report_type       as enum ('attendance_register','player_progress','batch_performance',
                                       'fee_collection','outstanding_dues','coach_activity','academy_summary');
create type export_format     as enum ('pdf','xlsx','csv');
create type sync_status       as enum ('queued','running','success','partial','failed');

-- ============================ 2. IDENTITY ===================================
-- auth.users is managed by Supabase Auth (Google OAuth).
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  email         citext not null,
  phone         text,
  avatar_url    text,
  date_of_birth date,
  gender        text check (gender in ('male','female','other')),
  locale        text not null default 'en',
  timezone      text not null default 'Asia/Kolkata',
  is_super_admin boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- auto-create profile on signup
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.email,
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ============================ 3. TENANCY ====================================
create table academies (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           citext unique not null,
  logo_url       text,
  city           text, state text, country text default 'IN',
  address        text,
  contact_email  citext, contact_phone text,
  timezone       text not null default 'Asia/Kolkata',
  currency       char(3) not null default 'INR',
  fee_mode       fee_mode not null default 'player_pays',
  default_monthly_fee_paise integer not null default 20000,   -- ₹200.00
  grace_period_days integer not null default 7,
  attendance_edit_window_hours integer not null default 48,
  absence_alert_streak integer not null default 3,
  settings       jsonb not null default '{}'::jsonb,          -- feature flags, branding
  owner_user_id  uuid not null references profiles(id),
  plan_id        uuid,                                        -- fk added after plans
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create table academy_members (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  role        app_role not null,
  status      member_status not null default 'active',
  invited_by  uuid references profiles(id),
  joined_at   timestamptz,
  left_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (academy_id, user_id, role)
);
create index on academy_members (user_id, status);
create index on academy_members (academy_id, role, status);

-- join codes (regenerable, expirable, usage-capped)
create table academy_join_codes (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  code        text not null,
  role        app_role not null default 'player',
  is_active   boolean not null default true,
  expires_at  timestamptz,
  max_uses    integer,
  use_count   integer not null default 0,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create unique index uniq_active_join_code on academy_join_codes (code) where is_active;
create index on academy_join_codes (academy_id, is_active);

create table join_requests (
  id             uuid primary key default gen_random_uuid(),
  academy_id     uuid not null references academies(id) on delete cascade,
  user_id        uuid not null references profiles(id) on delete cascade,
  join_code_id   uuid references academy_join_codes(id),
  requested_role app_role not null default 'player',
  status         join_status not null default 'pending',
  message        text,
  preferred_batch_id uuid,
  reviewed_by    uuid references profiles(id),
  reviewed_at    timestamptz,
  rejection_reason text,
  created_at     timestamptz not null default now()
);
create unique index uniq_pending_request on join_requests (academy_id, user_id) where status = 'pending';

create table academy_invites (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  email      citext not null,
  role       app_role not null,
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on academy_invites (academy_id, email);

-- ============================ 4. PEOPLE =====================================
create table players (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references academies(id) on delete cascade,
  user_id       uuid references profiles(id) on delete set null, -- null = offline-managed player
  player_code   text,                          -- academy roll no
  date_of_birth date,
  batting_style text check (batting_style in ('right_hand','left_hand')),
  bowling_style text,                          -- e.g. right_arm_offbreak
  player_role   text check (player_role in ('batsman','bowler','all_rounder','wicketkeeper')),
  skill_level   skill_level default 'beginner',
  jersey_number integer,
  guardian_name text, guardian_phone text, guardian_email citext,
  emergency_contact text,
  medical_notes text,
  joined_on     date not null default current_date,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (academy_id, user_id),
  unique (academy_id, player_code)
);
create index on players (academy_id, is_active);

create table coaches (
  id             uuid primary key default gen_random_uuid(),
  academy_id     uuid not null references academies(id) on delete cascade,
  user_id        uuid not null references profiles(id) on delete cascade,
  specialization text[],                       -- {batting,bowling,fielding}
  certifications jsonb not null default '[]'::jsonb,
  bio            text,
  experience_years integer,
  availability   jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (academy_id, user_id)
);

-- ============================ 5. BATCHES & SESSIONS =========================
create table venues (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  name       text not null,
  address    text,
  nets_count integer,
  created_at timestamptz not null default now()
);

create table batches (
  id           uuid primary key default gen_random_uuid(),
  academy_id   uuid not null references academies(id) on delete cascade,
  name         text not null,
  description  text,
  age_group    text,                    -- 'U12','U16','Senior'
  skill_level  skill_level,
  venue_id     uuid references venues(id),
  capacity     integer,
  monthly_fee_paise integer,            -- overrides academy default when set
  start_date   date, end_date date,
  is_active    boolean not null default true,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (academy_id, name)
);
create index on batches (academy_id, is_active);

-- weekly recurrence rows; sessions are materialized from these
create table batch_schedules (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  batch_id    uuid not null references batches(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),  -- 0=Sunday
  start_time  time not null,
  end_time    time not null,
  venue_id    uuid references venues(id),
  effective_from date not null default current_date,
  effective_to   date,
  check (end_time > start_time)
);
create index on batch_schedules (batch_id, weekday);

create table batch_coaches (
  academy_id uuid not null references academies(id) on delete cascade,
  batch_id   uuid not null references batches(id) on delete cascade,
  coach_id   uuid not null references coaches(id) on delete cascade,
  is_primary boolean not null default false,
  assigned_at timestamptz not null default now(),
  primary key (batch_id, coach_id)
);
create index on batch_coaches (coach_id);

-- many-to-many: a player may belong to multiple batches, with history
create table batch_players (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  batch_id   uuid not null references batches(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  is_active  boolean generated always as (left_at is null) stored
);
create unique index uniq_active_batch_player on batch_players (batch_id, player_id) where left_at is null;
create index on batch_players (player_id) where left_at is null;

create table sessions (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references academies(id) on delete cascade,
  batch_id      uuid not null references batches(id) on delete cascade,
  schedule_id   uuid references batch_schedules(id) on delete set null, -- null = one-off
  title         text,
  focus_area    text,
  session_date  date not null,
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  venue_id      uuid references venues(id),
  coach_id      uuid references coaches(id),
  status        session_status not null default 'scheduled',
  cancellation_reason text,
  notes         text,
  attendance_locked_at timestamptz,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_at > start_at)
);
create unique index uniq_session_slot on sessions (batch_id, start_at) where status <> 'cancelled';
create index on sessions (academy_id, session_date);
create index on sessions (coach_id, session_date);

create table attendance (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references academies(id) on delete cascade,
  session_id    uuid not null references sessions(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  status        attendance_status not null,
  arrival_time  timestamptz,
  note          text,
  marked_by     uuid references profiles(id),
  marked_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (session_id, player_id)
);
create index on attendance (player_id, marked_at desc);
create index on attendance (academy_id, status);

-- ============================ 6. DRILLS & FEEDBACK ==========================
create table drills (
  id           uuid primary key default gen_random_uuid(),
  academy_id   uuid references academies(id) on delete cascade, -- null = platform template
  name         text not null,
  category     drill_category not null,
  description  text,
  instructions text,
  duration_minutes integer,
  equipment    text[],
  difficulty   skill_level,
  video_url    text, image_url text,
  tags         text[],
  is_template  boolean not null default false,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index on drills (academy_id, category);

create table session_drills (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  drill_id   uuid not null references drills(id),
  sort_order integer not null default 0,
  duration_minutes integer,
  coach_notes text,
  unique (session_id, drill_id)
);

create table player_drill_results (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  session_drill_id uuid not null references session_drills(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  metrics    jsonb not null default '{}'::jsonb,   -- {balls:60, accuracy:0.7}
  rating     smallint check (rating between 1 and 5),
  notes      text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (session_drill_id, player_id)
);

create table feedback (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  coach_id    uuid not null references coaches(id) on delete cascade,
  session_id  uuid references sessions(id) on delete set null,
  rating_technique smallint check (rating_technique between 1 and 5),
  rating_fitness   smallint check (rating_fitness between 1 and 5),
  rating_discipline smallint check (rating_discipline between 1 and 5),
  rating_game_sense smallint check (rating_game_sense between 1 and 5),
  strengths      text,
  improvements   text,
  private_note   text,                 -- staff only, never exposed to player
  is_visible_to_player boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index on feedback (player_id, created_at desc);

-- player-safe projection (private_note excluded)
create view feedback_player_view as
  select id, academy_id, player_id, coach_id, session_id,
         rating_technique, rating_fitness, rating_discipline, rating_game_sense,
         strengths, improvements, created_at
  from feedback
  where is_visible_to_player and deleted_at is null;

-- ============================ 7. CRICHEROES & MATCHES =======================
create table cricheroes_links (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references academies(id) on delete cascade,
  team_url      text,
  team_external_id text,
  player_id     uuid references players(id) on delete cascade,   -- null row = team-level link
  player_external_id text,
  player_profile_url text,
  verified_at   timestamptz,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  unique (academy_id, player_id)
);

create table cricheroes_sync_runs (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  trigger    text not null default 'cron',    -- cron | manual | csv
  status     sync_status not null default 'queued',
  matches_found integer default 0,
  matches_imported integer default 0,
  error      text,
  started_at timestamptz, finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table cricheroes_raw_imports (
  id           uuid primary key default gen_random_uuid(),
  academy_id   uuid not null references academies(id) on delete cascade,
  sync_run_id  uuid references cricheroes_sync_runs(id) on delete cascade,
  source_url   text,
  payload      jsonb not null,
  checksum     text not null,
  processed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (academy_id, checksum)
);

create table matches (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references academies(id) on delete cascade,
  external_id   text,                         -- cricheroes match id
  source        text not null default 'cricheroes',  -- cricheroes | manual | csv
  match_date    date not null,
  format        match_format not null default 't20',
  tournament    text,
  venue         text,
  team_name     text,
  opponent_name text,
  result        text,                         -- won | lost | tie | no_result
  our_score     text, opponent_score text,
  scorecard_url text,
  created_at    timestamptz not null default now(),
  unique (academy_id, source, external_id)
);
create index on matches (academy_id, match_date desc);

create table match_performances (
  id           uuid primary key default gen_random_uuid(),
  academy_id   uuid not null references academies(id) on delete cascade,
  match_id     uuid not null references matches(id) on delete cascade,
  player_id    uuid not null references players(id) on delete cascade,
  -- batting
  runs_scored  integer default 0,
  balls_faced  integer default 0,
  fours integer default 0, sixes integer default 0,
  is_out       boolean default false,
  dismissal_type text,
  -- bowling
  overs_bowled numeric(4,1) default 0,
  runs_conceded integer default 0,
  wickets      integer default 0,
  maidens      integer default 0,
  wides integer default 0, no_balls integer default 0,
  -- fielding
  catches integer default 0, run_outs integer default 0, stumpings integer default 0,
  created_at   timestamptz not null default now(),
  unique (match_id, player_id)
);
create index on match_performances (player_id);

-- ============================ 8. BILLING ====================================
create table plans (                        -- platform-level SaaS plans (super admin)
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,       -- free | starter | pro
  name          text not null,
  price_paise   integer not null default 0,
  billing_period text not null default 'monthly',
  max_players   integer, max_coaches integer, max_batches integer,
  features      jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true
);
alter table academies add constraint academies_plan_fk
  foreign key (plan_id) references plans(id);

create table subscriptions (                -- one per player per academy
  id                uuid primary key default gen_random_uuid(),
  academy_id        uuid not null references academies(id) on delete cascade,
  player_id         uuid not null references players(id) on delete cascade,
  payer_type        payer_type not null,          -- snapshot of academy.fee_mode
  monthly_fee_paise integer not null,
  status            sub_status not null default 'active',
  current_period_start date not null,
  current_period_end   date not null,
  paid_until        date,
  grace_until       date,
  paused_from date, paused_to date, pause_reason text,
  discount_percent  numeric(5,2) default 0 check (discount_percent between 0 and 100),
  auto_renew        boolean not null default false,
  cancelled_at      timestamptz, cancel_reason text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (academy_id, player_id)
);
create index on subscriptions (academy_id, status, current_period_end);

create table invoices (
  id             uuid primary key default gen_random_uuid(),
  academy_id     uuid not null references academies(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  player_id      uuid references players(id) on delete set null,
  invoice_number text not null,
  payer_type     payer_type not null,
  period_start   date not null,
  period_end     date not null,
  months_covered integer not null default 1,
  amount_paise       integer not null,
  discount_paise     integer not null default 0,
  amount_paid_paise  integer not null default 0,
  amount_due_paise   integer generated always as
                     (amount_paise - discount_paise - amount_paid_paise) stored,
  status         invoice_status not null default 'open',
  issued_on      date not null default current_date,
  due_date       date not null,
  pdf_path       text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (academy_id, invoice_number)
);
create index on invoices (academy_id, status, due_date);
create index on invoices (player_id, period_start);

create table payments (                     -- immutable money-in records
  id                uuid primary key default gen_random_uuid(),
  academy_id        uuid not null references academies(id) on delete cascade,
  player_id         uuid references players(id) on delete set null,
  paid_by_user_id   uuid references profiles(id),
  amount_paise      integer not null check (amount_paise > 0),
  currency          char(3) not null default 'INR',
  method            payment_method not null,
  status            payment_status not null default 'created',
  provider          text,                   -- razorpay | stripe | offline
  provider_order_id text,
  provider_payment_id text,
  idempotency_key   text,
  months_paid       integer not null default 1,   -- flexible renewal: 1/3/6/12
  received_at       timestamptz,
  recorded_by       uuid references profiles(id), -- for cash entries
  verified_by       uuid references profiles(id),
  receipt_path      text,
  raw_payload       jsonb,
  created_at        timestamptz not null default now(),
  unique (provider, provider_payment_id),
  unique (academy_id, idempotency_key)
);
create index on payments (academy_id, received_at desc);

create table payment_allocations (          -- payment → invoice(s)
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  payment_id uuid not null references payments(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, invoice_id)
);

create table refunds (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  payment_id uuid not null references payments(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  reason     text,
  provider_refund_id text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============================ 9. NOTIFICATIONS & JOBS ======================
create table notification_templates (
  id        uuid primary key default gen_random_uuid(),
  event_key text unique not null,           -- join_request.created, payment.due ...
  title_tpl text not null,
  body_tpl  text not null,
  default_channels notif_channel[] not null default '{in_app,push}'
);

create table notification_preferences (
  user_id    uuid not null references profiles(id) on delete cascade,
  event_key  text not null,
  channels   notif_channel[] not null default '{in_app,push}',
  quiet_hours_start time, quiet_hours_end time,
  primary key (user_id, event_key)
);

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid references academies(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  event_key  text not null,
  title      text not null,
  body       text,
  data       jsonb not null default '{}'::jsonb,   -- deep link payload
  channel    notif_channel not null default 'in_app',
  status     notif_status not null default 'queued',
  sent_at    timestamptz, read_at timestamptz, error text,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, read_at, created_at desc);

create table report_jobs (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references academies(id) on delete cascade,
  requested_by uuid not null references profiles(id),
  report      report_type not null,
  format      export_format not null,
  params      jsonb not null default '{}'::jsonb,   -- {batch_id, from, to, player_id}
  status      job_status not null default 'queued',
  file_path   text, file_size_bytes bigint,
  error       text,
  started_at timestamptz, finished_at timestamptz, expires_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on report_jobs (academy_id, status, created_at desc);

create table audit_logs (
  id          bigserial primary key,
  academy_id  uuid references academies(id) on delete set null,
  actor_id    uuid references profiles(id),
  action      text not null,                 -- player.approved, invoice.voided
  entity_type text not null, entity_id uuid,
  before      jsonb, after jsonb,
  ip          inet, user_agent text,
  created_at  timestamptz not null default now()
);
create index on audit_logs (academy_id, created_at desc);
create index on audit_logs (entity_type, entity_id);

-- ============================ 10. HELPER FUNCTIONS (RLS) ====================
create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_super_admin from profiles where id = auth.uid()), false);
$$;

create or replace function has_role(p_academy uuid, p_roles app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select is_super_admin() or exists (
    select 1 from academy_members m
    where m.academy_id = p_academy and m.user_id = auth.uid()
      and m.status = 'active' and m.role = any(p_roles));
$$;

create or replace function is_member(p_academy uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(p_academy, array['academy_owner','coach','player']::app_role[]);
$$;

create or replace function is_owner(p_academy uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(p_academy, array['academy_owner']::app_role[]);
$$;

create or replace function is_staff(p_academy uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(p_academy, array['academy_owner','coach']::app_role[]);
$$;

create or replace function my_player_id(p_academy uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from players where academy_id = p_academy and user_id = auth.uid();
$$;

create or replace function coaches_batch(p_batch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from batch_coaches bc join coaches c on c.id = bc.coach_id
    where bc.batch_id = p_batch and c.user_id = auth.uid() and c.is_active);
$$;

create or replace function in_batch(p_batch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from batch_players bp join players p on p.id = bp.player_id
    where bp.batch_id = p_batch and p.user_id = auth.uid() and bp.left_at is null);
$$;

-- ============================ 11. RLS POLICIES (representative set) =========
-- Pattern: enable RLS on every table; SELECT for members of the academy,
-- WRITE restricted by role; players restricted to own rows.
alter table profiles            enable row level security;
alter table academies           enable row level security;
alter table academy_members     enable row level security;
alter table academy_join_codes  enable row level security;
alter table join_requests       enable row level security;
alter table academy_invites     enable row level security;
alter table players             enable row level security;
alter table coaches             enable row level security;
alter table venues              enable row level security;
alter table batches             enable row level security;
alter table batch_schedules     enable row level security;
alter table batch_coaches       enable row level security;
alter table batch_players       enable row level security;
alter table sessions            enable row level security;
alter table attendance          enable row level security;
alter table drills              enable row level security;
alter table session_drills      enable row level security;
alter table player_drill_results enable row level security;
alter table feedback            enable row level security;
alter table cricheroes_links    enable row level security;
alter table cricheroes_sync_runs enable row level security;
alter table cricheroes_raw_imports enable row level security;
alter table matches             enable row level security;
alter table match_performances  enable row level security;
alter table subscriptions       enable row level security;
alter table invoices            enable row level security;
alter table payments            enable row level security;
alter table payment_allocations enable row level security;
alter table refunds             enable row level security;
alter table notifications       enable row level security;
alter table notification_preferences enable row level security;
alter table push_subscriptions  enable row level security;
alter table report_jobs         enable row level security;
alter table audit_logs          enable row level security;
alter table plans               enable row level security;

-- profiles: self + staff of a shared academy
create policy profiles_self on profiles for select using (
  id = auth.uid() or is_super_admin() or exists (
    select 1 from academy_members me
    join academy_members them on them.academy_id = me.academy_id
    where me.user_id = auth.uid() and me.role in ('academy_owner','coach')
      and me.status = 'active' and them.user_id = profiles.id));
create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- academies
create policy academies_select on academies for select using (is_member(id) or is_super_admin());
create policy academies_insert on academies for insert with check (owner_user_id = auth.uid() or is_super_admin());
create policy academies_update on academies for update using (is_owner(id)) with check (is_owner(id));

-- memberships: members read; owners manage
create policy members_select on academy_members for select
  using (user_id = auth.uid() or is_staff(academy_id));
create policy members_write on academy_members for all
  using (is_owner(academy_id)) with check (is_owner(academy_id));

-- join codes: only staff read (never expose all codes), owner writes
create policy join_codes_select on academy_join_codes for select using (is_staff(academy_id));
create policy join_codes_write  on academy_join_codes for all
  using (is_owner(academy_id)) with check (is_owner(academy_id));
-- code redemption happens through SECURITY DEFINER rpc request_join_by_code()

create policy join_req_select on join_requests for select
  using (user_id = auth.uid() or is_owner(academy_id));
create policy join_req_update on join_requests for update
  using (is_owner(academy_id)) with check (is_owner(academy_id));

-- players
create policy players_select on players for select
  using (is_staff(academy_id) or user_id = auth.uid());
create policy players_write  on players for all
  using (is_owner(academy_id)) with check (is_owner(academy_id));
create policy players_self_update on players for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- coaches
create policy coaches_select on coaches for select using (is_member(academy_id));
create policy coaches_write  on coaches for all
  using (is_owner(academy_id)) with check (is_owner(academy_id));
create policy coaches_self_update on coaches for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- batches & links
create policy batches_select on batches for select using (is_member(academy_id));
create policy batches_write  on batches for all
  using (is_owner(academy_id)) with check (is_owner(academy_id));
create policy bp_select on batch_players for select
  using (is_staff(academy_id) or player_id = my_player_id(academy_id));
create policy bp_write on batch_players for all
  using (is_owner(academy_id)) with check (is_owner(academy_id));
create policy bc_select on batch_coaches for select using (is_member(academy_id));
create policy bc_write  on batch_coaches for all
  using (is_owner(academy_id)) with check (is_owner(academy_id));

-- sessions: staff manage own batches, players read their batches' sessions
create policy sessions_select on sessions for select using (
  is_owner(academy_id) or coaches_batch(batch_id) or in_batch(batch_id));
create policy sessions_write on sessions for all using (
  is_owner(academy_id) or coaches_batch(batch_id))
  with check (is_owner(academy_id) or coaches_batch(batch_id));

-- attendance: staff of the session's batch write; player reads own
create policy attendance_select on attendance for select using (
  is_owner(academy_id)
  or exists (select 1 from sessions s where s.id = session_id and coaches_batch(s.batch_id))
  or player_id = my_player_id(academy_id));
create policy attendance_write on attendance for all using (
  is_owner(academy_id)
  or exists (select 1 from sessions s where s.id = session_id and coaches_batch(s.batch_id)))
  with check (
  is_owner(academy_id)
  or exists (select 1 from sessions s where s.id = session_id and coaches_batch(s.batch_id)));

-- drills: templates readable by all authenticated; academy drills by members
create policy drills_select on drills for select
  using (is_template or is_member(academy_id));
create policy drills_write on drills for all
  using (is_staff(academy_id)) with check (is_staff(academy_id));

-- feedback: staff full (own academy); players only via feedback_player_view
create policy feedback_staff on feedback for all
  using (is_staff(academy_id)) with check (is_staff(academy_id));
create policy feedback_player_read on feedback for select using (
  player_id = my_player_id(academy_id) and is_visible_to_player);
-- NOTE: application/player clients must query feedback_player_view (no private_note).

-- matches & stats: members read, owner writes (sync writes via service role)
create policy matches_select on matches for select using (is_member(academy_id));
create policy matches_write  on matches for all
  using (is_owner(academy_id)) with check (is_owner(academy_id));
create policy perf_select on match_performances for select
  using (is_staff(academy_id) or player_id = my_player_id(academy_id));
create policy perf_write on match_performances for all
  using (is_owner(academy_id)) with check (is_owner(academy_id));
create policy ch_links_all on cricheroes_links for all
  using (is_owner(academy_id)) with check (is_owner(academy_id));
create policy ch_runs_select on cricheroes_sync_runs for select using (is_owner(academy_id));
create policy ch_raw_select  on cricheroes_raw_imports for select using (is_owner(academy_id));

-- billing: owner full; player reads own
create policy subs_select on subscriptions for select
  using (is_staff(academy_id) or player_id = my_player_id(academy_id));
create policy subs_write on subscriptions for all
  using (is_owner(academy_id)) with check (is_owner(academy_id));
create policy inv_select on invoices for select
  using (is_owner(academy_id) or player_id = my_player_id(academy_id));
create policy inv_write on invoices for all
  using (is_owner(academy_id)) with check (is_owner(academy_id));
create policy pay_select on payments for select
  using (is_owner(academy_id) or player_id = my_player_id(academy_id));
create policy pay_insert on payments for insert with check (is_owner(academy_id));
-- online payments are inserted by Edge Function using the service role key
create policy alloc_select on payment_allocations for select
  using (is_owner(academy_id) or exists (
    select 1 from invoices i where i.id = invoice_id and i.player_id = my_player_id(academy_id)));
create policy refunds_all on refunds for all
  using (is_owner(academy_id)) with check (is_owner(academy_id));

-- notifications & prefs: self only
create policy notif_select on notifications for select using (user_id = auth.uid());
create policy notif_update on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy prefs_all on notification_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_all on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reports & audit
create policy reports_select on report_jobs for select
  using (requested_by = auth.uid() or is_owner(academy_id));
create policy reports_insert on report_jobs for insert
  with check (is_member(academy_id) and requested_by = auth.uid());
create policy audit_select on audit_logs for select using (is_owner(academy_id) or is_super_admin());
create policy plans_select on plans for select using (true);
create policy plans_write  on plans for all using (is_super_admin()) with check (is_super_admin());

-- ============================ 12. TRANSACTIONAL RPCs (signatures) ==========
-- request_join_by_code(p_code text, p_profile jsonb) returns join_requests
-- approve_join_request(p_request_id uuid, p_batch_ids uuid[]) returns players
-- reject_join_request(p_request_id uuid, p_reason text) returns void
-- regenerate_join_code(p_academy uuid, p_expires_at timestamptz, p_max_uses int) returns text
-- bulk_mark_attendance(p_session uuid, p_rows jsonb) returns int   -- idempotent upsert
-- generate_sessions_for_batch(p_batch uuid, p_until date) returns int
-- record_offline_payment(p_player uuid, p_amount_paise int, p_months int, p_method payment_method) returns payments
-- allocate_payment(p_payment uuid) returns void   -- FIFO across open invoices
-- generate_monthly_invoices(p_academy uuid, p_period date) returns int
-- extend_subscription(p_subscription uuid, p_months int) returns subscriptions
-- attendance_summary(p_academy uuid, p_from date, p_to date, p_batch uuid) returns table(...)

-- ============================ 13. ANALYTICS VIEWS ==========================
create view v_player_attendance as
select a.academy_id, a.player_id, s.batch_id,
       date_trunc('month', s.session_date)::date as month,
       count(*) filter (where a.status in ('present','late')) as attended,
       count(*) as total,
       round(100.0 * count(*) filter (where a.status in ('present','late')) / nullif(count(*),0), 1) as attendance_pct
from attendance a join sessions s on s.id = a.session_id
where s.status = 'completed'
group by 1,2,3,4;

create view v_player_batting_stats as
select academy_id, player_id,
       count(*) as innings,
       sum(runs_scored) as runs, sum(balls_faced) as balls,
       round(100.0 * sum(runs_scored) / nullif(sum(balls_faced),0), 2) as strike_rate,
       round(sum(runs_scored)::numeric / nullif(count(*) filter (where is_out),0), 2) as average,
       max(runs_scored) as highest, sum(fours) as fours, sum(sixes) as sixes
from match_performances group by 1,2;

create view v_player_bowling_stats as
select academy_id, player_id,
       count(*) filter (where overs_bowled > 0) as innings,
       sum(overs_bowled) as overs, sum(wickets) as wickets, sum(runs_conceded) as runs_conceded,
       round(sum(runs_conceded)::numeric / nullif(sum(overs_bowled),0), 2) as economy,
       round(sum(runs_conceded)::numeric / nullif(sum(wickets),0), 2) as bowling_average
from match_performances group by 1,2;

create materialized view mv_academy_dashboard as
select a.id as academy_id,
       (select count(*) from players p where p.academy_id = a.id and p.is_active) as active_players,
       (select count(*) from coaches c where c.academy_id = a.id and c.is_active) as active_coaches,
       (select count(*) from batches b where b.academy_id = a.id and b.is_active) as active_batches,
       (select count(*) from join_requests j where j.academy_id = a.id and j.status='pending') as pending_requests,
       (select coalesce(sum(i.amount_due_paise),0) from invoices i
          where i.academy_id = a.id and i.status in ('open','partially_paid','overdue')) as outstanding_paise
from academies a where a.deleted_at is null;
create unique index on mv_academy_dashboard (academy_id);

-- ============================ 14. SCHEDULED JOBS (pg_cron) ==================
-- select cron.schedule('gen-sessions',   '0 1 * * *',  $$select generate_all_sessions(56)$$);
-- select cron.schedule('gen-invoices',   '30 0 * * *', $$select generate_due_invoices()$$);
-- select cron.schedule('mark-overdue',   '0 2 * * *',  $$select mark_overdue_invoices()$$);
-- select cron.schedule('refresh-dash',   '*/15 * * * *', $$refresh materialized view concurrently mv_academy_dashboard$$);
-- Edge-Function-backed cron (session reminders, push fan-out, cricheroes sync)
-- is scheduled via Supabase scheduled functions / cron http calls.

-- ============================ 15. STORAGE BUCKETS ===========================
-- avatars (public read)          : profiles/{user_id}/...
-- academy-assets (public read)   : {academy_id}/logo.png
-- drill-media (signed)           : {academy_id}/drills/{drill_id}/...
-- reports (private, signed 24h)  : {academy_id}/reports/{job_id}.pdf|xlsx
-- receipts (private, signed)     : {academy_id}/receipts/{payment_id}.pdf
-- imports (private)              : {academy_id}/cricheroes/{run_id}.csv
