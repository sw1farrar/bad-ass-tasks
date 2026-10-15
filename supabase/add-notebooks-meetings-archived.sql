-- Archive support for notebooks.
-- The meetings.archived column and idx_meetings_workspace_active used to live in this
-- script. Meetings were removed from the app; do not recreate those objects here.
-- Live meeting tables are left in place. Dropping them is a separate approval.

ALTER TABLE notebooks
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_notebooks_workspace_active
  ON notebooks (workspace_id, archived)
  WHERE archived = FALSE;

NOTIFY pgrst, 'reload schema';
