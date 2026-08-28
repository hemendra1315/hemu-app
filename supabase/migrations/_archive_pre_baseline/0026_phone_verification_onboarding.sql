-- ------------------------------------------------------------- profiles -----
-- Add phone_verified column to profiles table for general onboarding verification
alter table profiles add column if not exists phone_verified boolean not null default false;

-- Backfill existing profiles with non-null phone numbers as verified so returning users are not disrupted
update profiles set phone_verified = true where phone is not null and phone != '';
