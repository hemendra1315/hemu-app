-- Platform subscription: every user of the app (any role -- owner, coach,
-- player, parent) owes the app's creator (the super_admin) a monthly fee,
-- paid via the super admin's own UPI QR code. This is entirely separate from
-- the academy-level Player Fees / Payment QR feature (player pays academy
-- owner, already shipped) -- this is user pays app creator, tracked
-- centrally by super_admin, not enforced (no automatic lockout for anyone
-- unpaid -- explicitly a tracking-only feature per the app creator's own
-- decision).

-- Singleton settings row: the super admin's QR image, an optional note, and
-- the monthly amount (defaults to Rs 200 = 20000 paise), editable by them at
-- any time from a settings page.
create table public.platform_settings (
  id text primary key default 'default',
  payment_qr_url text,
  payment_note text,
  monthly_fee_paise integer not null default 20000,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values ('default')
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

-- Every signed-in user needs to see the QR and amount to know what to pay.
create policy platform_settings_select on public.platform_settings as PERMISSIVE for SELECT to public
  using (auth.role() = 'authenticated');

-- Only the app creator can change the QR/amount/note.
create policy platform_settings_super_admin_all on public.platform_settings as PERMISSIVE for ALL to public
  using (is_super_admin())
  with check (is_super_admin());

-- One ledger row per payment the super admin has recorded for a user. Same
-- shape as `fee_payments` (the academy-level equivalent), but keyed to a
-- user (`profiles`) instead of a player (`academy_members`), since this is
-- platform-wide and not scoped to any one academy.
create table public.platform_subscription_payments (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  amount_paise integer not null check (amount_paise > 0),
  period_month date not null,
  paid_on date not null,
  method text,
  notes text,
  recorded_by uuid,
  created_at timestamptz not null default now(),
  constraint platform_subscription_payments_pkey primary key (id),
  constraint platform_subscription_payments_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint platform_subscription_payments_recorded_by_fkey foreign key (recorded_by) references public.profiles(id),
  constraint platform_subscription_payments_period_month_check check (period_month = date_trunc('month', period_month)::date)
);

create index platform_subscription_payments_user_period_idx
  on public.platform_subscription_payments (user_id, period_month);

alter table public.platform_subscription_payments enable row level security;

-- A user can read only their own payment history -- never anyone else's.
create policy platform_subscription_payments_select_own on public.platform_subscription_payments as PERMISSIVE for SELECT to public
  using (user_id = auth.uid());

-- The app creator can read everyone's and is the only one who can record,
-- edit, or remove a payment (marking someone paid is a manual, private
-- action -- nothing here is user-initiated or automatic).
create policy platform_subscription_payments_super_admin_all on public.platform_subscription_payments as PERMISSIVE for ALL to public
  using (is_super_admin())
  with check (is_super_admin());

-- Storage bucket for the single platform QR image. Unlike the per-academy
-- `academy-payment-qr` bucket, there's only ever one owner (the app
-- creator), so the RLS checks `is_super_admin()` directly instead of
-- parsing an academy-id path prefix.
insert into storage.buckets (id, name, public)
values ('platform-payment-qr', 'platform-payment-qr', true)
on conflict (id) do nothing;

create policy "Public Platform QR Access" on storage.objects as PERMISSIVE for SELECT to public
  using (bucket_id = 'platform-payment-qr');

create policy "Super Admin Can Upload Platform QR" on storage.objects as PERMISSIVE for INSERT to public
  with check (
    bucket_id = 'platform-payment-qr'
    and auth.role() = 'authenticated'
    and is_super_admin()
  );

create policy "Super Admin Can Update Platform QR" on storage.objects as PERMISSIVE for UPDATE to public
  using (
    bucket_id = 'platform-payment-qr'
    and auth.role() = 'authenticated'
    and is_super_admin()
  );

create policy "Super Admin Can Delete Platform QR" on storage.objects as PERMISSIVE for DELETE to public
  using (
    bucket_id = 'platform-payment-qr'
    and auth.role() = 'authenticated'
    and is_super_admin()
  );
