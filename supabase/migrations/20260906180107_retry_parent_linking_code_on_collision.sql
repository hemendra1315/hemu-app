-- Companion to parent_linking_codes_code_unique_idx: now that a code
-- collision is enforced at the database level, generate the code in a
-- small retry loop so the astronomically rare collision surfaces as a
-- fresh random code instead of a raw unique-violation error bubbling up
-- to the coach clicking "Generate Code".

create or replace function generate_parent_linking_code(
  p_academy_id uuid,
  p_player_user_id uuid,
  p_relationship_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_code text;
  v_attempt int := 0;
BEGIN
  IF NOT (is_staff(p_academy_id) OR auth.uid() = p_player_user_id) THEN
    RAISE EXCEPTION 'E_FORBIDDEN' USING errcode = '42501';
  END IF;

  IF p_relationship_type NOT IN ('father', 'mother', 'guardian', 'other') THEN
    RAISE EXCEPTION 'E_INVALID_RELATIONSHIP' USING errcode = '22023';
  END IF;

  UPDATE parent_linking_codes
  SET is_active = FALSE
  WHERE academy_id = p_academy_id
    AND player_user_id = p_player_user_id
    AND relationship_type = p_relationship_type
    AND is_active = TRUE;

  LOOP
    v_attempt := v_attempt + 1;
    v_code := upper(substring(replace(replace(replace(encode(gen_random_bytes(6), 'base64'), '/', 'A'), '+', 'B'), '=', 'C'), 1, 8));

    BEGIN
      INSERT INTO parent_linking_codes (
        academy_id, player_user_id, code, relationship_type, expires_at, created_by
      ) VALUES (
        p_academy_id, p_player_user_id, v_code, p_relationship_type, now() + interval '7 days', auth.uid()
      );
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 5 THEN
        RAISE;
      END IF;
      -- loop again with a freshly generated code
    END;
  END LOOP;
END;
$$;
