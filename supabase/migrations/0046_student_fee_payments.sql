-- Migration 0046: Student Fee Payments Table & RLS Policies

CREATE TABLE IF NOT EXISTS public.student_fee_payments (
    id TEXT PRIMARY KEY,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    registered_name TEXT,
    payer_name TEXT,
    student_email TEXT,
    academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE,
    academy_name TEXT,
    month_key TEXT NOT NULL,
    month_label TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 200,
    utr TEXT,
    screenshot_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_student_fee_payments_student_month ON public.student_fee_payments(student_id, month_key);
CREATE INDEX IF NOT EXISTS idx_student_fee_payments_academy_month ON public.student_fee_payments(academy_id, month_key);
CREATE INDEX IF NOT EXISTS idx_student_fee_payments_status ON public.student_fee_payments(status);

-- Enable RLS
ALTER TABLE public.student_fee_payments ENABLE ROW LEVEL SECURITY;

-- 1. Students can view their own payment submissions
CREATE POLICY "Students can view own fee payments"
    ON public.student_fee_payments
    FOR SELECT
    TO authenticated
    USING (student_id = auth.uid() OR public.is_super_admin());

-- 2. Students can insert their own payment submission
CREATE POLICY "Students can submit own fee payment"
    ON public.student_fee_payments
    FOR INSERT
    TO authenticated
    WITH CHECK (student_id = auth.uid() OR public.is_super_admin());

-- 3. Academy Owners, Coaches and Super Admins can view academy fee payments
CREATE POLICY "Academy staff can view student payments"
    ON public.student_fee_payments
    FOR SELECT
    TO authenticated
    USING (
        public.is_super_admin() OR
        EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.academy_id = student_fee_payments.academy_id
            AND m.user_id = auth.uid()
            AND m.role IN ('academy_owner', 'coach')
            AND m.status = 'active'
        )
    );

-- 4. Academy Owners and Super Admins can update payment verification status
CREATE POLICY "Academy owners can update payment verification status"
    ON public.student_fee_payments
    FOR UPDATE
    TO authenticated
    USING (
        public.is_super_admin() OR
        EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.academy_id = student_fee_payments.academy_id
            AND m.user_id = auth.uid()
            AND m.role = 'academy_owner'
            AND m.status = 'active'
        )
    )
    WITH CHECK (
        public.is_super_admin() OR
        EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.academy_id = student_fee_payments.academy_id
            AND m.user_id = auth.uid()
            AND m.role = 'academy_owner'
            AND m.status = 'active'
        )
    );
