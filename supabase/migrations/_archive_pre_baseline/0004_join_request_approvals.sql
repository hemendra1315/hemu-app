-- ============================================================================
-- Phase 1 — request approval/rejection RPCs
-- ============================================================================

create or replace function approve_join_request(
  p_request_id uuid,
  p_batch_ids uuid[] default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_request join_requests;
begin
  if v_user is null then
    raise exception 'E_UNAUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_request
  from join_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'E_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not is_owner(v_request.academy_id) then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'E_INVALID_REQUEST' using errcode = '22023';
  end if;

  if exists (
    select 1
    from academy_members m
    where m.academy_id = v_request.academy_id
      and m.user_id = v_request.user_id
      and m.status in ('active', 'pending')
  ) then
    raise exception 'E_ALREADY_MEMBER' using errcode = '23505';
  end if;

  insert into academy_members (academy_id, user_id, role, status, joined_at)
  values (v_request.academy_id, v_request.user_id, v_request.requested_role, 'active', now());

  update join_requests
  set status = 'approved', reviewed_by = v_user, reviewed_at = now()
  where id = p_request_id;
end $$;

create or replace function reject_join_request(
  p_request_id uuid,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_request join_requests;
begin
  if v_user is null then
    raise exception 'E_UNAUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_request
  from join_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'E_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not is_owner(v_request.academy_id) then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'E_INVALID_REQUEST' using errcode = '22023';
  end if;

  update join_requests
  set status = 'rejected', reviewed_by = v_user, reviewed_at = now(), rejection_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_request_id;
end $$;

revoke all on function approve_join_request(uuid, uuid[]) from public;
revoke all on function reject_join_request(uuid, text) from public;

grant execute on function approve_join_request(uuid, uuid[]) to authenticated;
grant execute on function reject_join_request(uuid, text) to authenticated;
