-- ============================================================================
-- 0046: Announcement targeting — several batches and named individuals
--
-- Until now an announcement reached exactly one audience: everyone, all
-- coaches, all players, all parents, or ONE batch via `announcements.batch_id`.
-- This adds a `custom` audience backed by a join table, so a single
-- announcement can name several batches and/or specific people.
--
-- It also repairs three live defects found while building this:
--
--   1. Migration 0042 added 'all_parents' to `audience_type` and the compose
--      screen offers it, but the fan-out trigger was never updated to handle it.
--      Choosing "All Parents" wrote the announcement and created ZERO
--      notifications — no bell, no badge, silently nothing.
--   2. A 'batch' announcement notified the batch's players and its coach but
--      never the parents linked to those players, even though the RLS added in
--      0044 lets those parents read it. The bell disagreed with the feed.
--   3. `notifications` has no unique constraint, so the `on conflict do nothing`
--      in the original trigger could never fire. Anyone matching two branches
--      (a batch coach who is also a batch member) got duplicate notifications.
--
-- Writes go through `create_announcement_with_targets`, following this repo's
-- existing convention that multi-table writes live in one transactional RPC
-- (see `save_match_result`, `create_academy`).
--
-- Notifications stay one row per recipient carrying a `channel`, so a later
-- real-push sender can consume rows where channel = 'push' without reworking
-- any of this. Nothing speculative is created for that here.
--
-- Idempotent: safe to run more than once, including on a database that has
-- drifted from the migration history.
-- ============================================================================

ALTER TYPE audience_type ADD VALUE IF NOT EXISTS 'custom';

-- ------------------------------------------------- one notification per person --
-- De-duplicate any existing rows before adding the constraint, otherwise the
-- index creation fails on databases that already collected duplicates.
DELETE FROM notifications a
USING notifications b
WHERE a.announcement_id IS NOT NULL
  AND a.announcement_id = b.announcement_id
  AND a.recipient_user_id = b.recipient_user_id
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_announcement_recipient_unique
  ON notifications (announcement_id, recipient_user_id)
  WHERE announcement_id IS NOT NULL;

-- --------------------------------------------------------------- targets --------
CREATE TABLE IF NOT EXISTS announcement_targets (
  id                uuid primary key default gen_random_uuid(),
  announcement_id   uuid not null references announcements(id) on delete cascade,
  academy_id        uuid not null references academies(id) on delete cascade,
  batch_id          uuid references batches(id) on delete cascade,
  academy_member_id uuid references academy_members(id) on delete cascade,
  created_at        timestamptz not null default now(),
  -- Exactly one of the two: a row targets a batch or a person, never both.
  constraint announcement_targets_one_target
    check (num_nonnulls(batch_id, academy_member_id) = 1)
);

CREATE INDEX IF NOT EXISTS announcement_targets_announcement_idx
  ON announcement_targets (announcement_id);

-- Partial unique indexes: a plain UNIQUE across nullable columns would not stop
-- the same batch being added twice, because NULL never equals NULL.
CREATE UNIQUE INDEX IF NOT EXISTS announcement_targets_unique_batch
  ON announcement_targets (announcement_id, batch_id) WHERE batch_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS announcement_targets_unique_member
  ON announcement_targets (announcement_id, academy_member_id) WHERE academy_member_id IS NOT NULL;

ALTER TABLE announcement_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcement_targets_select ON announcement_targets;
CREATE POLICY announcement_targets_select ON announcement_targets FOR SELECT
  USING (is_member(academy_id) OR is_super_admin());

