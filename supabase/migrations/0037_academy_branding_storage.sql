-- Migration 0037: Academy Branding & Storage
-- Creates storage bucket for academy logos with RLS and updates branding retrieval RPCs.

-- 1. Create public storage bucket for academy logos
insert into storage.buckets (id, name, public)
values ('academy-logos', 'academy-logos', true)
on conflict (id) do update set public = true;

-- 2. Helper function to check if caller is an owner of the academy or super admin
create or replace function public.is_academy_owner_or_admin(p_academy_id_text text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_academy_id uuid;
begin
  if is_super_admin() then
    return true;
  end if;
  if p_academy_id_text is null or btrim(p_academy_id_text) = '' then
    return false;
  end if;
  begin
    v_academy_id := p_academy_id_text::uuid;
  exception when others then
    return false;
  end;
  return is_owner(v_academy_id);
end $$;

grant execute on function public.is_academy_owner_or_admin(text) to authenticated;

-- 3. Storage RLS policies for academy-logos
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public Academy Logos Access') then
    create policy "Public Academy Logos Access" on storage.objects for select using (bucket_id = 'academy-logos');
  end if;

  drop policy if exists "Academy Owners Can Upload Logo" on storage.objects;
  create policy "Academy Owners Can Upload Logo" on storage.objects for insert with check (
    bucket_id = 'academy-logos'
    and auth.role() = 'authenticated'
    and is_academy_owner_or_admin((storage.foldername(name))[1])
  );

  drop policy if exists "Academy Owners Can Update Logo" on storage.objects;
  create policy "Academy Owners Can Update Logo" on storage.objects for update using (
    bucket_id = 'academy-logos'
    and auth.role() = 'authenticated'
    and is_academy_owner_or_admin((storage.foldername(name))[1])
  );

  drop policy if exists "Academy Owners Can Delete Logo" on storage.objects;
  create policy "Academy Owners Can Delete Logo" on storage.objects for delete using (
    bucket_id = 'academy-logos'
    and auth.role() = 'authenticated'
    and is_academy_owner_or_admin((storage.foldername(name))[1])
  );
end $$;

-- 4. Update get_platform_academies to include logoUrl in the payload
CREATE OR REPLACE FUNCTION get_platform_academies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'E_FORBIDDEN: Access restricted to platform super admins'
      USING errcode = '42501';
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'name', a.name,
          'slug', a.slug,
          'logoUrl', a.logo_url,
          'city', a.city,
          'timezone', a.timezone,
          'feeMode', a.fee_mode,
          'createdAt', a.created_at,
          'ownerName', coalesce(p.full_name, p.email),
          'ownerEmail', p.email,
          'playerCount', (SELECT count(*) FROM academy_members m WHERE m.academy_id = a.id AND m.role = 'player' AND m.status = 'active'),
          'coachCount', (SELECT count(*) FROM academy_members m WHERE m.academy_id = a.id AND m.role = 'coach' AND m.status = 'active'),
          'memberCount', (SELECT count(*) FROM academy_members m WHERE m.academy_id = a.id AND m.status = 'active'),
          'batchCount', (SELECT count(*) FROM batches b WHERE b.academy_id = a.id),
          'matchCount', (SELECT count(*) FROM matches mat WHERE mat.academy_id = a.id)
        )
        ORDER BY a.created_at DESC
      )
      FROM academies a
      LEFT JOIN profiles p ON p.id = a.owner_user_id
    ),
    '[]'::jsonb
  );
END $$;

GRANT EXECUTE ON FUNCTION get_platform_academies() TO authenticated;

-- 5. Update get_owner_invitation_details to include logoUrl
CREATE OR REPLACE FUNCTION get_owner_invitation_details(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token_hash   text;
  v_invitation   academy_owner_invitations;
  v_academy_name text;
  v_logo_url     text;
  v_status       text;
  v_is_valid     boolean := false;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('isValid', false, 'status', 'invalid');
  END IF;

  v_token_hash := encode(digest(btrim(p_token), 'sha256'), 'hex');

  SELECT * INTO v_invitation
  FROM academy_owner_invitations
  WHERE token_hash = v_token_hash;

  IF v_invitation.id IS NULL THEN
    RETURN jsonb_build_object('isValid', false, 'status', 'not_found');
  END IF;

  SELECT name, logo_url INTO v_academy_name, v_logo_url
  FROM academies
  WHERE id = v_invitation.academy_id;

  v_status := v_invitation.status;
  IF v_status = 'pending' AND v_invitation.expires_at < now() THEN
    v_status := 'expired';
  END IF;

  IF v_status = 'pending' THEN
    v_is_valid := true;
  END IF;

  RETURN jsonb_build_object(
    'isValid', v_is_valid,
    'status', v_status,
    'academyId', v_invitation.academy_id,
    'academyName', v_academy_name,
    'logoUrl', v_logo_url,
    'expiresAt', v_invitation.expires_at,
    'targetRole', 'academy_owner'
  );
END $$;

GRANT EXECUTE ON FUNCTION get_owner_invitation_details(text) TO anon, authenticated;
