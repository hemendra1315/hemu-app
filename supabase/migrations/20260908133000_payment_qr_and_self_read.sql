-- Payment QR: the owner's UPI QR code image + an optional short note (e.g.
-- their UPI ID as backup text), shown to players so they can pay directly.
-- Stored on `academies` (one QR per academy, same shape as `logo_url`) rather
-- than a new table -- there's exactly one active QR per academy at a time.
alter table public.academies add column payment_qr_url text;
alter table public.academies add column payment_note text;

-- Storage bucket for the QR image, mirroring `academy-logos` exactly (same
-- public-read / owner-write policy shape, same `is_academy_owner_or_admin`
-- helper keyed off the first path segment).
insert into storage.buckets (id, name, public)
values ('academy-payment-qr', 'academy-payment-qr', true)
on conflict (id) do nothing;

create policy "Public Payment QR Access" on storage.objects as PERMISSIVE for SELECT to public
  using (bucket_id = 'academy-payment-qr');

create policy "Academy Owners Can Upload Payment QR" on storage.objects as PERMISSIVE for INSERT to public
  with check (
    bucket_id = 'academy-payment-qr'
    and auth.role() = 'authenticated'
    and is_academy_owner_or_admin((storage.foldername(name))[1])
  );

create policy "Academy Owners Can Update Payment QR" on storage.objects as PERMISSIVE for UPDATE to public
  using (
    bucket_id = 'academy-payment-qr'
    and auth.role() = 'authenticated'
    and is_academy_owner_or_admin((storage.foldername(name))[1])
  );

create policy "Academy Owners Can Delete Payment QR" on storage.objects as PERMISSIVE for DELETE to public
  using (
    bucket_id = 'academy-payment-qr'
    and auth.role() = 'authenticated'
    and is_academy_owner_or_admin((storage.foldername(name))[1])
  );

-- Let a player read their own fee row and payment history -- the
-- `billing:read_own` capability has existed on the PLAYER role in
-- `permissions.ts` since before this feature existed, but nothing backed it
-- until now. This is additive: RLS OR's permissive policies together for the
-- same command, so the owner's existing `player_fees_all`/`fee_payments_all`
-- policies (which already cover SELECT) are untouched -- this only widens who
-- else can read, never who can write.
create policy player_fees_select_own on public.player_fees as PERMISSIVE for SELECT to public
  using (exists (select 1 from academy_members m where m.id = player_fees.player_id and m.user_id = auth.uid()));

create policy fee_payments_select_own on public.fee_payments as PERMISSIVE for SELECT to public
  using (exists (select 1 from academy_members m where m.id = fee_payments.player_id and m.user_id = auth.uid()));
