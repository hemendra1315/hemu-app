-- `approve_join_request` existed twice with different behaviour:
--
--   approve_join_request(p_request uuid)                    -- upserts, reactivates a
--                                                              member who had left, and
--                                                              calls ensure_person_row
--   approve_join_request(p_request_id uuid, p_batch_ids uuid[])
--                                                           -- hard-errors E_ALREADY_MEMBER,
--                                                              plain INSERT, no person row
--
-- The app resolves to the second. Two consequences:
--
--  1. Someone who had left the academy — their row still there with status
--     'left' — could never be re-approved. The E_ALREADY_MEMBER guard did not
--     catch them (it only looks for 'active'/'pending'), so the plain INSERT
--     hit the UNIQUE (academy_id, user_id, role) constraint and surfaced as a
--     raw 23505 with nothing in the UI to resolve it.
--  2. `ensure_person_row` was never called on this path, so a player approved
--     through the app got a membership row but not the person row the older
--     path creates.
--
-- Both are fixed by adopting the first function's upsert, and E_ALREADY_MEMBER
-- is now raised only when the person genuinely is already active — approving
-- someone who is already in is still an error worth naming, but rejoining is
-- not. The unused single-argument overload is dropped: an overload pair that
-- disagrees about semantics is exactly the drift that caused this.

create or replace function public.approve_join_request(
  p_request_id uuid,
  p_batch_ids uuid[] default null::uuid[]
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_request join_requests;
  v_new_member_id uuid;
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

  -- Only a genuinely active membership blocks approval. A row left behind by
  -- someone who left, or a rejected one, must be reactivated instead.
  if exists (
    select 1
    from academy_members m
    where m.academy_id = v_request.academy_id
      and m.user_id = v_request.user_id
      and m.status = 'active'
  ) then
    raise exception 'E_ALREADY_MEMBER' using errcode = '23505';
  end if;

  insert into academy_members (academy_id, user_id, role, status, joined_at, invited_by)
  values (v_request.academy_id, v_request.user_id, v_request.requested_role, 'active', now(), v_user)
  on conflict (academy_id, user_id, role)
    do update set
      status = 'active',
      joined_at = coalesce(academy_members.joined_at, now()),
      left_at = null
  returning id into v_new_member_id;

  -- Present on the older overload and missing here, so players approved
  -- through the app never got their person row.
  perform ensure_person_row(v_request.academy_id, v_request.user_id, v_request.requested_role);

  if p_batch_ids is not null and array_length(p_batch_ids, 1) > 0 then
    insert into batch_members (batch_id, academy_member_id)
    select b_id, v_new_member_id
    from unnest(p_batch_ids) as b_id
    where exists (
      select 1 from batches b where b.id = b_id and b.academy_id = v_request.academy_id
    )
    -- A rejoining member may still be attached to some of these batches.
    on conflict (batch_id, academy_member_id) do nothing;
  end if;

  update join_requests
  set status = 'approved', reviewed_by = v_user, reviewed_at = now()
  where id = p_request_id;
end
$function$;

drop function if exists public.approve_join_request(uuid);
