-- pg_net lets a trigger make an outbound HTTP call, which is what a database
-- trigger needs in order to reach the send-push-notification edge function.
-- Supabase installs it into its own `extensions` schema by convention; the
-- callable functions land in the `net` schema.
create extension if not exists pg_net with schema extensions;
