-- ============================================================================
-- Phase 1 — row level security
-- Deny by default; tenant isolation is enforced here, not in the client.
-- Helper functions are SECURITY DEFINER so policies can read academy_members
-- without recursing through that table's own policies.
-- ============================================================================

-- ------------------------------------------------------------- helpers ------
create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_super_admin from profiles p where p.id = auth.uid()), false);
$$;

create or replace function has_role(p_academy uuid, p_roles app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select is_super_admin() or exists (
    select 1
    from academy_members m
    where m.academy_id = p_academy
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any (p_roles)
  );
$$;

create or replace function is_member(p_academy uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(p_academy, array['academy_owner', 'coach', 'player']::app_role[]);
$$;

create or replace function is_staff(p_academy uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(p_academy, array['academy_owner', 'coach']::app_role[]);
$$;

create or replace function is_owner(p_academy uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(p_academy, array['academy_owner']::app_role[]);
$$;

create or replace function my_player_id(p_academy uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id
  from academy_members
  where academy_id = p_academy
    and user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

grant execute on function is_super_admin, has_role, is_member, is_staff, is_owner, my_player_id to authenticated;

-- ---------------------------------------------------------------- rls -------
alter table profiles enable row level security;
alter table academies enable row level security;
alter table academy_members enable row level security;
alter table academy_join_codes enable row level security;
alter table join_requests enable row level security;

-- profiles: self, super admins, and staff of an academy the profile belongs to.
create policy profiles_select on profiles for select using (
  id = auth.uid()
  or is_super_admin()
  or exists (
    select 1
    from academy_members them
    where them.user_id = profiles.id
      and is_staff(them.academy_id)
  )
);

create policy profiles_insert_self on profiles for insert with check (id = auth.uid());

create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- academies: members read; creation is via create_academy(); owners update.
create policy academies_select on academies for select using (
  is_member(id) or is_super_admin()
);

create policy academies_update on academies for update
  using (is_owner(id)) with check (is_owner(id));

-- memberships: users see their own rows; staff see their academy's roster;
-- only owners (or the create_academy RPC) may write.
create policy academy_members_select on academy_members for select using (
  user_id = auth.uid() or is_staff(academy_id)
);

create policy academy_members_insert on academy_members for insert
  with check (is_owner(academy_id));

create policy academy_members_update on academy_members for update
  using (is_owner(academy_id)) with check (is_owner(academy_id));

create policy academy_members_delete on academy_members for delete
  using (is_owner(academy_id));

-- join codes: never readable by players (they would leak other academies'
-- codes); staff read, owners write. Redemption goes through request_join_by_code().
create policy academy_join_codes_select on academy_join_codes for select
  using (is_staff(academy_id));

create policy academy_join_codes_write on academy_join_codes for all
  using (is_owner(academy_id)) with check (is_owner(academy_id));

-- join requests: requester sees their own; owners see and review their academy's.
create policy join_requests_select on join_requests for select using (
  user_id = auth.uid() or is_owner(academy_id)
);

create policy join_requests_cancel_own on join_requests for update
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status in ('pending', 'cancelled'));

create policy join_requests_review on join_requests for update
  using (is_owner(academy_id)) with check (is_owner(academy_id));
