-- Task folders: RLS policies (required for client upsert/insert)
-- Run in Supabase SQL Editor after add-task-starred-folders.sql (idempotent)

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

-- Realtime (optional; safe to re-run — ignore duplicate errors)
-- ALTER PUBLICATION supabase_realtime ADD TABLE task_folders;

NOTIFY pgrst, 'reload schema';