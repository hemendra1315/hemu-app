-- Migration 0026: Harden the Super Admin helper RPC and remove a stray probe row.
--
-- Background: migration 0025's `super_admin_get_or_create_user` is SECURITY DEFINER and
-- creates auth.users + profiles rows, but carried the Postgres default PUBLIC EXECUTE grant
-- (no explicit GRANT, no is_super_admin() guard). This let any anon/authenticated caller
-- invoke it. super_admin_add_member / super_admin_seed_academy_demo_data are the intended
-- entry points (they enforce is_super_admin()); the helper is internal.
--
-- Executed as a separate migration because 0025 has already been applied to this project.

REVOKE EXECUTE ON FUNCTION super_admin_get_or_create_user(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION super_admin_get_or_create_user(text, text, text) FROM anon, authenticated;

-- Clean up a single stray account created during RPC verification in this debugging session.
DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = 'probe@x.demo' LIMIT 1;
  IF v_id IS NOT NULL THEN
    DELETE FROM profiles WHERE id = v_id;
    DELETE FROM auth.users WHERE id = v_id;
  END IF;
END $$;