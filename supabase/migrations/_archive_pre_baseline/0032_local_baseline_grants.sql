-- =============================================================================
-- 0032: Local baseline privileges (dev-only parity with production Supabase)
--
-- A fresh `supabase db reset` on this project does not always materialise the
-- Supabase default grants to the `authenticated` role, so authenticated sessions
-- hit "permission denied for table ..." before RLS policies are even evaluated.
-- Restore the baseline table/sequence privileges the authenticated role needs to
-- read/write within its tenant (tenant isolation still enforced by RLS policies
-- added in migration 0030). `anon` is intentionally NOT granted read access to
-- tenant tables: anonymous callers must have no Bearer session, matching prod.
-- =============================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
