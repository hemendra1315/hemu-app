-- "I've Paid" self-report claims for academy player fees, mirroring the
-- existing platform_subscription_claims pattern (claude/feature-platform-subscription.md
-- Round 2) -- there's no payment gateway here either, so a player still pays
-- the owner's UPI QR outside the app, but instead of the owner having to
-- remember to check and manually record every payment, the player can tap
-- "I've Paid" (phone number they paid from + optional note) and the owner
-- gets a one-tap Confirm/Dismiss. Confirm automatically creates the real
-- fee_payments row (using the player's current monthly_fee_paise), so the
-- owner never has to re-enter the amount/date by hand.

create table fee_payment_claims (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  player_id uuid not null references academy_members(id) on delete cascade,
  period_month date not null check (period_month = date_trunc('month', period_month::timestamptz)::date),
  payer_phone text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null
);

-- A player can only have one OPEN claim per month -- matches the UI, which
-- only ever shows the "I've Paid" button when no pending claim already
-- exists (same reasoning as the unique index added for parent linking codes
-- in bugfix-round21: enforce at the database, not just in the client).
create unique index fee_payment_claims_one_pending_per_player_period
  on fee_payment_claims (player_id, period_month)
  where status = 'pending';

alter table fee_payment_claims enable row level security;

-- These rows carry a phone number and are academy-financial data, so unlike
-- most new tables in this project (which get select/insert/update/delete
-- granted to anon automatically by this database's default privileges --
-- the exact gap the 2026-09-11 drift-check audit found and fixed for
-- cricheroes_imports), anon is locked out entirely and explicitly here from
-- the start, not discovered as a gap later.
revoke all on table fee_payment_claims from anon;

create policy fee_payment_claims_select on fee_payment_claims
  for select using (is_owner(academy_id) or player_id = my_player_id(academy_id));

create policy fee_payment_claims_insert_own on fee_payment_claims
  for insert with check (player_id = my_player_id(academy_id) and status = 'pending');

-- A player can withdraw their own still-open claim (the "Withdraw" action,
-- same UX as MySubscriptionPage's platform-subscription claim flow) but can
-- never touch a claim once the owner has confirmed or dismissed it.
create policy fee_payment_claims_delete_own_pending on fee_payment_claims
  for delete using (player_id = my_player_id(academy_id) and status = 'pending');

-- The owner can read/insert/update/delete every claim in their academy --
-- this is what makes Confirm/Dismiss exclusively an owner action; a player
-- can never move their own claim out of 'pending' (their insert/delete
-- policies above only ever touch a 'pending' row).
create policy fee_payment_claims_owner_all on fee_payment_claims
  for all using (is_owner(academy_id)) with check (is_owner(academy_id));

-- Confirms a claim: verifies the caller owns the academy and the claim is
-- still pending, looks up the player's current monthly fee, writes the real
-- fee_payments row (so this becomes the single source of truth the rest of
-- the app already reads from), and marks the claim resolved -- all in one
-- transaction, so the owner never re-types an amount or a date.
create or replace function public.confirm_fee_payment_claim(p_claim_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_claim record;
  v_amount integer;
  v_payment_id uuid;
begin
  select * into v_claim from fee_payment_claims where id = p_claim_id for update;

  if v_claim is null then
    raise exception 'E_NOT_FOUND: Claim does not exist'
      using errcode = 'P0002';
  end if;

  if not is_owner(v_claim.academy_id) then
    raise exception 'E_FORBIDDEN: Only the academy owner can confirm a payment claim'
      using errcode = '42501';
  end if;

  if v_claim.status <> 'pending' then
    raise exception 'E_INVALID_STATE: Claim is not pending'
      using errcode = '22023';
  end if;

  select monthly_fee_paise into v_amount
  from player_fees
  where academy_id = v_claim.academy_id and player_id = v_claim.player_id;

  if v_amount is null then
    raise exception 'E_NOT_FOUND: No fee amount is set for this player'
      using errcode = 'P0002';
  end if;

  insert into fee_payments (academy_id, player_id, amount_paise, period_month, paid_on, method, notes, recorded_by)
  values (
    v_claim.academy_id,
    v_claim.player_id,
    v_amount,
    v_claim.period_month,
    current_date,
    'upi_claim',
    nullif(
      'Confirmed from player claim (paid from ' || v_claim.payer_phone || ')' ||
      case when v_claim.note is not null and v_claim.note <> '' then ' — ' || v_claim.note else '' end,
      ''
    ),
    auth.uid()
  )
  returning id into v_payment_id;

  update fee_payment_claims
  set status = 'confirmed', resolved_at = now(), resolved_by = auth.uid()
  where id = p_claim_id;

  return jsonb_build_object('payment_id', v_payment_id);
end;
$function$;

-- Dismisses a claim without recording any payment -- for when what the
-- player describes doesn't match anything the owner actually received.
create or replace function public.dismiss_fee_payment_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_claim record;
begin
  select * into v_claim from fee_payment_claims where id = p_claim_id for update;

  if v_claim is null then
    raise exception 'E_NOT_FOUND: Claim does not exist'
      using errcode = 'P0002';
  end if;

  if not is_owner(v_claim.academy_id) then
    raise exception 'E_FORBIDDEN: Only the academy owner can dismiss a payment claim'
      using errcode = '42501';
  end if;

  if v_claim.status <> 'pending' then
    raise exception 'E_INVALID_STATE: Claim is not pending'
      using errcode = '22023';
  end if;

  update fee_payment_claims
  set status = 'dismissed', resolved_at = now(), resolved_by = auth.uid()
  where id = p_claim_id;
end;
$function$;

revoke all on function public.confirm_fee_payment_claim(uuid) from public, anon;
grant execute on function public.confirm_fee_payment_claim(uuid) to authenticated;

revoke all on function public.dismiss_fee_payment_claim(uuid) from public, anon;
grant execute on function public.dismiss_fee_payment_claim(uuid) to authenticated;
