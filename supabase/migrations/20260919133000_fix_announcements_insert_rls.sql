-- Migration: Fix announcements_insert RLS policy for dual coach assignment support
-- Date: 2026-09-19
-- Description:
--   1. Allows Academy Owners and Super Admins to create announcements for all audiences.
--   2. Allows Coaches to create batch announcements for batches they coach, supporting both
--      legacy batches.coach_id and many-to-many batch_coaches.
--   3. Sets default created_by to auth.uid() if not provided.

DROP POLICY IF EXISTS announcements_insert ON announcements;

CREATE POLICY announcements_insert ON announcements FOR INSERT
  WITH CHECK (
    -- 1. Academy Owners & Super Admins can publish any announcement
    is_owner(academy_id) OR is_super_admin()
    OR (
      -- 2. Staff (coaches) can ONLY publish announcements targeting a batch they coach
      is_staff(academy_id) 
      AND audience = 'batch' 
      AND batch_id IS NOT NULL 
      AND (
        -- Check legacy batches.coach_id
        EXISTS (
          SELECT 1 FROM batches b
          JOIN academy_members am ON am.id = b.coach_id
          WHERE b.id = announcements.batch_id 
            AND am.user_id = auth.uid()
            AND am.status = 'active'
        )
        OR
        -- Check batch_coaches many-to-many table
        EXISTS (
          SELECT 1 FROM batch_coaches bc
          JOIN academy_members am ON am.id = bc.coach_id
          WHERE bc.batch_id = announcements.batch_id 
            AND am.user_id = auth.uid()
            AND am.status = 'active'
        )
      )
    )
  );

-- Ensure created_by defaults to auth.uid() if null
ALTER TABLE announcements ALTER COLUMN created_by SET DEFAULT auth.uid();
