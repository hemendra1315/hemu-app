-- Migration 0028: Make batches.coach_id optional (nullable)
-- Allows batches to be created without an assigned coach or before coaches are added to an academy.

ALTER TABLE batches ALTER COLUMN coach_id DROP NOT NULL;
