-- ============================================================================
-- Phase 1 — transactional RPCs
-- Multi-table operations live here so they are atomic and permission-checked in
-- one place (see docs/API-PLAN.md §2).
-- ============================================================================

-- Crockford base32 without I, L, O, U so codes are unambiguous when spoken.
create or replace function generate_join_code(p_length integer default 6) returns text
language plpgsql as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  result   text := '';
begin
  for _ in 1 .. p_length loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end $$;

create or replace function slugify(p_value text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(p_value), '[^a-z0-9]+', '-', 'g'));
$$;

-- --------------------------------------------------------- create academy ----
-- Creates the academy, the owner membership and the first player join code in a
-- single transaction; a partially created academy would leave the owner locked out.
create or replace function create_academy(
  p_name text,
  p_city text default null,
  p_timezone text default 'Asia/Kolkata',
  p_fee_mode fee_mode default 'player_pays'
) returns academies
language plpgsql security definer set search_path = public as $$
declare
  v_user     uuid := auth.uid();
  v_slug     text;
  v_suffix   integer := 0;
  v_academy  academies;
  v_code     text;
begin
  if v_user is null then
    raise exception 'E_UNAUTHENTICATED' using errcode = '28000';
  end if;

  v_slug := slugify(p_name);
  if v_slug = '' then
    raise exception 'E_VALIDATION: academy name must contain letters or digits'
      using errcode = '22023';
  end if;

  -- slug is unique across the platform; append a counter on collision
  while exists (select 1 from academies a where a.slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := slugify(p_name) || '-' || v_suffix;
  end loop;

  insert into academies (name, slug, city, timezone, fee_mode, owner_user_id)
  values (btrim(p_name), v_slug, nullif(btrim(coalesce(p_city, '')), ''), p_timezone, p_fee_mode, v_user)
  returning * into v_academy;

  insert into academy_members (academy_id, user_id, role, status, joined_at)
  values (v_academy.id, v_user, 'academy_owner', 'active', now());

  loop
    v_code := generate_join_code(6);
    exit when not exists (
      select 1 from academy_join_codes c where c.code = v_code and c.is_active
    );
  end loop;

  insert into academy_join_codes (academy_id, code, role, created_by)
  values (v_academy.id, v_code, 'player', v_user);

  return v_academy;
end $$;

-- ------------------------------------------------------ regenerate a code ----
create or replace function regenerate_join_code(
  p_academy uuid,
  p_role app_role default 'player',
  p_expires_at timestamptz default null,
  p_max_uses integer default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if not is_owner(p_academy) then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;

  -- deactivating first guarantees the old code stops working immediately
  update academy_join_codes
     set is_active = false
   where academy_id = p_academy and role = p_role and is_active;

  loop
    v_code := generate_join_code(6);
    exit when not exists (
      select 1 from academy_join_codes c where c.code = v_code and c.is_active
    );
  end loop;

  insert into academy_join_codes (academy_id, code, role, expires_at, max_uses, created_by)
  values (p_academy, v_code, p_role, p_expires_at, p_max_uses, auth.uid());

  return v_code;
end $$;

-- ---------------------------------------------------- join by academy code ----
-- Players/coaches never read academy_join_codes directly (RLS forbids it); this
-- definer function is the only redemption path. It creates a PENDING request —
-- owner approval, which promotes it to a membership, arrives in Phase 2.
create or replace function request_join_by_code(
  p_code text,
  p_message text default null
) returns join_requests
language plpgsql security definer set search_path = public as $$
declare
  v_user    uuid := auth.uid();
  v_code    academy_join_codes;
  v_request join_requests;
begin
  if v_user is null then
    raise exception 'E_UNAUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_code
  from academy_join_codes c
  where c.code = upper(btrim(p_code)) and c.is_active
  for update;

  if v_code.id is null then
    raise exception 'E_JOIN_CODE_INVALID' using errcode = '22023';
  end if;

  if v_code.expires_at is not null and v_code.expires_at < now() then
    raise exception 'E_JOIN_CODE_EXPIRED' using errcode = '22023';
  end if;

  if v_code.max_uses is not null and v_code.use_count >= v_code.max_uses then
    raise exception 'E_JOIN_CODE_EXHAUSTED' using errcode = '22023';
  end if;

  if exists (
    select 1 from academy_members m
    where m.academy_id = v_code.academy_id
      and m.user_id = v_user
      and m.status in ('active', 'pending')
  ) then
    raise exception 'E_ALREADY_MEMBER' using errcode = '23505';
  end if;

  insert into join_requests (academy_id, user_id, join_code_id, requested_role, message)
  values (v_code.academy_id, v_user, v_code.id, v_code.role, nullif(btrim(coalesce(p_message, '')), ''))
  on conflict (academy_id, user_id) where status = 'pending' do nothing
  returning * into v_request;

  if v_request.id is null then
    raise exception 'E_REQUEST_PENDING' using errcode = '23505';
  end if;

  update academy_join_codes
     set use_count = use_count + 1
   where id = v_code.id;

  return v_request;
end $$;

-- -------------------------------------------------------------- my context ----
-- One round trip for the app shell: every membership with its academy name plus
-- any pending join requests, so the router can decide where to send the user.
create or replace function my_memberships()
returns table (
  membership_id uuid,
  academy_id    uuid,
  academy_name  text,
  academy_slug  text,
  logo_url      text,
  city          text,
  timezone      text,
  role          app_role,
  status        member_status
)
language sql stable security definer set search_path = public as $$
  select m.id, a.id, a.name, a.slug::text, a.logo_url, a.city, a.timezone, m.role, m.status
  from academy_members m
  join academies a on a.id = m.academy_id
  where m.user_id = auth.uid()
    and m.status in ('active', 'pending')
    and a.deleted_at is null
  order by a.name;
$$;

create or replace function my_join_requests()
returns table (
  request_id     uuid,
  academy_id     uuid,
  academy_name   text,
  requested_role app_role,
  status         join_status,
  created_at     timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.id, a.id, a.name, r.requested_role, r.status, r.created_at
  from join_requests r
  join academies a on a.id = r.academy_id
  where r.user_id = auth.uid()
  order by r.created_at desc;
$$;

-- The active join code an owner should share (staff-only via is_staff check).
create or replace function academy_active_join_code(
  p_academy uuid,
  p_role app_role default 'player'
) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_code text;
begin
  if not is_staff(p_academy) then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;

  select c.code into v_code
  from academy_join_codes c
  where c.academy_id = p_academy and c.role = p_role and c.is_active
  order by c.created_at desc
  limit 1;

  return v_code;
end $$;

revoke all on function create_academy(text, text, text, fee_mode) from public;
revoke all on function request_join_by_code(text, text) from public;

grant execute on function create_academy(text, text, text, fee_mode) to authenticated;
grant execute on function regenerate_join_code(uuid, app_role, timestamptz, integer) to authenticated;
grant execute on function request_join_by_code(text, text) to authenticated;
grant execute on function my_memberships() to authenticated;
grant execute on function my_join_requests() to authenticated;
grant execute on function academy_active_join_code(uuid, app_role) to authenticated;
