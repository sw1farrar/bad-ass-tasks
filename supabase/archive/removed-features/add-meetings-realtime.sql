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

-- One-time: enable live meeting / agenda note updates across clients.
-- Safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meetings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE meetings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meeting_agenda_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE meeting_agenda_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meeting_agenda_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE meeting_agenda_entries;
  END IF;
END $$;
