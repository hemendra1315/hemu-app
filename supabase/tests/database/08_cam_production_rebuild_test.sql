-- pgTAP RLS & RPC Test Suite for CAM Production Rebuild Core
-- Covers Rules 1, 4, 4A, 4B, 5, 6, 8, 9, 10

BEGIN;
SELECT plan(12);

-- 1. Schema integrity & functions existence
SELECT has_table('public', 'idempotency_keys', 'idempotency_keys table exists');
SELECT has_table('public', 'redemption_attempts', 'redemption_attempts table exists');
SELECT has_table('public', 'audit_logs', 'audit_logs table exists');
SELECT has_table('public', 'push_subscriptions', 'push_subscriptions table exists');

SELECT has_function('public', 'register_push_token', ARRAY['text', 'text', 'text'], 'register_push_token RPC exists');
SELECT has_function('public', 'redeem_join_code', ARRAY['text', 'text', 'text'], 'redeem_join_code RPC exists');
SELECT has_function('public', 'redeem_parent_link_code', ARRAY['text', 'text', 'text'], 'redeem_parent_link_code RPC exists');
SELECT has_function('public', 'record_manual_payment', ARRAY['uuid', 'uuid', 'numeric', 'public.payment_method', 'text', 'text', 'text', 'text'], 'record_manual_payment RPC exists');
SELECT has_function('public', 'submit_payment_proof', ARRAY['uuid', 'numeric', 'public.payment_method', 'text', 'text', 'text', 'text'], 'submit_payment_proof RPC exists');
SELECT has_function('public', 'review_payment_proof', ARRAY['uuid', 'text', 'text', 'text'], 'review_payment_proof RPC exists');

-- 2. Check RLS enabled on core tables
SELECT results_eq(
    $$ SELECT relrowsecurity FROM pg_class WHERE relname = 'invoices' $$,
    $$ VALUES (true) $$,
    'RLS is enabled on invoices'
);

SELECT results_eq(
    $$ SELECT relrowsecurity FROM pg_class WHERE relname = 'payments' $$,
    $$ VALUES (true) $$,
    'RLS is enabled on payments'
);

SELECT * FROM finish();
ROLLBACK;
