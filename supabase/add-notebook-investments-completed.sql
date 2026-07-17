-- Allow notebook investments to be checked off / completed.

ALTER TABLE notebook_investments
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE notebook_investments
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notebook_investments_workspace_open
  ON notebook_investments (workspace_id, completed)
  WHERE completed = FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notebook_investments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notebook_investments;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
