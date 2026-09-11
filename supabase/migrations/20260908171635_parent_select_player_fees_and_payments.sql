-- Let a parent read their linked child's fee amount and payment history,
-- same pattern already used for attendance/drills/matches (my_linked_member_ids).
-- Previously only the player themselves (or the academy owner) could see this.
--
-- Applied live via Supabase MCP on 2026-09-08 as part of the parent fee-visibility
-- feature; this file was missing from the repo until the 2026-09-11 CI drift
-- check caught the gap. Recreated here from the live database's own migration
-- history so it matches exactly what is already running in production.

create policy player_fees_select_parents
  on public.player_fees
  for select
  using (player_id in (select my_linked_member_ids(player_fees.academy_id)));

create policy fee_payments_select_parents
  on public.fee_payments
  for select
  using (player_id in (select my_linked_member_ids(fee_payments.academy_id)));
