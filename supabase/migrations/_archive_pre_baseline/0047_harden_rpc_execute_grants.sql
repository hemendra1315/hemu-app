-- ============================================================================
-- 0047: Lock down who can call the RPCs
--
-- Every function in `public` is reachable at /rest/v1/rpc/<name>. The security
-- advisor flagged 110 findings here, all of the same two shapes:
--
--   * 6 TRIGGER functions were callable over REST (handle_new_user,
--     protect_profiles_privileged_columns, assert_batch_tenancy,
--     assert_batch_member_tenancy, protect_join_request_requester_fields,
--     fanout_announcement_notifications). These are only ever valid as triggers.
--   * `anon` — a signed-out visitor — could execute every SECURITY DEFINER
--     function, including save_match_result, approve_join_request,
--     set_member_role, delete_platform_academy and the whole super-admin set.
--
-- In practice most fail closed, because they check is_staff()/is_owner()/
-- is_super_admin() internally and auth.uid() is null for anon. But that is
-- defence-in-depth backwards: an unauthenticated caller should not reach the
-- entry point at all, and one function that forgets its check becomes a hole.
--
-- Note the trap this fixes. `REVOKE ... FROM anon` alone does nothing: Postgres
-- grants EXECUTE to PUBLIC by default and anon/authenticated inherit it, so the
-- privilege must be removed from PUBLIC and then granted back deliberately.
-- Migration 0030 already used this pattern for the statistics RPCs.
--
-- Signed-in behaviour is deliberately unchanged: every function `authenticated`
-- could call before, it can still call. The only anon exception is
-- get_owner_invitation_details, which the public /invite/:token page needs
-- before the visitor has an account.
--
-- Idempotent, and written as a loop so functions added later are covered by
-- re-running it.
-- ============================================================================

DO $harden$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
  END LOOP;

  FOR fn IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn.sig);
    IF fn.proname = 'get_owner_invitation_details' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', fn.sig);
    END IF;
  END LOOP;
END
$harden$;
