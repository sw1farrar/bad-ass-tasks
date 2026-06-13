-- Task importance + folder grouping
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS folder_id UUID;

CREATE TABLE IF NOT EXISTS task_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_folders_workspace ON task_folders(workspace_id);

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_folder_id_fkey;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_folder_id_fkey
  FOREIGN KEY (folder_id) REFERENCES task_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_starred ON tasks(workspace_id, starred) WHERE starred = TRUE;
CREATE INDEX IF NOT EXISTS idx_tasks_folder_id ON tasks(folder_id) WHERE folder_id IS NOT NULL;

ALTER TABLE task_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access task folders" ON task_folders;
CREATE POLICY "Workspace members can access task folders" ON task_folders
  FOR ALL USING (
    is_workspace_member(workspace_id, auth.uid())
  )
  WITH CHECK (
    is_workspace_member(workspace_id, auth.uid())
  );

DROP TRIGGER IF EXISTS update_task_folders_updated_at ON task_folders;
CREATE TRIGGER update_task_folders_updated_at
  BEFORE UPDATE ON task_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

NOTIFY pgrst, 'reload schema';