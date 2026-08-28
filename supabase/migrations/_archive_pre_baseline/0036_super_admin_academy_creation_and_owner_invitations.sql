-- Migration 0036: Super Admin Academy Creation & Owner Invitation System
-- Restricts academy creation to Super Admins only and introduces secure, single-use owner invitations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Table for Academy Owner Invitations
CREATE TABLE IF NOT EXISTS academy_owner_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz
);

-- Index for fast token lookup by hash
CREATE INDEX IF NOT EXISTS idx_owner_invitations_token_hash ON academy_owner_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_owner_invitations_academy_id ON academy_owner_invitations(academy_id);

-- Enable RLS
ALTER TABLE academy_owner_invitations ENABLE ROW LEVEL SECURITY;

-- Only Super Admins may directly query/manage owner invitations
DROP POLICY IF EXISTS "Super Admin owner invitations access" ON academy_owner_invitations;
CREATE POLICY "Super Admin owner invitations access"
  ON academy_owner_invitations
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- 2. Restrict create_academy to Super Admins only
CREATE OR REPLACE FUNCTION create_academy(
  p_name text,
  p_city text DEFAULT NULL,
  p_timezone text DEFAULT 'Asia/Kolkata',
  p_fee_mode fee_mode DEFAULT 'player_pays'
) RETURNS academies
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_slug     text;
  v_suffix   integer := 0;
  v_academy  academies;
  v_code     text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'E_UNAUTHENTICATED' USING errcode = '28000';
  END IF;

  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'E_FORBIDDEN: Access restricted to platform super admins'
      USING errcode = '42501';
  END IF;

  v_slug := slugify(p_name);
  IF v_slug = '' THEN
    RAISE EXCEPTION 'E_VALIDATION: academy name must contain letters or digits'
      USING errcode = '22023';
  END IF;

  WHILE EXISTS (SELECT 1 FROM academies a WHERE a.slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := slugify(p_name) || '-' || v_suffix;
  END LOOP;

  INSERT INTO academies (name, slug, city, timezone, fee_mode, owner_user_id)
  VALUES (btrim(p_name), v_slug, nullif(btrim(coalesce(p_city, '')), ''), p_timezone, p_fee_mode, v_user)
  RETURNING * INTO v_academy;

  INSERT INTO academy_members (academy_id, user_id, role, status, joined_at)
  VALUES (v_academy.id, v_user, 'academy_owner', 'active', now());

  LOOP
    v_code := generate_join_code(6);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM academy_join_codes c WHERE c.code = v_code AND c.is_active
    );
  END LOOP;

  INSERT INTO academy_join_codes (academy_id, code, role, created_by)
  VALUES (v_academy.id, v_code, 'player', v_user);

  RETURN v_academy;
END $$;

