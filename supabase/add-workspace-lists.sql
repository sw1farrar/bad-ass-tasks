-- ============================================
-- Workspace Lists (checklist cards + items)
-- Run in Supabase SQL Editor (idempotent)
-- ============================================

CREATE TABLE IF NOT EXISTS workspace_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'default',
  sort_order INTEGER NOT NULL DEFAULT 0,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES workspace_lists(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_lists_ws_sort
  ON workspace_lists (workspace_id, pinned DESC, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_list_items_list_sort
  ON list_items (list_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_list_items_workspace
  ON list_items (workspace_id);

ALTER TABLE workspace_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access lists" ON workspace_lists;
CREATE POLICY "Workspace members can access lists" ON workspace_lists
  FOR ALL USING (
    is_workspace_member(workspace_id, auth.uid())
  )
  WITH CHECK (
    is_workspace_member(workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS "Workspace members can access list items" ON list_items;
CREATE POLICY "Workspace members can access list items" ON list_items
  FOR ALL USING (
    is_workspace_member(workspace_id, auth.uid())
  )
  WITH CHECK (
    is_workspace_member(workspace_id, auth.uid())
  );

DROP TRIGGER IF EXISTS update_workspace_lists_updated_at ON workspace_lists;
CREATE TRIGGER update_workspace_lists_updated_at
  BEFORE UPDATE ON workspace_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_list_items_updated_at ON list_items;
CREATE TRIGGER update_list_items_updated_at
  BEFORE UPDATE ON list_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE workspace_lists IS 'Keep-style checklist cards per workspace (title, color, pin, sort).';
COMMENT ON TABLE list_items IS 'Checklist rows belonging to a workspace list.';

-- Realtime (optional; safe to re-run — ignore duplicate errors)
-- ALTER PUBLICATION supabase_realtime ADD TABLE workspace_lists, list_items;

-- Refresh PostgREST schema cache so REST API sees the new tables immediately
NOTIFY pgrst, 'reload schema';