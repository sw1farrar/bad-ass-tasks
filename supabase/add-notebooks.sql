-- Notebooks workspace feature: containers for rich-text notes (distinct from Files).
-- Run in Supabase SQL editor after deploying the app update.

CREATE TABLE IF NOT EXISTS notebooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebooks_workspace ON notebooks(workspace_id);

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS notebook_id UUID;

ALTER TABLE notes
  DROP CONSTRAINT IF EXISTS notes_notebook_id_fkey;

ALTER TABLE notes
  ADD CONSTRAINT notes_notebook_id_fkey
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notes_notebook ON notes(notebook_id) WHERE notebook_id IS NOT NULL;

ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access notebooks" ON notebooks;
CREATE POLICY "Workspace members can access notebooks" ON notebooks
  FOR ALL USING (
    is_workspace_member(workspace_id, auth.uid())
  )
  WITH CHECK (
    is_workspace_member(workspace_id, auth.uid())
  );

DROP TRIGGER IF EXISTS update_notebooks_updated_at ON notebooks;
CREATE TRIGGER update_notebooks_updated_at
  BEFORE UPDATE ON notebooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

NOTIFY pgrst, 'reload schema';