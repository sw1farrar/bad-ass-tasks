-- Notebook tasks (checklist + timestamped progress notes).
-- Run in Supabase SQL editor after add-notebooks.sql.
--
-- Superseded 2026-10-15: Investments, Customers, Competitors, and notebooks.our_sales
-- were removed from the application. This script no longer creates those tables or
-- the our_sales column. Historical DDL is in supabase/archive/removed-features/.
-- Do not reintroduce them here. Dropping the live tables is a separate, later step.

-- ---------------------------------------------------------------------------
-- Tasks (simple checklist + timestamped progress notes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notebook_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebook_tasks_notebook ON notebook_tasks(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notebook_tasks_workspace ON notebook_tasks(workspace_id);

CREATE TABLE IF NOT EXISTS notebook_task_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES notebook_tasks(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebook_task_progress_task ON notebook_task_progress(task_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE notebook_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_task_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access notebook_tasks" ON notebook_tasks;
CREATE POLICY "Workspace members can access notebook_tasks" ON notebook_tasks
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can access notebook_task_progress" ON notebook_task_progress;
CREATE POLICY "Workspace members can access notebook_task_progress" ON notebook_task_progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notebook_tasks t
      WHERE t.id = task_id AND is_workspace_member(t.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notebook_tasks t
      WHERE t.id = task_id AND is_workspace_member(t.workspace_id, auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_notebook_tasks_updated_at ON notebook_tasks;
CREATE TRIGGER update_notebook_tasks_updated_at
  BEFORE UPDATE ON notebook_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

NOTIFY pgrst, 'reload schema';
