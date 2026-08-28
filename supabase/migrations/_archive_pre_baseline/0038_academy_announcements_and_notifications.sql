-- Migration 0038: Academy Announcements & Notifications

create type audience_type as enum ('all', 'coaches', 'players', 'batch');
create type notif_channel as enum ('in_app', 'push', 'email');
create type notif_status  as enum ('queued', 'sent', 'failed', 'read');

create table announcements (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references academies(id) on delete cascade,
  created_by    uuid references profiles(id) on delete set null,
  title         text not null,
  message       text not null,
  audience      audience_type not null default 'all',
  batch_id      uuid references batches(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on announcements (academy_id, created_at desc);
create index on announcements (batch_id);

create table notifications (
  id                uuid primary key default gen_random_uuid(),
  academy_id        uuid not null references academies(id) on delete cascade,
  announcement_id   uuid references announcements(id) on delete cascade,
  recipient_user_id uuid not null references profiles(id) on delete cascade,
  title             text not null,
  message           text not null,
  notification_type text not null default 'announcement',
  channel           notif_channel not null default 'in_app',
  status            notif_status not null default 'queued',
  metadata          jsonb not null default '{}'::jsonb,
  read_at           timestamptz,
  created_at        timestamptz not null default now()
);

create index on notifications (recipient_user_id, read_at, created_at desc);

-- Realtime
alter publication supabase_realtime add table notifications;

-- RLS
alter table announcements enable row level security;
alter table notifications enable row level security;

-- Announcements RLS
create policy announcements_select on announcements for select
  using (is_member(academy_id));

create policy announcements_insert on announcements for insert
  with check (
    is_owner(academy_id)
    or (
      is_staff(academy_id) and audience = 'batch' and batch_id is not null and exists (
        select 1 from batches b
        join academy_members am on am.id = b.coach_id
        where b.id = announcements.batch_id and am.user_id = auth.uid()
      )
    )
  );

create policy announcements_update on announcements for update
  using (
    is_owner(academy_id)
    or (is_staff(academy_id) and created_by = auth.uid())
  )
  with check (
    is_owner(academy_id)
    or (is_staff(academy_id) and created_by = auth.uid())
  );

create policy announcements_delete on announcements for delete
  using (
    is_owner(academy_id)
    or (is_staff(academy_id) and created_by = auth.uid())
  );

-- Notifications RLS
create policy notifications_select on notifications for select
  using (recipient_user_id = auth.uid());

create policy notifications_update on notifications for update
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

create policy notifications_delete on notifications for delete
  using (recipient_user_id = auth.uid());

-- Trigger for Fan-out
create or replace function fanout_announcement_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.audience = 'all' then
    insert into notifications (academy_id, announcement_id, recipient_user_id, title, message, notification_type, metadata)
    select new.academy_id, new.id, user_id, new.title, new.message, 'announcement', jsonb_build_object('announcement_id', new.id)
    from academy_members
    where academy_id = new.academy_id and status = 'active'
    on conflict do nothing;
  elsif new.audience = 'coaches' then
    insert into notifications (academy_id, announcement_id, recipient_user_id, title, message, notification_type, metadata)
    select new.academy_id, new.id, user_id, new.title, new.message, 'announcement', jsonb_build_object('announcement_id', new.id)
    from academy_members
    where academy_id = new.academy_id and status = 'active' and role = 'coach'
    on conflict do nothing;
  elsif new.audience = 'players' then
    insert into notifications (academy_id, announcement_id, recipient_user_id, title, message, notification_type, metadata)
    select new.academy_id, new.id, user_id, new.title, new.message, 'announcement', jsonb_build_object('announcement_id', new.id)
    from academy_members
    where academy_id = new.academy_id and status = 'active' and role = 'player'
    on conflict do nothing;
  elsif new.audience = 'batch' and new.batch_id is not null then
    -- Insert for players in the batch
    insert into notifications (academy_id, announcement_id, recipient_user_id, title, message, notification_type, metadata)
    select new.academy_id, new.id, am.user_id, new.title, new.message, 'announcement', jsonb_build_object('announcement_id', new.id, 'batch_id', new.batch_id)
    from batch_members bm
    join academy_members am on am.id = bm.academy_member_id
    where bm.batch_id = new.batch_id and am.user_id is not null
    on conflict do nothing;
    
    -- Insert for coach assigned to the batch
    insert into notifications (academy_id, announcement_id, recipient_user_id, title, message, notification_type, metadata)
    select new.academy_id, new.id, am.user_id, new.title, new.message, 'announcement', jsonb_build_object('announcement_id', new.id, 'batch_id', new.batch_id)
    from batches b
    join academy_members am on am.id = b.coach_id
    where b.id = new.batch_id and am.user_id is not null
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger on_announcement_created
  after insert on announcements
  for each row execute function fanout_announcement_notifications();
