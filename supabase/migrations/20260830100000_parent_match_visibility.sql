-- Parents could not see ANY match data — not scorecards with blank names,
-- literally nothing. Every match-related table's SELECT policy is
-- `is_member(academy_id)` (or that OR'd with "it's my own player row"),
-- and `is_member()` = has_role(academy_id, ['academy_owner','coach','player'])
-- — 'parent' has never been in that list. Verified directly against the live
-- policy catalogue: matches, match_lineups, match_batting, match_bowling,
-- match_fielding, match_awards, match_partnerships, match_bowling_spells,
-- and match_coach_notes all lacked any parent-facing policy.
--
-- Match results/scorecards are treated as public within an academy already
-- (any player/coach/owner can see any match) — `batches_select_parents`
-- set the precedent of granting parents that same academy-wide visibility
-- rather than trying to scope every scorecard table down to just-their-child
-- (which would also make team scorecards look broken, showing some players
-- and not others). Coach notes are different: private staff commentary,
-- scoped tightly to notes about the parent's own linked child only.

create policy matches_select_parents on matches for select using (
  has_role(academy_id, array['parent']::app_role[])
);

create policy match_lineups_select_parents on match_lineups for select using (
  exists (
    select 1 from matches m
    where m.id = match_lineups.match_id
      and has_role(m.academy_id, array['parent']::app_role[])
  )
);

create policy match_batting_select_parents on match_batting for select using (
  exists (
    select 1 from matches m
    where m.id = match_batting.match_id
      and has_role(m.academy_id, array['parent']::app_role[])
  )
);

create policy match_bowling_select_parents on match_bowling for select using (
  exists (
    select 1 from matches m
    where m.id = match_bowling.match_id
      and has_role(m.academy_id, array['parent']::app_role[])
  )
);

create policy match_fielding_select_parents on match_fielding for select using (
  exists (
    select 1 from matches m
    where m.id = match_fielding.match_id
      and has_role(m.academy_id, array['parent']::app_role[])
  )
);

create policy match_awards_select_parents on match_awards for select using (
  exists (
    select 1 from matches m
    where m.id = match_awards.match_id
      and has_role(m.academy_id, array['parent']::app_role[])
  )
);

create policy match_partnerships_select_parents on match_partnerships for select using (
  exists (
    select 1 from matches m
    where m.id = match_partnerships.match_id
      and has_role(m.academy_id, array['parent']::app_role[])
  )
);

create policy match_bowling_spells_select_parents on match_bowling_spells for select using (
  exists (
    select 1 from matches m
    where m.id = match_bowling_spells.match_id
      and has_role(m.academy_id, array['parent']::app_role[])
  )
);

-- Private: only about the parent's own linked child, not every player.
create policy match_coach_notes_select_parents on match_coach_notes for select using (
  exists (
    select 1 from matches m
    where m.id = match_coach_notes.match_id
      and match_coach_notes.academy_member_id in (select my_linked_member_ids(m.academy_id))
  )
);
