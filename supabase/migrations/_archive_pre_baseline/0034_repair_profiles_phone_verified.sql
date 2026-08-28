-- Repair migration for public.profiles.phone_verified drift
alter table profiles
add column if not exists phone_verified boolean not null default false;

update profiles
set phone_verified = true
where phone is not null and phone != '';
