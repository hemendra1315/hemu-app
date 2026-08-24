-- Migration 0021: CricHeroes Persistent Player Identity Mappings
-- Stores academy-scoped player mappings between CricHeroes player identities/names and academy members.

CREATE TABLE IF NOT EXISTS cricheroes_player_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  cricheroes_player_id text, -- optional CricHeroes unique profile ID
  cricheroes_name text NOT NULL, -- CricHeroes displayed name
  academy_member_id uuid REFERENCES academy_members(id) ON DELETE CASCADE, -- NULL means mapped as Guest Player
  is_guest boolean NOT NULL DEFAULT false,
  confidence_score integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Unique constraint: an academy cannot have duplicate CricHeroes ID or Name mappings
  CONSTRAINT cricheroes_player_mappings_academy_name_key UNIQUE (academy_id, cricheroes_name)
);

-- Index for quick lookup during CricHeroes PDF import
CREATE INDEX IF NOT EXISTS idx_cricheroes_mappings_lookup
  ON cricheroes_player_mappings (academy_id, cricheroes_name);

CREATE INDEX IF NOT EXISTS idx_cricheroes_mappings_id_lookup
  ON cricheroes_player_mappings (academy_id, cricheroes_player_id)
  WHERE cricheroes_player_id IS NOT NULL;

-- Enable RLS
ALTER TABLE cricheroes_player_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant isolation (Users can only view/manage mappings for their active academy)
CREATE POLICY cricheroes_mappings_tenant_isolation ON cricheroes_player_mappings
  FOR ALL
  USING (
    academy_id IN (
      SELECT academy_id FROM academy_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    academy_id IN (
      SELECT academy_id FROM academy_members WHERE user_id = auth.uid()
    )
  );

-- RPC to upsert CricHeroes player mappings in bulk
CREATE OR REPLACE FUNCTION upsert_cricheroes_player_mappings(
  p_academy_id uuid,
  p_mappings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  -- Authorization check: caller must be a staff member (owner or coach) of p_academy_id
  IF NOT is_staff(p_academy_id) THEN
    RAISE EXCEPTION 'E_FORBIDDEN: User is not authorized to manage player mappings for this academy'
      USING errcode = '42501';
  END IF;

  IF p_mappings IS NULL OR p_mappings = '[]'::jsonb THEN
    RETURN;
  END IF;

  FOR rec IN SELECT * FROM jsonb_to_recordset(p_mappings)
    AS x(cricheroes_player_id text, cricheroes_name text, academy_member_id uuid, is_guest boolean, confidence_score integer)
  LOOP
    INSERT INTO cricheroes_player_mappings (
      academy_id, cricheroes_player_id, cricheroes_name, academy_member_id, is_guest, confidence_score, updated_at
    ) VALUES (
      p_academy_id, rec.cricheroes_player_id, rec.cricheroes_name, rec.academy_member_id, coalesce(rec.is_guest, false), coalesce(rec.confidence_score, 100), now()
    )
    ON CONFLICT (academy_id, cricheroes_name) DO UPDATE SET
      cricheroes_player_id = coalesce(excluded.cricheroes_player_id, cricheroes_player_mappings.cricheroes_player_id),
      academy_member_id = excluded.academy_member_id,
      is_guest = excluded.is_guest,
      confidence_score = excluded.confidence_score,
      updated_at = now();
  END LOOP;
END;
$$;
