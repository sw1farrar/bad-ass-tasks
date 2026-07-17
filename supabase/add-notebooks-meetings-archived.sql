-- Archive support for notebooks and meetings.

ALTER TABLE notebooks
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_notebooks_workspace_active
  ON notebooks (workspace_id, archived)
  WHERE archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_meetings_workspace_active
  ON meetings (workspace_id, archived)
  WHERE archived = FALSE;

NOTIFY pgrst, 'reload schema';
