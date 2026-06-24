-- Timestamped notes on notebook investments (like task progress / customer notes).
-- Run in Supabase SQL Editor after add-notebook-sections.sql.

CREATE TABLE IF NOT EXISTS notebook_investment_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investment_id UUID NOT NULL REFERENCES notebook_investments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebook_investment_notes_investment
  ON notebook_investment_notes(investment_id);

ALTER TABLE notebook_investment_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access notebook_investment_notes" ON notebook_investment_notes;
CREATE POLICY "Workspace members can access notebook_investment_notes" ON notebook_investment_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notebook_investments i
      WHERE i.id = investment_id AND is_workspace_member(i.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notebook_investments i
      WHERE i.id = investment_id AND is_workspace_member(i.workspace_id, auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';