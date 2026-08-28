-- =============================================================================
-- 0045: Restore SECURITY DEFINER authorization for the student Stats reads
--
-- Problem
-- -----------------------------------------------------------------------------
-- The Stats page's player flow (src/features/stats/pages/StatsPage.tsx ->
-- fetchPlayerDashboardAnalytics) reads player_statistics, player_milestones,
-- match_batting / match_bowling / match_fielding / match_awards, attendance and
-- drill_assignments. Every one of those tables is gated by an RLS policy that
-- lets a *student* read only their OWN row via the helper:
--
--     USING (is_staff(academy_id) OR player_id = my_player_id(academy_id))
--
-- my_player_id() (and the sibling role helpers) are SECURITY DEFINER: their
-- bodies run with the definer's (owner's) privileges, but Postgres still checks
-- the *calling role's* EXECUTE grant the moment a policy evaluates them. When the
-- production database is missing the EXECUTE grant for `authenticated`, every
-- student SELECT on those tables throws
--
--     permission denied for function public.my_player_id(character varying)
--
-- `fetchPlayerDashboardAnalytics` fans those reads out with `Promise.all`, so a
-- single function-permission error rejects the whole batch and the Stats page
-- renders its generic "Something went wrong. Please try again." state.
--
-- Coaches / academy owners are not affected because their RLS branches resolve
-- through is_staff / is_owner and do not have to call my_player_id(), which is
-- exactly why only the STUDENT/PLAYER path regressed.
--
-- Fix
-- -----------------------------------------------------------------------------
-- 1. Re-assert the correct my_player_id() definition. The app and every stats
--    table use academy_members.id as the player identity, so the helper must
--    resolve to the caller's academy_members.id (not the legacy players.id).
--    Recreating is a no-op when already correct and repairs old variants.
-- 2. Restore EXECUTE for `authenticated` on the SECURITY DEFINER RLS helpers used
--    by the policy predicates. Granting EXECUTE authorises calling these
--    role/identity checks; it grants NO data access (tenant isolation stays
--    enforced by the RLS policies themselves).
--
-- This migration is idempotent and does NOT weaken any policy: a student still
-- only ever sees rows where player_id = my_player_id(academy_id).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. my_player_id(): the caller's active academy_members.id within p_academy.
-- -----------------------------------------------------------------------------
create or replace function my_player_id(p_academy uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from academy_members
  where academy_id = p_academy
    and user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- 2. EXECUTE for the SECURITY DEFINER RLS helpers on the `authenticated` role.
-- -----------------------------------------------------------------------------
grant execute on function is_super_admin() to authenticated;
grant execute on function has_role(uuid, app_role[]) to authenticated;
grant execute on function is_member(uuid) to authenticated;
grant execute on function is_staff(uuid) to authenticated;
grant execute on function is_owner(uuid) to authenticated;
grant execute on function my_player_id(uuid) to authenticated;