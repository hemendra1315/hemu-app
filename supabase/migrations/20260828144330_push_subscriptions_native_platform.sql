-- Extends push_subscriptions to also hold native Android (FCM) tokens
-- alongside the existing Web Push subscriptions, so the send-push-notification
-- edge function can branch on platform and dispatch each row the right way.
--
-- Native rows reuse the existing (user_id, endpoint) unique constraint by
-- storing a synthetic endpoint of the form 'fcm:<token>' -- this keeps the
-- client's existing upsert(... onConflict: 'user_id,endpoint') working
-- unchanged for both platforms, so no application-level branching was needed
-- just to persist the token.

alter table public.push_subscriptions
  add column if not exists platform text not null default 'web',
  add column if not exists fcm_token text;

alter table public.push_subscriptions
  add constraint push_subscriptions_platform_check
    check (platform in ('web', 'android'));

-- p256dh/auth are Web Push encryption keys -- meaningless for a native FCM
-- token, where Google's own infrastructure handles transport security.
alter table public.push_subscriptions
  alter column p256dh drop not null,
  alter column auth drop not null;

alter table public.push_subscriptions
  add constraint push_subscriptions_platform_fields_check
    check (
      (platform = 'web' and p256dh is not null and auth is not null and fcm_token is null)
      or
      (platform = 'android' and fcm_token is not null)
    );