-- 3. Super Admin Create Academy with Owner Invitation
CREATE OR REPLACE FUNCTION super_admin_create_academy_with_invite(
  p_name text,
  p_city text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_timezone text DEFAULT 'Asia/Kolkata',
  p_fee_mode fee_mode DEFAULT 'player_pays'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin_id       uuid := auth.uid();
  v_slug           text;
  v_suffix         integer := 0;
  v_academy        academies;
  v_player_code    text;
  v_raw_token      text;
  v_token_hash     text;
  v_invitation_id  uuid;
  v_expires_at     timestamptz := now() + interval '7 days';
BEGIN
  -- 1. Super Admin authorization check
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'E_FORBIDDEN: Access restricted to platform super admins'
      USING errcode = '42501';
  END IF;

  -- 2. Validate input name
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'E_VALIDATION: Academy name must not be empty'
      USING errcode = '22023';
  END IF;

  -- 3. Generate unique platform slug
  v_slug := slugify(p_name);
  IF v_slug = '' THEN
    RAISE EXCEPTION 'E_VALIDATION: Academy name must contain letters or digits'
      USING errcode = '22023';
  END IF;

  WHILE EXISTS (SELECT 1 FROM academies a WHERE a.slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := slugify(p_name) || '-' || v_suffix;
  END LOOP;

  -- 4. Insert academy record (owner initially set to creating super admin until accepted)
  INSERT INTO academies (
    name, slug, city, contact_email, contact_phone, timezone, fee_mode, owner_user_id
  ) VALUES (
    btrim(p_name),
    v_slug,
    nullif(btrim(coalesce(p_city, '')), ''),
    nullif(btrim(coalesce(p_contact_email, '')), ''),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    p_timezone,
    p_fee_mode,
    v_admin_id
  ) RETURNING * INTO v_academy;

  -- 5. Generate default active join code for players
  LOOP
    v_player_code := generate_join_code(6);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM academy_join_codes c WHERE c.code = v_player_code AND c.is_active
    );
  END LOOP;

  INSERT INTO academy_join_codes (academy_id, code, role, created_by)
  VALUES (v_academy.id, v_player_code, 'player', v_admin_id);

  -- 6. Generate cryptographically secure 256-bit token & SHA-256 hash
  v_raw_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

  INSERT INTO academy_owner_invitations (
    academy_id, token_hash, status, created_by, expires_at
  ) VALUES (
    v_academy.id, v_token_hash, 'pending', v_admin_id, v_expires_at
  ) RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object(
    'id', v_academy.id,
    'name', v_academy.name,
    'slug', v_academy.slug,
    'city', v_academy.city,
    'contactEmail', v_academy.contact_email,
    'contactPhone', v_academy.contact_phone,
    'timezone', v_academy.timezone,
    'feeMode', v_academy.fee_mode,
    'playerJoinCode', v_player_code,
    'invitationId', v_invitation_id,
    'invitationToken', v_raw_token,
    'invitationExpiresAt', v_expires_at,
    'createdAt', v_academy.created_at
  );
END $$;

-- 4. Super Admin Regenerate Owner Invitation
CREATE OR REPLACE FUNCTION regenerate_owner_invitation(p_academy_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin_id       uuid := auth.uid();
  v_raw_token      text;
  v_token_hash     text;
  v_invitation_id  uuid;
  v_expires_at     timestamptz := now() + interval '7 days';
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'E_FORBIDDEN: Access restricted to platform super admins'
      USING errcode = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM academies WHERE id = p_academy_id) THEN
    RAISE EXCEPTION 'E_NOT_FOUND: Academy not found'
      USING errcode = 'P0002';
  END IF;

  -- Revoke any pending invitations for this academy
  UPDATE academy_owner_invitations
  SET status = 'revoked'
  WHERE academy_id = p_academy_id AND status = 'pending';

  -- Generate new token
  v_raw_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

  INSERT INTO academy_owner_invitations (
    academy_id, token_hash, status, created_by, expires_at
  ) VALUES (
    p_academy_id, v_token_hash, 'pending', v_admin_id, v_expires_at
  ) RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object(
    'invitationId', v_invitation_id,
    'invitationToken', v_raw_token,
    'invitationExpiresAt', v_expires_at,
    'academyId', p_academy_id
  );
END $$;

-- 5. Super Admin Revoke Owner Invitation
CREATE OR REPLACE FUNCTION revoke_owner_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'E_FORBIDDEN: Access restricted to platform super admins'
      USING errcode = '42501';
  END IF;

  UPDATE academy_owner_invitations
  SET status = 'revoked'
  WHERE id = p_invitation_id AND status = 'pending';
END $$;

-- 6. Public RPC to inspect Owner Invitation details (safe, no secret exposure)
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

  SELECT name INTO v_academy_name
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
    'expiresAt', v_invitation.expires_at,
    'targetRole', 'academy_owner'
  );
END $$;

