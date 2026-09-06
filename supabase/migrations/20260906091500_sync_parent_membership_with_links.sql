-- Revoking a parent's link to a child (parent_player_links.status =
-- 'revoked') never touched the parent's own academy_members row, which is
-- what has_role()/is_member() actually check. A parent whose last child
-- link was revoked kept role='parent', status='active' on academy_members
-- forever, so they kept every broad parent-facing grant in the app
-- (all-academy announcements, match/scorecard visibility, batches, etc.)
-- with zero linked children. Mirrors the existing convention used when a
-- coach/player leaves (status='left', left_at=now()) via
-- updateMemberStatus in membersApi.ts.
--
-- This trigger keeps academy_members.status in sync with whether the
-- parent still has at least one active parent_player_links row for that
-- academy, on every insert/update/delete of parent_player_links -- so it
-- covers both revokeParentLink() and redeem_parent_linking_code()
-- (re-linking) without either needing to know about the other.

create or replace function sync_parent_membership_with_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_user_id uuid;
  v_academy_id uuid;
  v_has_active boolean;
begin
  v_parent_user_id := coalesce(new.parent_user_id, old.parent_user_id);
  v_academy_id := coalesce(new.academy_id, old.academy_id);

  select exists (
    select 1 from parent_player_links
    where parent_user_id = v_parent_user_id
      and academy_id = v_academy_id
      and status = 'active'
  ) into v_has_active;

  if v_has_active then
    update academy_members
    set status = 'active', left_at = null
    where academy_id = v_academy_id
      and user_id = v_parent_user_id
      and role = 'parent'
      and status <> 'active';
  else
    update academy_members
    set status = 'left', left_at = now()
    where academy_id = v_academy_id
      and user_id = v_parent_user_id
      and role = 'parent'
      and status <> 'left';
  end if;

  return null;
end;
$$;

drop trigger if exists parent_player_links_sync_membership on parent_player_links;

create trigger parent_player_links_sync_membership
after insert or update or delete on parent_player_links
for each row
execute function sync_parent_membership_with_links();
