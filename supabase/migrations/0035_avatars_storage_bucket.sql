-- Storage bucket for user avatars
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Policies for public reading and authenticated user avatar uploads
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public Avatar Access') then
    create policy "Public Avatar Access" on storage.objects for select using (bucket_id = 'avatars');
  end if;

  drop policy if exists "Users Can Upload Own Avatar" on storage.objects;
  create policy "Users Can Upload Own Avatar" on storage.objects for insert with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

  drop policy if exists "Users Can Update Own Avatar" on storage.objects;
  create policy "Users Can Update Own Avatar" on storage.objects for update using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

  drop policy if exists "Users Can Delete Own Avatar" on storage.objects;
  create policy "Users Can Delete Own Avatar" on storage.objects for delete using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
end $$;

