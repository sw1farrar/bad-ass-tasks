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
