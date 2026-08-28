-- ============================================================================
-- Fix missing helpers, activity log, and broken RLS policies
-- 1. my_player_id() is now defined in 0016; only the grant is repeated here.
-- 2. Create activity_log table (referenced by the dashboard but missing).
-- 3. Fix match sub-table RLS policies that reference a non-existent
--    academy_id column on tables that only have match_id.
-- ============================================================================

-- ------------------------------------------------------------- my_player_id --
-- my_player_id() is already defined in 0016. Keep only the grant here.
grant execute on function my_player_id(uuid) to authenticated;

-- ---------------------------------------------------------- activity_log -----
-- Lightweight audit/activity feed. The dashboard queries this table, so it
-- must exist. Rows are written by the app (or triggers) as events occur.
create table if not exists activity_log (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references academies(id) on delete cascade,
  user_id       uuid references profiles(id) on delete set null,
  activity_type text not null,
  description   text,
  entity_type   text,
  entity_id     uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists activity_log_academy_idx on activity_log (academy_id, created_at desc);
create index if not exists activity_log_user_idx on activity_log (user_id, created_at desc);

alter table activity_log enable row level security;

create policy activity_log_select on activity_log for select using (
  is_member(academy_id)
);

create policy activity_log_insert on activity_log for insert with check (
  is_staff(academy_id)
);

-- ------------------------------------------------- match sub-table RLS -----
-- The policies in 0016 referenced academy_id on tables that only have
-- match_id. Drop and recreate them using a subquery through matches so the
-- academy is resolved correctly.

drop policy if exists match_lineups_select on match_lineups;
drop policy if exists match_lineups_write on match_lineups;
create policy match_lineups_select on match_lineups for select using (
  exists (
    select 1 from matches m where m.id = match_lineups.match_id and is_member(m.academy_id)
  )
);
create policy match_lineups_write on match_lineups for all using (
  exists (
    select 1 from matches m where m.id = match_lineups.match_id and is_staff(m.academy_id)
  )
) with check (
  exists (
    select 1 from matches m where m.id = match_lineups.match_id and is_staff(m.academy_id)
  )
);

drop policy if exists match_batting_select on match_batting;
drop policy if exists match_batting_write on match_batting;
create policy match_batting_select on match_batting for select using (
  exists (
    select 1 from matches m
    where m.id = match_batting.match_id
      and (is_member(m.academy_id) or match_batting.academy_member_id = my_player_id(m.academy_id))
  )
);
create policy match_batting_write on match_batting for all using (
  exists (
    select 1 from matches m where m.id = match_batting.match_id and is_staff(m.academy_id)
  )
) with check (
  exists (
    select 1 from matches m where m.id = match_batting.match_id and is_staff(m.academy_id)
  )
);

drop policy if exists match_bowling_select on match_bowling;
drop policy if exists match_bowling_write on match_bowling;
create policy match_bowling_select on match_bowling for select using (
  exists (
    select 1 from matches m
    where m.id = match_bowling.match_id
      and (is_member(m.academy_id) or match_bowling.academy_member_id = my_player_id(m.academy_id))
  )
);
create policy match_bowling_write on match_bowling for all using (
  exists (
    select 1 from matches m where m.id = match_bowling.match_id and is_staff(m.academy_id)
  )
) with check (
  exists (
    select 1 from matches m where m.id = match_bowling.match_id and is_staff(m.academy_id)
  )
);

drop policy if exists match_bowling_spells_select on match_bowling_spells;
drop policy if exists match_bowling_spells_write on match_bowling_spells;
create policy match_bowling_spells_select on match_bowling_spells for select using (
  exists (
    select 1 from matches m where m.id = match_bowling_spells.match_id and is_member(m.academy_id)
  )
);
create policy match_bowling_spells_write on match_bowling_spells for all using (
  exists (
    select 1 from matches m where m.id = match_bowling_spells.match_id and is_staff(m.academy_id)
  )
) with check (
  exists (
    select 1 from matches m where m.id = match_bowling_spells.match_id and is_staff(m.academy_id)
  )
);

drop policy if exists match_fielding_select on match_fielding;
drop policy if exists match_fielding_write on match_fielding;
create policy match_fielding_select on match_fielding for select using (
  exists (
    select 1 from matches m
    where m.id = match_fielding.match_id
      and (is_member(m.academy_id) or match_fielding.academy_member_id = my_player_id(m.academy_id))
  )
);
create policy match_fielding_write on match_fielding for all using (
  exists (
    select 1 from matches m where m.id = match_fielding.match_id and is_staff(m.academy_id)
  )
) with check (
  exists (
    select 1 from matches m where m.id = match_fielding.match_id and is_staff(m.academy_id)
  )
);

drop policy if exists match_partnerships_select on match_partnerships;
drop policy if exists match_partnerships_write on match_partnerships;
create policy match_partnerships_select on match_partnerships for select using (
  exists (
    select 1 from matches m where m.id = match_partnerships.match_id and is_member(m.academy_id)
  )
);
create policy match_partnerships_write on match_partnerships for all using (
  exists (
    select 1 from matches m where m.id = match_partnerships.match_id and is_staff(m.academy_id)
  )
) with check (
  exists (
    select 1 from matches m where m.id = match_partnerships.match_id and is_staff(m.academy_id)
  )
);

drop policy if exists match_awards_select on match_awards;
drop policy if exists match_awards_write on match_awards;
create policy match_awards_select on match_awards for select using (
  exists (
    select 1 from matches m where m.id = match_awards.match_id and is_member(m.academy_id)
  )
);
create policy match_awards_write on match_awards for all using (
  exists (
    select 1 from matches m where m.id = match_awards.match_id and is_staff(m.academy_id)
  )
) with check (
  exists (
    select 1 from matches m where m.id = match_awards.match_id and is_staff(m.academy_id)
  )
);

drop policy if exists match_coach_notes_select on match_coach_notes;
drop policy if exists match_coach_notes_write on match_coach_notes;
create policy match_coach_notes_select on match_coach_notes for select using (
  exists (
    select 1 from matches m where m.id = match_coach_notes.match_id and is_member(m.academy_id)
  )
);
create policy match_coach_notes_write on match_coach_notes for all using (
  exists (
    select 1 from matches m where m.id = match_coach_notes.match_id and is_staff(m.academy_id)
  )
) with check (
  exists (
    select 1 from matches m where m.id = match_coach_notes.match_id and is_staff(m.academy_id)
  )
);

-- player_statistics / player_milestones already have academy_id, so the
-- original policies are fine once my_player_id() exists. No change needed.