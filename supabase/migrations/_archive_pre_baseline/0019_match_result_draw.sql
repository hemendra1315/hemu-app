-- Add 'draw' to match_result enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'match_result'::regtype
      AND enumlabel = 'draw'
  ) THEN
    ALTER TYPE match_result ADD VALUE 'draw';
  END IF;
END $$;
