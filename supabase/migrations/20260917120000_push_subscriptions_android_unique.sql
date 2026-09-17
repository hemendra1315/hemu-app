-- Migration: Prevent duplicate Android FCM subscriptions for the same user + device token
-- Ensures at most one FCM subscription per physical device per user.

-- 1. Clean up any existing duplicate Android rows with the same token, keeping the newest
DELETE FROM push_subscriptions a
USING push_subscriptions b
WHERE a.user_id = b.user_id
  AND a.platform = 'android'
  AND b.platform = 'android'
  AND a.fcm_token IS NOT NULL
  AND b.fcm_token IS NOT NULL
  AND a.fcm_token = b.fcm_token
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));

-- 2. Add partial unique index for Android FCM subscriptions
-- Preserves existing (user_id, endpoint) constraint and does not affect web push subscriptions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_android_user_fcm
  ON push_subscriptions (user_id, platform, fcm_token)
  WHERE (platform = 'android' AND fcm_token IS NOT NULL);
