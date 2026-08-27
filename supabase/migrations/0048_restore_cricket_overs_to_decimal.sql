-- ============================================================
-- 0048 — Restore the missing cricket_overs_to_decimal() helper
-- ============================================================
--
-- WHY THIS EXISTS
--
-- `save_match_result()` and `refresh_player_statistics()` both call
-- `cricket_overs_to_decimal()`, but that function does not exist in the live
-- database. Verified directly:
--
--   select cricket_overs_to_decimal((4.2)::numeric(4,1));
--   ERROR: 42883: function cricket_overs_to_decimal(numeric) does not exist
--
-- Both callers reference it from unconditional statements, so every call to
-- either RPC fails. In practice that means:
--
--   * the match wizard cannot save a match at all (its only save path is
--     save_match_result), and neither can the CricHeroes import;
--   * player career statistics can never be recomputed.
--
-- Postgres resolves functions called from a function body at execution time,
-- not at CREATE FUNCTION time, so both RPCs were created successfully and fail
-- only when actually invoked — which is why this was invisible until someone
-- tried to save a match.
--
-- ROOT CAUSE
--
-- The helper is defined in repo migrations 0016_match_rls_rpcs.sql and
-- 0018_apply_missing_modules.sql, neither of which reached this database — the
-- same repo-vs-live divergence recorded in docs/SCHEMA-DRIFT.md. Migration
-- 0030_security_hardening.sql *did* apply, and it re-created both callers with
-- bodies that call the helper, so the callers exist while the callee does not.
--
-- This migration re-creates the helper exactly as 0016 defines it. It is
-- additive and idempotent: no existing object is dropped or altered.
--
-- Note it is deliberately NOT a plain cast. Cricket overs notation is base-6 in
-- the fractional part — "4.2" means 4 overs and 2 balls, i.e. 4 + 2/6 overs —
-- so economy rate and aggregate overs are wrong if the raw number is used.
-- ============================================================

create or replace function cricket_overs_to_decimal(p_overs numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_overs is null then null
    else floor(p_overs) + ((p_overs - floor(p_overs)) * 10.0 / 6.0)
  end;
$$;

-- Match the lockdown established by 0047_harden_rpc_execute_grants.sql. This
-- helper is only ever called from inside other SECURITY DEFINER functions, so
-- it needs no anon access.
--
-- Both revokes are required and neither is redundant. 0047's note that
-- "revoking from anon alone silently does nothing" holds when the grant is
-- inherited from PUBLIC — but Supabase also sets ALTER DEFAULT PRIVILEGES on
-- schema public granting EXECUTE to anon, authenticated and service_role by
-- name. Those named grants are applied to every newly created function and
-- survive a PUBLIC revoke, so anon has to be revoked explicitly as well.
-- Verified after applying: anon=false, authenticated=true, service_role=true.
revoke all on function cricket_overs_to_decimal(numeric) from public;
revoke execute on function cricket_overs_to_decimal(numeric) from anon;
grant execute on function cricket_overs_to_decimal(numeric) to authenticated, service_role;
