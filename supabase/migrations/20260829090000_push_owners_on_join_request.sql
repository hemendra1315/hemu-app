-- Extends the join-request notification from in-app only to a real phone push.
--
-- `net.http_post` (pg_net) queues the request and returns immediately, so the
-- insert that triggered this is never held up by, or rolled back because of, a
-- slow or failing push. That is the whole reason for using pg_net here rather
-- than anything synchronous: a join request must still be recorded even if
-- Firebase is down.
--
-- The edge function is called in its direct form (`user_ids` + `title` +
-- `message`), added for this — a join request has named recipients and its own
-- wording, and no announcement row to point at.
--
-- Requires: `create extension pg_net`, and a Vault secret named
-- `service_role_key` holding the project's secret API key.

create or replace function public.notify_owners_of_join_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text;
  v_role text;
  v_title text;
  v_message text;
  v_owner_ids uuid[];
  v_service_key text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select coalesce(nullif(trim(p.full_name), ''), p.email::text, 'Someone')
    into v_name
  from profiles p
  where p.id = new.user_id;

  v_role := replace(new.requested_role::text, '_', ' ');
  v_title := 'New join request';
  v_message := coalesce(v_name, 'Someone') || ' asked to join as a ' || v_role || '.';

  -- Owners are usually found through `academy_members`, but an academy whose
  -- owner invitation has not been accepted yet has no membership row for them,
  -- so `academies.owner_user_id` is unioned in. The array is built once and
  -- used for both the in-app rows and the push, so the two can never disagree
  -- about who was told.
  select array_agg(distinct owner_id)
    into v_owner_ids
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

  if v_owner_ids is null or cardinality(v_owner_ids) = 0 then
    return new;
  end if;

  insert into notifications (
    academy_id, recipient_user_id, title, message, notification_type, channel, status, metadata
  )
  select
    new.academy_id,
    owner_id,
    v_title,
    v_message,
    'join_request',
    'in_app'::notif_channel,
    'sent'::notif_status,
    jsonb_build_object('request_id', new.id, 'user_id', new.user_id)
  from unnest(v_owner_ids) as owner_id;

  select decrypted_secret into v_service_key
  from vault.decrypted_secrets
  where name = 'service_role_key';

  -- No key configured is not an error: the in-app notification above still
  -- stands, and a join request must never fail because push is unconfigured.
  if v_service_key is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://jslilwvtribrszzzqcez.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'user_ids', to_jsonb(v_owner_ids),
      'title', v_title,
      'message', v_message,
      'url', '/members'
    ),
    timeout_milliseconds := 5000
  );

  return new;
end
$function$;
