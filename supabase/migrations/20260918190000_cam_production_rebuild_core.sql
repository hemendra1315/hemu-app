-- Migration: CAM Production Rebuild Core
-- Implements Rules 1, 2, 3, 4, 4A, 4B, 5, 6, 8, 8A, 9, 10

-- 1. Idempotency Keys (Rule 4B)
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    idempotency_key TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint_or_rpc TEXT NOT NULL,
    response_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_idempotency_key_user_rpc UNIQUE (idempotency_key, user_id, endpoint_or_rpc)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup 
ON public.idempotency_keys (idempotency_key, user_id, endpoint_or_rpc);

-- 2. Redemption Attempts (Rule 9 Abuse Protection)
CREATE TABLE IF NOT EXISTS public.redemption_attempts (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address INET,
    device_fingerprint TEXT,
    code_attempted TEXT NOT NULL,
    code_type TEXT NOT NULL,
    outcome TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_redemption_attempts_user_time 
ON public.redemption_attempts (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_redemption_attempts_device_time 
ON public.redemption_attempts (device_fingerprint, created_at);

-- 3. Audit Logs (Rule 10)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_state JSONB,
    new_state JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_academy_time 
ON public.audit_logs (academy_id, created_at);

-- 4. Payment & Invoice Types & Schema Additions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE public.payment_status AS ENUM (
            'pending',
            'pending_verification',
            'completed',
            'rejected',
            'failed',
            'refunded',
            'disputed'
        );
    ELSE
        -- Ensure all enum values exist
        ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'pending_verification';
        ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'rejected';
        ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'completed';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE public.payment_method AS ENUM (
            'cash',
            'upi',
            'bank_transfer',
            'fampay',
            'card',
            'cheque',
            'other'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE public.invoice_status AS ENUM (
            'draft',
            'issued',
            'partially_paid',
            'paid',
            'void',
            'overdue'
        );
    ELSE
        ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'partially_paid';
    END IF;
END $$;

-- Update Invoices table if needed
ALTER TABLE IF EXISTS public.invoices
    ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update Payments table if needed
ALTER TABLE IF EXISTS public.payments
    ADD COLUMN IF NOT EXISTS reference_number TEXT,
    ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS receipt_url TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS gateway_provider TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS gateway_order_id TEXT,
    ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
    ADD COLUMN IF NOT EXISTS gateway_signature TEXT,
    ADD COLUMN IF NOT EXISTS gateway_payload JSONB DEFAULT '{}'::jsonb;

-- 5. Push Subscriptions Table & Index (Rule 4A)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    token TEXT NOT NULL,
    platform TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_registered_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subs_active_user_device 
ON public.push_subscriptions (user_id, device_id) 
WHERE (is_active = TRUE);

CREATE INDEX IF NOT EXISTS idx_push_subs_active_token 
ON public.push_subscriptions (token) 
WHERE (is_active = TRUE);

-- 6. Helper Functions (Rules 3 & 6)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_super_admin = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.is_member(p_academy_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.academy_memberships
        WHERE academy_id = p_academy_id 
          AND user_id = auth.uid() 
          AND status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(p_academy_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.academy_memberships
        WHERE academy_id = p_academy_id 
          AND user_id = auth.uid() 
          AND role IN ('academy_owner', 'coach')
          AND status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_owner(p_academy_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.academy_memberships
        WHERE academy_id = p_academy_id 
          AND user_id = auth.uid() 
          AND role = 'academy_owner'
          AND status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.my_linked_players(p_academy_id UUID)
RETURNS TABLE (player_membership_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
STABLE
AS $$
    SELECT pl.player_membership_id
    FROM public.parent_links pl
    JOIN public.academy_memberships pm ON pl.parent_membership_id = pm.id
    WHERE pm.academy_id = p_academy_id
      AND pm.user_id = auth.uid()
      AND pm.status = 'active'
      AND pl.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.can_view_attendance(p_academy_id UUID, p_membership_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
STABLE
AS $$
    SELECT 
        public.is_super_admin()
        OR public.is_staff(p_academy_id)
        OR EXISTS (
            SELECT 1 FROM public.academy_memberships m
            WHERE m.id = p_membership_id AND m.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.my_linked_players(p_academy_id) lp
            WHERE lp.player_membership_id = p_membership_id
        );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_billing(p_academy_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
STABLE
AS $$
    SELECT public.is_super_admin() OR public.is_staff(p_academy_id);
$$;

-- 7. Canonical RPCs (Rules 1, 4, 4A, 4B, 9)

-- 7.1 Register Push Token (Rule 4A)
CREATE OR REPLACE FUNCTION public.register_push_token(
    p_device_id TEXT,
    p_token TEXT,
    p_platform TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_sub_id UUID;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'E_NOT_AUTHORIZED'; END IF;
    IF TRIM(p_device_id) = '' OR TRIM(p_token) = '' THEN RAISE EXCEPTION 'E_INVALID_ARGUMENT'; END IF;

    -- Deactivate token if it was active on any other device/user
    UPDATE public.push_subscriptions
    SET is_active = FALSE, updated_at = clock_timestamp()
    WHERE token = p_token AND (device_id != p_device_id OR user_id != v_user_id) AND is_active = TRUE;

    -- Upsert active token for current user and device
    INSERT INTO public.push_subscriptions (
        user_id, device_id, token, platform, is_active, last_registered_at, created_at, updated_at
    )
    VALUES (
        v_user_id, p_device_id, p_token, p_platform, TRUE, clock_timestamp(), clock_timestamp(), clock_timestamp()
    )
    ON CONFLICT (user_id, device_id) WHERE (is_active = TRUE)
    DO UPDATE SET
        token = EXCLUDED.token,
        platform = EXCLUDED.platform,
        is_active = TRUE,
        last_registered_at = clock_timestamp(),
        updated_at = clock_timestamp()
    RETURNING id INTO v_sub_id;

    RETURN jsonb_build_object('success', true, 'subscription_id', v_sub_id);
END;
$$;

-- 7.2 Redeem Join Code (Rules 1, 4, 4B, 9)
CREATE OR REPLACE FUNCTION public.redeem_join_code(
    p_code TEXT,
    p_idempotency_key TEXT,
    p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_cached_response JSONB;
    v_fail_count INT;
    v_code_rec RECORD;
    v_membership RECORD;
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'E_NOT_AUTHORIZED'; END IF;

    -- Idempotency Cache Check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT response_payload INTO v_cached_response
        FROM public.idempotency_keys
        WHERE idempotency_key = p_idempotency_key 
          AND user_id = v_user_id 
          AND endpoint_or_rpc = 'redeem_join_code';

        IF FOUND THEN RETURN v_cached_response; END IF;
    END IF;

    -- Rate limit check (Max 5 failed attempts in 15 mins)
    SELECT COUNT(*) INTO v_fail_count
    FROM public.redemption_attempts
    WHERE (user_id = v_user_id OR device_fingerprint = p_device_fingerprint)
      AND outcome != 'success'
      AND created_at > clock_timestamp() - INTERVAL '15 minutes';

    IF v_fail_count >= 5 THEN
        INSERT INTO public.redemption_attempts (user_id, device_fingerprint, code_attempted, code_type, outcome)
        VALUES (v_user_id, p_device_fingerprint, p_code, 'join_code', 'locked_out');
        RAISE EXCEPTION 'E_RATE_LIMIT_EXCEEDED';
    END IF;

    -- Lookup Code
    SELECT * INTO v_code_rec
    FROM public.academy_join_codes
    WHERE code = UPPER(TRIM(p_code))
      AND is_active = TRUE
      AND expires_at > clock_timestamp()
      AND (max_uses IS NULL OR uses_count < max_uses)
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.redemption_attempts (user_id, device_fingerprint, code_attempted, code_type, outcome)
        VALUES (v_user_id, p_device_fingerprint, p_code, 'join_code', 'invalid_code');
        RAISE EXCEPTION 'E_INVALID_JOIN_CODE';
    END IF;

    -- Canonical Membership Upsert (Rule 4)
    INSERT INTO public.academy_memberships (
        academy_id, user_id, role, status, joined_at
    )
    VALUES (
        v_code_rec.academy_id, v_user_id, v_code_rec.role, 'active', clock_timestamp()
    )
    ON CONFLICT (academy_id, user_id)
    DO UPDATE SET
        role = EXCLUDED.role,
        status = 'active',
        left_at = NULL,
        suspended_at = NULL,
        suspension_reason = NULL,
        updated_at = clock_timestamp()
    RETURNING id, academy_id, role, status INTO v_membership;

    IF v_code_rec.batch_id IS NOT NULL THEN
        INSERT INTO public.batch_memberships (batch_id, membership_id, status)
        VALUES (v_code_rec.batch_id, v_membership.id, 'active')
        ON CONFLICT (batch_id, membership_id)
        DO UPDATE SET status = 'active', updated_at = clock_timestamp();
    END IF;

    UPDATE public.academy_join_codes
    SET uses_count = uses_count + 1
    WHERE id = v_code_rec.id;

    INSERT INTO public.redemption_attempts (user_id, device_fingerprint, code_attempted, code_type, outcome)
    VALUES (v_user_id, p_device_fingerprint, p_code, 'join_code', 'success');

    -- Rule 1 Authoritative Payload
    v_result := jsonb_build_object(
        'success', true,
        'academy_id', v_membership.academy_id,
        'membership_id', v_membership.id,
        'role', v_membership.role,
        'status', v_membership.status
    );

    IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.idempotency_keys (idempotency_key, user_id, endpoint_or_rpc, response_payload)
        VALUES (p_idempotency_key, v_user_id, 'redeem_join_code', v_result);
    END IF;

    RETURN v_result;
END;
$$;

-- 7.3 Redeem Parent Link Code (Rule 4, 4B)
CREATE OR REPLACE FUNCTION public.redeem_parent_link_code(
    p_code TEXT,
    p_idempotency_key TEXT,
    p_relationship TEXT DEFAULT 'parent'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_cached JSONB;
    v_code_rec RECORD;
    v_parent_membership_id UUID;
    v_parent_role public.user_role;
    v_parent_status public.membership_status;
    v_link_id UUID;
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'E_NOT_AUTHORIZED'; END IF;

    IF p_idempotency_key IS NOT NULL THEN
        SELECT response_payload INTO v_cached FROM public.idempotency_keys
        WHERE idempotency_key = p_idempotency_key AND user_id = v_user_id AND endpoint_or_rpc = 'redeem_parent_link_code';
        IF FOUND THEN RETURN v_cached; END IF;
    END IF;

    SELECT * INTO v_code_rec FROM public.parent_link_codes
    WHERE code = UPPER(TRIM(p_code)) AND redeemed_at IS NULL AND expires_at > clock_timestamp()
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'E_PARENT_LINK_EXPIRED'; END IF;

    -- Upsert Parent Membership
    INSERT INTO public.academy_memberships (academy_id, user_id, role, status, joined_at)
    VALUES (v_code_rec.academy_id, v_user_id, 'parent', 'active', clock_timestamp())
    ON CONFLICT (academy_id, user_id)
    DO UPDATE SET status = 'active', left_at = NULL, updated_at = clock_timestamp()
    RETURNING id, role, status INTO v_parent_membership_id, v_parent_role, v_parent_status;

    IF v_parent_membership_id = v_code_rec.player_membership_id THEN
        RAISE EXCEPTION 'E_CANNOT_LINK_SELF';
    END IF;

    -- Canonical Upsert Parent Link
    INSERT INTO public.parent_links (academy_id, parent_membership_id, player_membership_id, relationship, status)
    VALUES (v_code_rec.academy_id, v_parent_membership_id, v_code_rec.player_membership_id, p_relationship, 'active')
    ON CONFLICT (parent_membership_id, player_membership_id)
    DO UPDATE SET relationship = EXCLUDED.relationship, status = 'active', updated_at = clock_timestamp()
    RETURNING id INTO v_link_id;

    UPDATE public.parent_link_codes
    SET redeemed_at = clock_timestamp(), redeemed_by_membership_id = v_parent_membership_id
    WHERE id = v_code_rec.id;

    v_result := jsonb_build_object(
        'success', true,
        'link_id', v_link_id,
        'academy_id', v_code_rec.academy_id,
        'parent_membership_id', v_parent_membership_id,
        'player_membership_id', v_code_rec.player_membership_id,
        'role', v_parent_role,
        'status', v_parent_status
    );

    IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.idempotency_keys (idempotency_key, user_id, endpoint_or_rpc, response_payload)
        VALUES (p_idempotency_key, v_user_id, 'redeem_parent_link_code', v_result);
    END IF;

    RETURN v_result;
END;
$$;

-- 7.4 Record Manual Payment (Staff Manual Recording)
CREATE OR REPLACE FUNCTION public.record_manual_payment(
    p_academy_id UUID,
    p_invoice_id UUID,
    p_amount NUMERIC(10,2),
    p_payment_method public.payment_method,
    p_reference_number TEXT,
    p_idempotency_key TEXT,
    p_notes TEXT DEFAULT NULL,
    p_receipt_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_cached JSONB;
    v_invoice RECORD;
    v_new_paid_amount NUMERIC(10,2);
    v_new_status public.invoice_status;
    v_payment_id UUID;
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'E_NOT_AUTHORIZED'; END IF;
    IF NOT (public.is_super_admin() OR public.can_manage_billing(p_academy_id)) THEN
        RAISE EXCEPTION 'E_NOT_AUTHORIZED';
    END IF;
    IF p_amount <= 0 THEN RAISE EXCEPTION 'E_INVALID_AMOUNT'; END IF;

    -- Idempotency Check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT response_payload INTO v_cached
        FROM public.idempotency_keys
        WHERE idempotency_key = p_idempotency_key 
          AND user_id = v_user_id 
          AND endpoint_or_rpc = 'record_manual_payment';

        IF FOUND THEN RETURN v_cached; END IF;
    END IF;

    -- Lock & Fetch Invoice
    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id AND academy_id = p_academy_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'E_INVOICE_NOT_FOUND'; END IF;
    IF v_invoice.status IN ('paid', 'void') THEN RAISE EXCEPTION 'E_INVOICE_ALREADY_SETTLED'; END IF;

    v_new_paid_amount := COALESCE(v_invoice.paid_amount, 0) + p_amount;
    IF v_new_paid_amount > v_invoice.total_amount THEN
        RAISE EXCEPTION 'E_PAYMENT_EXCEEDS_INVOICE_TOTAL';
    END IF;

    IF v_new_paid_amount >= v_invoice.total_amount THEN
        v_new_status := 'paid';
    ELSE
        v_new_status := 'partially_paid';
    END IF;

    -- Insert Payment
    INSERT INTO public.payments (
        academy_id, invoice_id, membership_id, amount, currency,
        payment_method, status, reference_number, collected_by,
        receipt_url, notes, gateway_provider, paid_at
    )
    VALUES (
        p_academy_id, p_invoice_id, v_invoice.membership_id, p_amount, 'INR',
        p_payment_method, 'completed', p_reference_number, v_user_id,
        p_receipt_url, p_notes, 'manual', clock_timestamp()
    )
    RETURNING id INTO v_payment_id;

    -- Update Invoice
    UPDATE public.invoices
    SET paid_amount = v_new_paid_amount,
        status = v_new_status,
        paid_at = CASE WHEN v_new_status = 'paid' THEN clock_timestamp() ELSE paid_at END,
        updated_at = clock_timestamp()
    WHERE id = p_invoice_id;

    -- Audit Log
    INSERT INTO public.audit_logs (
        academy_id, user_id, action, entity_type, entity_id, old_state, new_state
    )
    VALUES (
        p_academy_id, v_user_id, 'RECORD_MANUAL_PAYMENT', 'payments', v_payment_id,
        jsonb_build_object('invoice_status', v_invoice.status, 'paid_amount', v_invoice.paid_amount),
        jsonb_build_object('invoice_status', v_new_status, 'paid_amount', v_new_paid_amount, 'amount', p_amount, 'method', p_payment_method, 'ref', p_reference_number)
    );

    v_result := jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'invoice_id', p_invoice_id,
        'amount', p_amount,
        'payment_method', p_payment_method,
        'invoice_status', v_new_status,
        'total_paid', v_new_paid_amount,
        'remaining_balance', v_invoice.total_amount - v_new_paid_amount
    );

    IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.idempotency_keys (idempotency_key, user_id, endpoint_or_rpc, response_payload)
        VALUES (p_idempotency_key, v_user_id, 'record_manual_payment', v_result);
    END IF;

    RETURN v_result;
END;
$$;

-- 7.5 Submit Payment Proof (Player/Parent Flow)
CREATE OR REPLACE FUNCTION public.submit_payment_proof(
    p_invoice_id UUID,
    p_amount NUMERIC(10,2),
    p_payment_method public.payment_method,
    p_reference_number TEXT,
    p_receipt_url TEXT,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_cached JSONB;
    v_invoice RECORD;
    v_payment_id UUID;
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'E_NOT_AUTHORIZED'; END IF;
    IF p_amount <= 0 THEN RAISE EXCEPTION 'E_INVALID_AMOUNT'; END IF;

    IF p_idempotency_key IS NOT NULL THEN
        SELECT response_payload INTO v_cached
        FROM public.idempotency_keys
        WHERE idempotency_key = p_idempotency_key AND user_id = v_user_id AND endpoint_or_rpc = 'submit_payment_proof';
        IF FOUND THEN RETURN v_cached; END IF;
    END IF;

    SELECT i.*, m.user_id as member_user_id INTO v_invoice
    FROM public.invoices i
    JOIN public.academy_memberships m ON i.membership_id = m.id
    WHERE i.id = p_invoice_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'E_INVOICE_NOT_FOUND'; END IF;

    IF v_invoice.member_user_id != v_user_id AND NOT EXISTS (
        SELECT 1 FROM public.my_linked_players(v_invoice.academy_id) lp
        WHERE lp.player_membership_id = v_invoice.membership_id
    ) THEN
        RAISE EXCEPTION 'E_NOT_AUTHORIZED';
    END IF;

    IF v_invoice.status IN ('paid', 'void') THEN
        RAISE EXCEPTION 'E_INVOICE_ALREADY_SETTLED';
    END IF;

    INSERT INTO public.payments (
        academy_id, invoice_id, membership_id, amount, currency,
        payment_method, status, reference_number, submitted_by,
        receipt_url, notes, gateway_provider, created_at, updated_at
    )
    VALUES (
        v_invoice.academy_id, p_invoice_id, v_invoice.membership_id, p_amount, 'INR',
        p_payment_method, 'pending_verification', p_reference_number, v_user_id,
        p_receipt_url, p_notes, 'manual', clock_timestamp(), clock_timestamp()
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO public.audit_logs (
        academy_id, user_id, action, entity_type, entity_id, new_state
    )
    VALUES (
        v_invoice.academy_id, v_user_id, 'SUBMIT_PAYMENT_PROOF', 'payments', v_payment_id,
        jsonb_build_object('status', 'pending_verification', 'amount', p_amount, 'method', p_payment_method, 'receipt_url', p_receipt_url)
    );

    v_result := jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'status', 'pending_verification',
        'message', 'Payment proof submitted successfully for verification.'
    );

    IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.idempotency_keys (idempotency_key, user_id, endpoint_or_rpc, response_payload)
        VALUES (p_idempotency_key, v_user_id, 'submit_payment_proof', v_result);
    END IF;

    RETURN v_result;
END;
$$;

-- 7.6 Review Payment Proof (Staff Approve / Reject)
CREATE OR REPLACE FUNCTION public.review_payment_proof(
    p_payment_id UUID,
    p_action TEXT,
    p_rejection_reason TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_cached JSONB;
    v_payment RECORD;
    v_invoice RECORD;
    v_new_paid_amount NUMERIC(10,2);
    v_new_status public.invoice_status;
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'E_NOT_AUTHORIZED'; END IF;

    IF p_idempotency_key IS NOT NULL THEN
        SELECT response_payload INTO v_cached
        FROM public.idempotency_keys
        WHERE idempotency_key = p_idempotency_key AND user_id = v_user_id AND endpoint_or_rpc = 'review_payment_proof';
        IF FOUND THEN RETURN v_cached; END IF;
    END IF;

    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'E_PAYMENT_NOT_FOUND'; END IF;
    IF v_payment.status != 'pending_verification' THEN RAISE EXCEPTION 'E_PAYMENT_ALREADY_PROCESSED'; END IF;

    IF NOT (public.is_super_admin() OR public.can_manage_billing(v_payment.academy_id)) THEN
        RAISE EXCEPTION 'E_NOT_AUTHORIZED';
    END IF;

    IF p_action = 'approve' THEN
        SELECT * INTO v_invoice
        FROM public.invoices
        WHERE id = v_payment.invoice_id
        FOR UPDATE;

        v_new_paid_amount := COALESCE(v_invoice.paid_amount, 0) + v_payment.amount;
        IF v_new_paid_amount >= v_invoice.total_amount THEN
            v_new_status := 'paid';
        ELSE
            v_new_status := 'partially_paid';
        END IF;

        UPDATE public.payments
        SET status = 'completed',
            verified_by = v_user_id,
            verified_at = clock_timestamp(),
            paid_at = clock_timestamp(),
            updated_at = clock_timestamp()
        WHERE id = p_payment_id;

        UPDATE public.invoices
        SET paid_amount = v_new_paid_amount,
            status = v_new_status,
            paid_at = CASE WHEN v_new_status = 'paid' THEN clock_timestamp() ELSE paid_at END,
            updated_at = clock_timestamp()
        WHERE id = v_payment.invoice_id;

        INSERT INTO public.audit_logs (academy_id, user_id, action, entity_type, entity_id, new_state)
        VALUES (v_payment.academy_id, v_user_id, 'APPROVE_PAYMENT_PROOF', 'payments', p_payment_id, jsonb_build_object('status', 'completed', 'verified_by', v_user_id));

        v_result := jsonb_build_object(
            'success', true,
            'payment_id', p_payment_id,
            'status', 'completed',
            'invoice_status', v_new_status,
            'total_paid', v_new_paid_amount
        );

    ELSIF p_action = 'reject' THEN
        UPDATE public.payments
        SET status = 'rejected',
            rejection_reason = p_rejection_reason,
            verified_by = v_user_id,
            verified_at = clock_timestamp(),
            updated_at = clock_timestamp()
        WHERE id = p_payment_id;

        INSERT INTO public.audit_logs (academy_id, user_id, action, entity_type, entity_id, new_state)
        VALUES (v_payment.academy_id, v_user_id, 'REJECT_PAYMENT_PROOF', 'payments', p_payment_id, jsonb_build_object('status', 'rejected', 'reason', p_rejection_reason));

        v_result := jsonb_build_object(
            'success', true,
            'payment_id', p_payment_id,
            'status', 'rejected',
            'rejection_reason', p_rejection_reason
        );
    ELSE
        RAISE EXCEPTION 'E_INVALID_ACTION';
    END IF;

    IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.idempotency_keys (idempotency_key, user_id, endpoint_or_rpc, response_payload)
        VALUES (p_idempotency_key, v_user_id, 'review_payment_proof', v_result);
    END IF;

    RETURN v_result;
END;
$$;

-- 8. Grants
GRANT EXECUTE ON FUNCTION public.register_push_token(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_join_code(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_parent_link_code(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_manual_payment(UUID, UUID, NUMERIC, public.payment_method, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(UUID, NUMERIC, public.payment_method, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_payment_proof(UUID, TEXT, TEXT, TEXT) TO authenticated;
