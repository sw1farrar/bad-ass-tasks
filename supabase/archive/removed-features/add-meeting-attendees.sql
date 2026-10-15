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

-- Freeform meeting attendee names (not limited to workspace member UUIDs).
-- Run in Supabase SQL editor after deploying the app update.

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS attendees TEXT[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
