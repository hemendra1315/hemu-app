-- Migration: push_subscriptions table for Web Push VAPID notifications
-- Each row represents one browser/device subscription for a user.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  academy_id  uuid NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can insert and delete their own subscriptions only
CREATE POLICY "push_subscriptions: users manage own"
  ON push_subscriptions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role (Edge Functions) can read all subscriptions to fan-out pushes
CREATE POLICY "push_subscriptions: service role read all"
  ON push_subscriptions
  FOR SELECT
  USING (auth.role() = 'service_role');
