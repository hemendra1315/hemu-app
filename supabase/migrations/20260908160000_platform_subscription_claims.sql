-- "I've Paid" self-report flow for the platform subscription. There's no
-- payment gateway (the app creator is under 18 with no bank account, only a
-- FamPay UPI account, so a merchant/gateway account isn't available to
-- them), so a payment can never be verified automatically. This adds a
-- lightweight middle ground: a user can claim they've paid (with the phone
-- number they paid FROM, so the app creator can match it against what shows
-- up in their own FamPay app), and the app creator does one tap to confirm
-- or dismiss the claim -- no manually typing amounts/dates for every user.
--
-- Claims are kept strictly separate from `platform_subscription_payments`
-- (the actual paid/unpaid source of truth, already RLS-locked to
-- super-admin-only writes): a user can insert their OWN claim, but only in
-- 'pending' status, and can never write a 'confirmed' claim or a payment row
-- themselves -- confirming a claim (which inserts the real payment row) is
-- exclusively a super_admin action performed from the app.
create table public.platform_subscription_claims (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  period_month date not null,
  payer_phone text not null,
  note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  constraint platform_subscription_claims_pkey primary key (id),
  constraint platform_subscription_claims_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint platform_subscription_claims_resolved_by_fkey foreign key (resolved_by) references public.profiles(id),
  constraint platform_subscription_claims_period_month_check check (period_month = date_trunc('month', period_month)::date),
  constraint platform_subscription_claims_status_check check (status in ('pending', 'confirmed', 'dismissed')),
  constraint platform_subscription_claims_payer_phone_check check (length(trim(payer_phone)) > 0)
);

create index platform_subscription_claims_user_period_idx
  on public.platform_subscription_claims (user_id, period_month);
create index platform_subscription_claims_status_period_idx
  on public.platform_subscription_claims (status, period_month);

alter table public.platform_subscription_claims enable row level security;

-- A user can see their own claims (any status).
create policy platform_subscription_claims_select_own on public.platform_subscription_claims as PERMISSIVE for SELECT to public
  using (user_id = auth.uid());

-- A user can submit their own claim, but only as 'pending' -- they cannot
-- insert a pre-confirmed row.
create policy platform_subscription_claims_insert_own on public.platform_subscription_claims as PERMISSIVE for INSERT to public
  with check (user_id = auth.uid() and status = 'pending');

-- A user can fix a typo (e.g. their phone number) on their own claim only
-- while it's still pending -- the `with check` repeats `status = 'pending'`
-- so this policy can never be used to move a claim OUT of pending, which is
-- what keeps "confirm" a super-admin-only action.
create policy platform_subscription_claims_update_own_pending on public.platform_subscription_claims as PERMISSIVE for UPDATE to public
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');

-- A user can withdraw their own claim while it's still pending (e.g. they
-- claimed by mistake).
create policy platform_subscription_claims_delete_own_pending on public.platform_subscription_claims as PERMISSIVE for DELETE to public
  using (user_id = auth.uid() and status = 'pending');

-- The app creator sees every claim and is the only one who can move a claim
-- to 'confirmed' or 'dismissed'.
create policy platform_subscription_claims_super_admin_all on public.platform_subscription_claims as PERMISSIVE for ALL to public
  using (is_super_admin())
  with check (is_super_admin());
