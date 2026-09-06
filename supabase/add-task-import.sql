-- Task import batches + pending-review columns (Toodledo and future platforms)

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS import_status TEXT;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS import_batch_id UUID;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS import_source TEXT;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS import_fingerprint TEXT;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_import_status_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_import_status_check
  CHECK (import_status IS NULL OR import_status = 'pending_review');

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_import_fingerprint
  ON tasks (workspace_id, import_fingerprint)
  WHERE import_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_import_pending
  ON tasks (workspace_id)
  WHERE import_status = 'pending_review';

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status_completed
  ON tasks (workspace_id, completed_at DESC)
  WHERE status = 'done';

CREATE TABLE IF NOT EXISTS task_import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'importing',
  current_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  filenames TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (status IN ('importing', 'ready', 'reviewing', 'complete'))
);

CREATE INDEX IF NOT EXISTS idx_task_import_batches_workspace
  ON task_import_batches (workspace_id, created_at DESC);

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_import_batch_id_fkey;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_import_batch_id_fkey
  FOREIGN KEY (import_batch_id) REFERENCES task_import_batches(id) ON DELETE SET NULL;

ALTER TABLE task_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access import batches" ON task_import_batches;
CREATE POLICY "Workspace members can access import batches" ON task_import_batches
  FOR ALL USING (
    is_workspace_member(workspace_id, auth.uid())
  )
  WITH CHECK (
    is_workspace_member(workspace_id, auth.uid())
  );

DROP TRIGGER IF EXISTS update_task_import_batches_updated_at ON task_import_batches;
CREATE TRIGGER update_task_import_batches_updated_at
  BEFORE UPDATE ON task_import_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

NOTIFY pgrst, 'reload schema';
