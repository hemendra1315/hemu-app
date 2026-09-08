-- Player fees: a custom monthly fee per player, plus a payment ledger the
-- owner records against it. Both are new -- unlike `coaches`/`batch_coaches`
-- in the baseline migration, nothing here existed before this feature.
--
-- `player_fees` holds the *current* monthly amount a player owes (one row
-- per player; editing it just updates the row -- history of amount changes
-- isn't tracked, only payment history is). `fee_payments` is the ledger:
-- one row per payment received, scoped to the calendar month it pays for
-- (`period_month`, always the first of that month) so "did they pay for
-- September" is a lookup, not a date-range guess. A player can be paid
-- for a month via more than one row (e.g. a partial payment topped up
-- later), so "paid" is computed as sum(amount_paise) for that month >=
-- the fee amount, not "a row exists".

create table public.player_fees (
  id uuid not null default gen_random_uuid(),
  academy_id uuid not null,
  player_id uuid not null,
  monthly_fee_paise integer not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.player_fees add constraint player_fees_pkey PRIMARY KEY (id);
alter table public.player_fees add constraint player_fees_player_id_key UNIQUE (player_id);
alter table public.player_fees
  add constraint player_fees_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE;
alter table public.player_fees
  add constraint player_fees_player_id_fkey FOREIGN KEY (player_id) REFERENCES academy_members(id) ON DELETE CASCADE;
alter table public.player_fees
  add constraint player_fees_monthly_fee_paise_check CHECK (monthly_fee_paise >= 0);

CREATE INDEX player_fees_academy_idx ON public.player_fees USING btree (academy_id);

create table public.fee_payments (
  id uuid not null default gen_random_uuid(),
  academy_id uuid not null,
  player_id uuid not null,
  amount_paise integer not null,
  period_month date not null,
  paid_on date not null default CURRENT_DATE,
  method text,
  notes text,
  recorded_by uuid default auth.uid(),
  created_at timestamp with time zone not null default now()
);

alter table public.fee_payments add constraint fee_payments_pkey PRIMARY KEY (id);
alter table public.fee_payments
  add constraint fee_payments_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE;
alter table public.fee_payments
  add constraint fee_payments_player_id_fkey FOREIGN KEY (player_id) REFERENCES academy_members(id) ON DELETE CASCADE;
alter table public.fee_payments
  add constraint fee_payments_amount_paise_check CHECK (amount_paise > 0);
alter table public.fee_payments
  add constraint fee_payments_period_month_check CHECK (period_month = date_trunc('month', period_month)::date);

CREATE INDEX fee_payments_player_idx ON public.fee_payments USING btree (player_id);
CREATE INDEX fee_payments_academy_period_idx ON public.fee_payments USING btree (academy_id, period_month);

-- Same defense-in-depth as `assert_batch_member_tenancy`: the RLS policies
-- below are the real gate, but a row whose `player_id` belongs to a
-- different academy than its own `academy_id` should never be writable even
-- if a future policy or RPC gets that check wrong.
CREATE OR REPLACE FUNCTION public.assert_fee_tenancy()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_person uuid;
begin
  select academy_id into v_person from academy_members where id = new.player_id;

  if v_person is distinct from new.academy_id then
    raise exception 'E_CROSS_ACADEMY' using errcode = '23514';
  end if;
  return new;
end $function$
;

GRANT EXECUTE ON FUNCTION public.assert_fee_tenancy() TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_fee_tenancy() TO authenticated;

CREATE TRIGGER player_fees_assert_tenancy BEFORE INSERT OR UPDATE OF player_id, academy_id ON public.player_fees
  FOR EACH ROW EXECUTE FUNCTION assert_fee_tenancy();
CREATE TRIGGER fee_payments_assert_tenancy BEFORE INSERT OR UPDATE OF player_id, academy_id ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION assert_fee_tenancy();

CREATE TRIGGER player_fees_set_updated_at BEFORE UPDATE ON public.player_fees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

alter table public.player_fees enable row level security;
alter table public.fee_payments enable row level security;

-- Owner-only, both ways. `is_owner()` already resolves true for a super
-- admin (it calls `has_role()`, which is `is_super_admin() or exists(...)`),
-- so no separate super-admin clause is needed here -- same pattern as
-- `batch_coaches_write`.
create policy player_fees_all on public.player_fees as PERMISSIVE for ALL to public
  using (is_owner(academy_id))
  with check (is_owner(academy_id));

create policy fee_payments_all on public.fee_payments as PERMISSIVE for ALL to public
  using (is_owner(academy_id))
  with check (is_owner(academy_id));
