-- SUPERSEDED 2026-10-15. Do not apply.
-- Meetings were removed from the app.
-- Applying this file would recreate objects the application no longer uses.
-- Live tables are intentionally left in place; dropping them is a separate approval.
-- The original statements remain below this guard for a future rollback only.
DO $$
BEGIN
  RAISE EXCEPTION 'superseded script: do not apply. See supabase/archive/removed-features/README.md';
END
$$;

-- Persist reviewed state independently of agenda status so completing/reopening
-- a topic does not lose whether it was reviewed for carry-forward.
ALTER TABLE meeting_agenda_items
  ADD COLUMN IF NOT EXISTS reviewed BOOLEAN NOT NULL DEFAULT false;

-- Backfill from existing deferred/continued topics
UPDATE meeting_agenda_items
SET reviewed = true
WHERE status = 'continued' AND reviewed = false;

NOTIFY pgrst, 'reload schema';
