-- Archive flag for workspace checklist lists (hide from main Lists board)
-- Run in Supabase SQL Editor (idempotent)

ALTER TABLE workspace_lists
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_workspace_lists_ws_archived_sort
  ON workspace_lists (workspace_id, archived, pinned DESC, sort_order ASC);

COMMENT ON COLUMN workspace_lists.archived IS 'When true, list is hidden from the main Lists board until restored.';

NOTIFY pgrst, 'reload schema';