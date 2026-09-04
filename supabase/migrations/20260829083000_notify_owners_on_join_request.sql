-- Nothing told an academy owner that somebody had asked to join. The requester
-- lands on a "waiting for approval" screen that polls every ten seconds, while
-- the only place the request appears is a strip at the top of /members that the
-- owner has to happen to open. People sat unapproved indefinitely.
--
-- This writes an in-app notification to every owner of the academy the moment a
-- pending request is inserted. It is deliberately a trigger rather than
-- something the client does after calling `request_join_by_code`: the requester
-- has no permission to write notification rows for other people, and a client
-- that navigates away mid-request would simply skip it.
--
-- In-app only. Sending a phone push from here would need `pg_net` to call the
-- edge function, and that extension is not installed on this project.

create or replace function public.notify_owners_of_join_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text;
  v_role text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select coalesce(nullif(trim(p.full_name), ''), p.email::text, 'Someone')
    into v_name
  from profiles p
  where p.id = new.user_id;

  v_role := replace(new.requested_role::text, '_', ' ');

  -- Owners are usually found through `academy_members`, but an academy whose
  -- owner invitation has not been accepted yet has no membership row for them,
  -- so `academies.owner_user_id` is unioned in. `distinct` keeps the common
  -- case — both sources agreeing — to one notification.
  insert into notifications (
    academy_id, recipient_user_id, title, message, notification_type, channel, status, metadata
  )
  select distinct
    new.academy_id,
    owner_id,
    'New join request',
    coalesce(v_name, 'Someone') || ' asked to join as a ' || v_role || '.',
    'join_request',
    'in_app'::notif_channel,
    'sent'::notif_status,
    jsonb_build_object('request_id', new.id, 'user_id', new.user_id)
  from (
    select m.user_id as owner_id
    from academy_members m
    where m.academy_id = new.academy_id
      and m.role = 'academy_owner'
      and m.status = 'active'
    union
    select a.owner_user_id
    from academies a
    where a.id = new.academy_id
      and a.owner_user_id is not null
  ) owners
  where owner_id is not null
    -- Never notify someone about their own request.
    and owner_id <> new.user_id;

  return new;
end
$function$;

drop trigger if exists join_request_notify_owners on public.join_requests;

create trigger join_request_notify_owners
after insert on public.join_requests
for each row
execute function public.notify_owners_of_join_request();
