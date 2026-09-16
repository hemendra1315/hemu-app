-- Migration: Payment receipt storage bucket + real evidence column
--
-- Fixes the P0 finding that student monthly-fee payment receipt screenshots were
-- being base64-encoded and stuffed into `platform_subscription_claims.note`
-- (and localStorage) instead of being uploaded as real files. This migration:
--   1. Adds a dedicated `receipt_storage_path` column to
--      `platform_subscription_claims` for the Storage object path (not base64).
--   2. Creates a private `payment-receipts` Storage bucket.
--   3. Adds RLS so a user can upload/read only their own receipts (objects
--      whose path is prefixed with their own auth.uid()), and super admins can
--      read every receipt (to resolve claims).
--
-- `platform_subscription_claims` / `platform_subscription_payments` already
-- exist in production (created outside this repo's migration history), so
-- every statement here is defensive (`if not exists` / `if exists`) and safe
-- to run against a database that already has data in those tables — the one
-- existing `platform_subscription_payments` row is untouched by this
-- migration (it only adds a new nullable column to a different table).

-- 1. Real evidence column on the claims table (nullable: legacy/base64 rows,
--    of which there are currently zero in production, remain readable).
alter table if exists public.platform_subscription_claims
  add column if not exists receipt_storage_path text;

comment on column public.platform_subscription_claims.receipt_storage_path is
  'Path of the payment receipt screenshot inside the private "payment-receipts" Storage bucket, e.g. "<user_id>/<uuid>.jpg". Not a base64 payload.';

-- 2. Private bucket for receipt screenshots (5MB limit matches the client-side check).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];

-- 3. RLS: object path must be "<auth.uid()>/...", so users only ever touch
--    their own receipts; super admins can read every receipt to resolve claims.
do $$
begin
  drop policy if exists "Users Can Upload Own Payment Receipt" on storage.objects;
  create policy "Users Can Upload Own Payment Receipt" on storage.objects for insert with check (
    bucket_id = 'payment-receipts'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

  drop policy if exists "Users Can Read Own Payment Receipt" on storage.objects;
  create policy "Users Can Read Own Payment Receipt" on storage.objects for select using (
    bucket_id = 'payment-receipts'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

  drop policy if exists "Users Can Delete Own Payment Receipt" on storage.objects;
  create policy "Users Can Delete Own Payment Receipt" on storage.objects for delete using (
    bucket_id = 'payment-receipts'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

  drop policy if exists "Super Admins Can Read All Payment Receipts" on storage.objects;
  create policy "Super Admins Can Read All Payment Receipts" on storage.objects for select using (
    bucket_id = 'payment-receipts'
    and auth.role() = 'authenticated'
    and is_super_admin()
  );
end $$;
