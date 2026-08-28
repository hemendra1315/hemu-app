-- Migration 0029: Make batch timing and training days optional (nullable) in PostgreSQL
-- Allows batches to be created with only Name and Age Group while leaving timing, days, and coach as NULL.

ALTER TABLE batches ALTER COLUMN training_days DROP NOT NULL;
ALTER TABLE batches ALTER COLUMN training_time DROP NOT NULL;
