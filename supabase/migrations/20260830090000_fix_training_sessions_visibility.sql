-- Training sessions were invisible to everyone except staff, for two
-- stacked reasons:
--
-- 1. `training_sessions_select` uses `is_member(academy_id)`, which is
--    `has_role(academy_id, ['academy_owner','coach','player'])` — 'parent'
--    was never included. A parent's query returned zero rows before it
--    even got to the coach embed below.
--
-- 2. The client's SESSION_COLUMNS select embeds the coach with a *double*
--    `!inner`: `coach:academy_members!...!inner(profiles!...!inner(...))`.
--    An inner embed drops the whole parent row when the embedded table
--    isn't readable. `academy_members_select` only lets you read a row if
--    it's your own or you're staff (`is_staff`, which checks the VIEWER's
--    own role) — a player viewing a session is never staff, so they could
--    never read the coach's `academy_members` row, and the inner join
--    deleted every session in the list. This affected PLAYERS too, not
--    just parents — nobody but staff has ever seen a training session in
--    this app.
--
-- This migration fixes #1 (parent visibility on the base table) and adds
-- narrow read access to a staff member's own identity (academy_members row
-- + profile) for any academy member or linked parent, so a client-side fix
-- (dropping the `!inner`, done in the same change) has real data to embed
-- instead of degrading to a blank coach name.

create policy training_sessions_select_parents on training_sessions for select using (
  exists (
    select 1
    from batch_members bm
    where bm.batch_id = training_sessions.batch_id
      and bm.academy_member_id in (select my_linked_member_ids(training_sessions.academy_id))
  )
);

-- Everyone in an academy should be able to see who their coaches are.
-- Scoped to rows whose OWN role is staff — this does not let a player see
-- other players' membership rows, only a coach's or owner's.
create policy academy_members_select_staff_identity on academy_members for select using (
  role in ('academy_owner', 'coach')
  and (is_member(academy_id) or has_role(academy_id, array['parent']::app_role[]))
);

create policy profiles_select_staff_identity on profiles for select using (
  exists (
    select 1
    from academy_members them
    where them.user_id = profiles.id
      and them.role in ('academy_owner', 'coach')
      and (is_member(them.academy_id) or has_role(them.academy_id, array['parent']::app_role[]))
  )
);
