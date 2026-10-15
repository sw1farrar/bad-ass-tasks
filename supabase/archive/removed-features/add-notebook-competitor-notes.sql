-- SUPERSEDED 2026-10-15. Do not apply.
-- Map, Health, and notebook Investments/Customers/Competitors were removed from the app.
-- Applying this file would recreate objects the application no longer uses.
-- Live tables are intentionally left in place; dropping them is a separate approval.
-- The original statements remain below this guard for a future rollback only.
DO $$
BEGIN
  RAISE EXCEPTION 'superseded script: do not apply. See supabase/archive/removed-features/README.md';
END
$$;

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