DROP POLICY IF EXISTS announcement_targets_write ON announcement_targets;
CREATE POLICY announcement_targets_write ON announcement_targets FOR ALL
  USING (is_staff(academy_id)) WITH CHECK (is_staff(academy_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON announcement_targets TO authenticated;

-- --------------------------------------------------------------- fan-out --------
-- A plain function rather than only a trigger body, so the RPC below can call it
-- directly once target rows exist. One statement per branch, and every branch
-- UNIONs its recipients so a person matched twice is still notified once.
CREATE OR REPLACE FUNCTION fanout_announcement(p_announcement uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a           announcements;
  v_audience  text;
  v_inserted  integer := 0;
BEGIN
  SELECT * INTO a FROM announcements WHERE id = p_announcement;
  IF a.id IS NULL THEN
    RETURN 0;
  END IF;
  v_audience := a.audience::text;

  IF v_audience = 'all' THEN
    INSERT INTO notifications (academy_id, announcement_id, recipient_user_id, title, message, notification_type, metadata)
    SELECT a.academy_id, a.id, user_id, a.title, a.message, 'announcement',
           jsonb_build_object('announcement_id', a.id)
    FROM academy_members
    WHERE academy_id = a.academy_id AND status = 'active' AND user_id IS NOT NULL
    ON CONFLICT DO NOTHING;

  ELSIF v_audience IN ('coaches', 'players') THEN
    INSERT INTO notifications (academy_id, announcement_id, recipient_user_id, title, message, notification_type, metadata)
    SELECT a.academy_id, a.id, user_id, a.title, a.message, 'announcement',
           jsonb_build_object('announcement_id', a.id)
    FROM academy_members
    WHERE academy_id = a.academy_id
      AND status = 'active'
      AND user_id IS NOT NULL
      AND role::text = CASE WHEN v_audience = 'coaches' THEN 'coach' ELSE 'player' END
    ON CONFLICT DO NOTHING;

  -- Defect 1: this branch did not exist, so "All Parents" notified nobody.
  ELSIF v_audience = 'all_parents' THEN
    INSERT INTO notifications (academy_id, announcement_id, recipient_user_id, title, message, notification_type, metadata)
    SELECT a.academy_id, a.id, user_id, a.title, a.message, 'announcement',
           jsonb_build_object('announcement_id', a.id)
    FROM academy_members
    WHERE academy_id = a.academy_id AND status = 'active' AND user_id IS NOT NULL
      AND role::text = 'parent'
    ON CONFLICT DO NOTHING;

  ELSIF v_audience = 'batch' AND a.batch_id IS NOT NULL THEN
    INSERT INTO notifications (academy_id, announcement_id, recipient_user_id, title, message, notification_type, metadata)
    SELECT a.academy_id, a.id, recipient, a.title, a.message, 'announcement',
           jsonb_build_object('announcement_id', a.id, 'batch_id', a.batch_id)
    FROM (
      SELECT am.user_id AS recipient
      FROM batch_members bm
      JOIN academy_members am ON am.id = bm.academy_member_id
      WHERE bm.batch_id = a.batch_id AND am.user_id IS NOT NULL
      UNION
      SELECT am.user_id
      FROM batches b
      JOIN academy_members am ON am.id = b.coach_id
      WHERE b.id = a.batch_id AND am.user_id IS NOT NULL
      UNION
      -- Defect 2: parents who could read it but were never told.
      SELECT ppl.parent_user_id
      FROM batch_members bm
      JOIN academy_members am ON am.id = bm.academy_member_id
      JOIN parent_player_links ppl
        ON ppl.player_user_id = am.user_id
       AND ppl.academy_id = a.academy_id
       AND ppl.status = 'active'
      WHERE bm.batch_id = a.batch_id
    ) recipients
    ON CONFLICT DO NOTHING;

  ELSIF v_audience = 'custom' THEN
    INSERT INTO notifications (academy_id, announcement_id, recipient_user_id, title, message, notification_type, metadata)
    SELECT a.academy_id, a.id, recipient, a.title, a.message, 'announcement',
           jsonb_build_object('announcement_id', a.id)
    FROM (
      -- players in any targeted batch
      SELECT am.user_id AS recipient
      FROM announcement_targets t
      JOIN batch_members bm ON bm.batch_id = t.batch_id
      JOIN academy_members am ON am.id = bm.academy_member_id
      WHERE t.announcement_id = a.id AND t.batch_id IS NOT NULL AND am.user_id IS NOT NULL
      UNION
      -- the coach of any targeted batch
      SELECT am.user_id
      FROM announcement_targets t
      JOIN batches b ON b.id = t.batch_id
      JOIN academy_members am ON am.id = b.coach_id
      WHERE t.announcement_id = a.id AND t.batch_id IS NOT NULL AND am.user_id IS NOT NULL
      UNION
      -- parents of players in any targeted batch
      SELECT ppl.parent_user_id
      FROM announcement_targets t
      JOIN batch_members bm ON bm.batch_id = t.batch_id
      JOIN academy_members am ON am.id = bm.academy_member_id
      JOIN parent_player_links ppl
        ON ppl.player_user_id = am.user_id
       AND ppl.academy_id = a.academy_id
       AND ppl.status = 'active'
      WHERE t.announcement_id = a.id AND t.batch_id IS NOT NULL
      UNION
      -- people named individually
      SELECT am.user_id
      FROM announcement_targets t
      JOIN academy_members am ON am.id = t.academy_member_id
      WHERE t.announcement_id = a.id AND t.academy_member_id IS NOT NULL AND am.user_id IS NOT NULL
      UNION
      -- parents of people named individually
      SELECT ppl.parent_user_id
      FROM announcement_targets t
      JOIN academy_members am ON am.id = t.academy_member_id
      JOIN parent_player_links ppl
        ON ppl.player_user_id = am.user_id
       AND ppl.academy_id = a.academy_id
       AND ppl.status = 'active'
      WHERE t.announcement_id = a.id AND t.academy_member_id IS NOT NULL
    ) recipients
    ON CONFLICT DO NOTHING;
  END IF;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- Trigger keeps the old behaviour for every non-custom audience: fan out the
-- moment the row lands. A `custom` announcement has no targets yet at INSERT
-- time, so the RPC fans it out after writing them.
CREATE OR REPLACE FUNCTION fanout_announcement_notifications() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM fanout_announcement(new.id);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_announcement_created ON announcements;
CREATE TRIGGER on_announcement_created
  AFTER INSERT ON announcements
  FOR EACH ROW
  WHEN (new.audience::text <> 'custom')
  EXECUTE FUNCTION fanout_announcement_notifications();

-- ------------------------------------------------------------------- write ------
CREATE OR REPLACE FUNCTION create_announcement_with_targets(
  p_academy_id uuid,
  p_title text,
  p_message text,
  p_audience text,
  p_batch_id uuid default null,
  p_batch_ids uuid[] default '{}',
  p_member_ids uuid[] default '{}'
) RETURNS announcements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_announcement announcements;
BEGIN
  IF NOT is_staff(p_academy_id) THEN
    RAISE EXCEPTION 'E_FORBIDDEN' USING errcode = '42501';
  END IF;

  IF btrim(coalesce(p_title, '')) = '' OR btrim(coalesce(p_message, '')) = '' THEN
    RAISE EXCEPTION 'E_VALIDATION: title and message are required' USING errcode = '22023';
  END IF;

  IF p_audience = 'custom'
     AND coalesce(array_length(p_batch_ids, 1), 0) = 0
     AND coalesce(array_length(p_member_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'E_VALIDATION: pick at least one batch or person' USING errcode = '22023';
  END IF;

  INSERT INTO announcements (academy_id, created_by, title, message, audience, batch_id)
  VALUES (
    p_academy_id, auth.uid(), btrim(p_title), btrim(p_message),
    p_audience::audience_type,
    CASE WHEN p_audience = 'batch' THEN p_batch_id ELSE NULL END
  )
  RETURNING * INTO v_announcement;

  IF p_audience = 'custom' THEN
    -- Only batches and members belonging to this academy: the ids arrive from a
    -- client and must never let one academy address another's people.
    INSERT INTO announcement_targets (announcement_id, academy_id, batch_id)
    SELECT v_announcement.id, p_academy_id, b.id
    FROM batches b
    WHERE b.id = ANY (p_batch_ids) AND b.academy_id = p_academy_id
    ON CONFLICT DO NOTHING;

    INSERT INTO announcement_targets (announcement_id, academy_id, academy_member_id)
    SELECT v_announcement.id, p_academy_id, m.id
    FROM academy_members m
    WHERE m.id = ANY (p_member_ids) AND m.academy_id = p_academy_id AND m.status = 'active'
    ON CONFLICT DO NOTHING;

    IF NOT EXISTS (SELECT 1 FROM announcement_targets WHERE announcement_id = v_announcement.id) THEN
      RAISE EXCEPTION 'E_VALIDATION: none of those batches or people belong to this academy'
        USING errcode = '22023';
    END IF;

    PERFORM fanout_announcement(v_announcement.id);
  END IF;

  RETURN v_announcement;
END;
$$;

REVOKE ALL ON FUNCTION fanout_announcement(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_announcement_with_targets(uuid, text, text, text, uuid, uuid[], uuid[]) TO authenticated;

-- ---------------------------------------------------------------- reads ---------
-- Extends the 0044 policy so someone targeted by a custom announcement can read
-- it. Every other branch is carried over unchanged.
DROP POLICY IF EXISTS announcements_select ON announcements;
CREATE POLICY announcements_select ON announcements FOR SELECT USING (
  is_staff(academy_id) OR is_super_admin()
  OR (
    is_member(academy_id) AND (
      audience::text = 'all'
      OR (audience::text = 'players' AND has_role(academy_id, ARRAY['player']::app_role[]))
      OR (audience::text = 'all_parents' AND has_role(academy_id, ARRAY['parent']::app_role[]))
      OR (audience::text = 'batch' AND (
        EXISTS (
          SELECT 1 FROM batch_members bm
          JOIN academy_members am ON bm.academy_member_id = am.id
          WHERE bm.batch_id = announcements.batch_id AND am.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM batch_members bm
          JOIN academy_members am ON bm.academy_member_id = am.id
          JOIN parent_player_links ppl ON ppl.player_user_id = am.user_id
          WHERE bm.batch_id = announcements.batch_id
            AND ppl.parent_user_id = auth.uid()
            AND ppl.academy_id = announcements.academy_id
        )
      ))
      OR (audience::text = 'custom' AND (
        EXISTS (
          SELECT 1 FROM announcement_targets t
          JOIN academy_members am ON am.id = t.academy_member_id
          WHERE t.announcement_id = announcements.id AND am.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM announcement_targets t
          JOIN batch_members bm ON bm.batch_id = t.batch_id
          JOIN academy_members am ON am.id = bm.academy_member_id
          WHERE t.announcement_id = announcements.id AND am.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM announcement_targets t
          JOIN batch_members bm ON bm.batch_id = t.batch_id
          JOIN academy_members am ON am.id = bm.academy_member_id
          JOIN parent_player_links ppl
            ON ppl.player_user_id = am.user_id
           AND ppl.academy_id = announcements.academy_id
           AND ppl.status = 'active'
          WHERE t.announcement_id = announcements.id AND ppl.parent_user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM announcement_targets t
          JOIN academy_members am ON am.id = t.academy_member_id
          JOIN parent_player_links ppl
            ON ppl.player_user_id = am.user_id
           AND ppl.academy_id = announcements.academy_id
           AND ppl.status = 'active'
          WHERE t.announcement_id = announcements.id AND ppl.parent_user_id = auth.uid()
        )
      ))
    )
  )
);
