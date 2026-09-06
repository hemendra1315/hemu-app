-- parent_linking_codes.code had no uniqueness guarantee at all -- only a
-- per-(academy, player, relationship) partial-unique index on the *active*
-- row. generate_parent_linking_code() picks a random 8-character code with
-- no collision check, and redeem_parent_linking_code() looks a code up by
-- value alone (`WHERE code = upper(p_code) AND is_active = TRUE`) with no
-- LIMIT 1 / ORDER BY -- if two different players' codes ever collided, a
-- parent could redeem the wrong one and get linked to the wrong child.
-- The code space (~64^8) makes an accidental collision astronomically
-- unlikely at this app's scale, but there's no reason to leave the door
-- open at all. A unique index closes it permanently, and turns a would-be
-- silent misdelivery into a loud, retryable insert failure instead.

create unique index if not exists parent_linking_codes_code_unique_idx
  on public.parent_linking_codes (code);
