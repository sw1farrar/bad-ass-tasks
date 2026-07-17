-- Notebook tasks can optionally appear on the workspace Tasks page.
-- Also enable realtime so completion syncs instantly across clients.

ALTER TABLE notebook_tasks
  ADD COLUMN IF NOT EXISTS show_on_workspace BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_notebook_tasks_workspace_visible
  ON notebook_tasks (workspace_id, show_on_workspace)
  WHERE show_on_workspace = TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notebook_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notebook_tasks;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
