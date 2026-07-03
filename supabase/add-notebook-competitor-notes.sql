-- Competitor notes (timestamped research notes per competitor)
-- Run in Supabase SQL editor after add-notebook-sections.sql

CREATE TABLE IF NOT EXISTS notebook_competitor_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competitor_id UUID NOT NULL REFERENCES notebook_competitors(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebook_competitor_notes_competitor
  ON notebook_competitor_notes(competitor_id);

ALTER TABLE notebook_competitor_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access notebook_competitor_notes" ON notebook_competitor_notes;
CREATE POLICY "Workspace members can access notebook_competitor_notes" ON notebook_competitor_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notebook_competitors c
      WHERE c.id = competitor_id AND is_workspace_member(c.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notebook_competitors c
      WHERE c.id = competitor_id AND is_workspace_member(c.workspace_id, auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';