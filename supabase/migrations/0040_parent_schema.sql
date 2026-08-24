-- ============================================================================
-- Phase 3 — Parent Accounts Schema
-- ============================================================================

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'parent';

CREATE TABLE parent_player_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    player_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('father', 'mother', 'guardian', 'other')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(parent_user_id, player_user_id, academy_id)
);

CREATE TRIGGER parent_player_links_set_updated_at
  BEFORE UPDATE ON parent_player_links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE parent_linking_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    player_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    code TEXT NOT NULL CHECK (length(code) = 8 AND code ~ '^[A-Z0-9]+$'),
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('father', 'mother', 'guardian', 'other')),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX parent_linking_codes_active_idx 
    ON parent_linking_codes (academy_id, player_user_id, relationship_type) 
    WHERE is_active = TRUE;
