-- ============================================================================
-- Phase 2 — Player Cricket Card Profile Fields
-- Appends cricket identity fields to the existing academy_members table
-- to avoid duplicating member and player records.
-- ============================================================================

alter table academy_members
  add column if not exists player_code text,
  add column if not exists batting_style text check (batting_style in ('right_hand', 'left_hand')),
  add column if not exists bowling_style text,
  add column if not exists player_role text check (player_role in ('batsman', 'bowler', 'all_rounder', 'wicketkeeper')),
  add column if not exists jersey_number integer,
  add column if not exists bio text;

-- Add a unique constraint for player_code per academy, ignoring nulls
create unique index if not exists academy_members_player_code_idx
  on academy_members (academy_id, player_code)
  where player_code is not null;