-- 7. Authenticated RPC to accept Owner Invitation and become active Owner
CREATE OR REPLACE FUNCTION accept_owner_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_token_hash   text;
  v_invitation   academy_owner_invitations;
  v_academy_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'E_UNAUTHENTICATED: Must be signed in to accept invitation'
      USING errcode = '28000';
  END IF;

  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'E_VALIDATION: Invitation token is required'
      USING errcode = '22023';
  END IF;

  v_token_hash := encode(digest(btrim(p_token), 'sha256'), 'hex');

  -- Lock invitation row
  SELECT * INTO v_invitation
  FROM academy_owner_invitations
  WHERE token_hash = v_token_hash
  FOR UPDATE;

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'E_NOT_FOUND: Invalid invitation token'
      USING errcode = 'P0002';
  END IF;

  IF v_invitation.status = 'accepted' THEN
    -- If current user is already the owner who accepted it, return success idempotently
    IF v_invitation.accepted_by = v_user_id THEN
      SELECT name INTO v_academy_name FROM academies WHERE id = v_invitation.academy_id;
      RETURN jsonb_build_object(
        'academyId', v_invitation.academy_id,
        'academyName', v_academy_name,
        'role', 'academy_owner',
        'alreadyAccepted', true
      );
    END IF;
    RAISE EXCEPTION 'E_CONFLICT: This invitation has already been used'
      USING errcode = '23505';
  END IF;

  IF v_invitation.status = 'revoked' THEN
    RAISE EXCEPTION 'E_VALIDATION: This invitation is no longer valid'
      USING errcode = '22023';
  END IF;

  IF v_invitation.status = 'expired' OR v_invitation.expires_at < now() THEN
    RAISE EXCEPTION 'E_VALIDATION: This invitation has expired'
      USING errcode = '22023';
  END IF;

  -- 1. Mark invitation accepted atomically
  UPDATE academy_owner_invitations
  SET status = 'accepted',
      accepted_by = v_user_id,
      accepted_at = now()
  WHERE id = v_invitation.id;

  -- 2. Update academy owner_user_id
  UPDATE academies
  SET owner_user_id = v_user_id,
      updated_at = now()
  WHERE id = v_invitation.academy_id
  RETURNING name INTO v_academy_name;

  -- 3. Upsert active owner membership
  INSERT INTO academy_members (
    academy_id, user_id, role, status, joined_at
  ) VALUES (
    v_invitation.academy_id, v_user_id, 'academy_owner', 'active', now()
  )
  ON CONFLICT (academy_id, user_id, role)
  DO UPDATE SET status = 'active', updated_at = now();

  RETURN jsonb_build_object(
    'academyId', v_invitation.academy_id,
    'academyName', v_academy_name,
    'role', 'academy_owner',
    'alreadyAccepted', false
  );
END $$;

-- 8. Enforce that join codes can NEVER grant Owner role
CREATE OR REPLACE FUNCTION request_join_by_code(
  p_code text,
  p_message text DEFAULT NULL
) RETURNS join_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_code    academy_join_codes;
  v_request join_requests;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'E_UNAUTHENTICATED' USING errcode = '28000';
  END IF;

  SELECT * INTO v_code
  FROM academy_join_codes c
  WHERE c.code = upper(btrim(p_code)) AND c.is_active
  FOR UPDATE;

  IF v_code.id IS NULL THEN
    RAISE EXCEPTION 'E_JOIN_CODE_INVALID' USING errcode = '22023';
  END IF;

  IF v_code.role = 'academy_owner' THEN
    RAISE EXCEPTION 'E_FORBIDDEN: Owner role cannot be requested via join codes'
      USING errcode = '42501';
  END IF;

  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RAISE EXCEPTION 'E_JOIN_CODE_EXPIRED' USING errcode = '22023';
  END IF;

  IF v_code.max_uses IS NOT NULL AND v_code.use_count >= v_code.max_uses THEN
    RAISE EXCEPTION 'E_JOIN_CODE_EXHAUSTED' USING errcode = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM academy_members m
    WHERE m.academy_id = v_code.academy_id
      AND m.user_id = v_user
      AND m.status IN ('active', 'pending')
  ) THEN
    RAISE EXCEPTION 'E_ALREADY_MEMBER' USING errcode = '23505';
  END IF;

  INSERT INTO join_requests (academy_id, user_id, join_code_id, requested_role, message)
  VALUES (v_code.academy_id, v_user, v_code.id, v_code.role, nullif(btrim(coalesce(p_message, '')), ''))
  ON CONFLICT (academy_id, user_id) WHERE status = 'pending' DO NOTHING
  RETURNING * INTO v_request;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'E_REQUEST_PENDING' USING errcode = '23505';
  END IF;

  UPDATE academy_join_codes
     SET use_count = use_count + 1
   WHERE id = v_code.id;

  RETURN v_request;
END $$;

-- 9. Explicit Grants
GRANT EXECUTE ON FUNCTION super_admin_create_academy_with_invite(text, text, text, text, text, fee_mode) TO authenticated;
GRANT EXECUTE ON FUNCTION regenerate_owner_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_owner_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_owner_invitation_details(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION accept_owner_invitation(text) TO authenticated;
