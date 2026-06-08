-- ============================================
-- Note email inboxes (Brevo inbound → Files Review queue)
-- Prefer migrate-note-inbox-one-per-workspace.sql on existing DBs for one-per-workspace constraint.
-- Run in Supabase SQL Editor (idempotent)
-- ============================================

CREATE TABLE IF NOT EXISTS note_email_inboxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  local_part TEXT NOT NULL,
  label TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT note_email_inboxes_local_part_unique UNIQUE (local_part)
);

CREATE INDEX IF NOT EXISTS idx_note_email_inboxes_workspace
  ON note_email_inboxes (workspace_id);

CREATE INDEX IF NOT EXISTS idx_note_email_inboxes_parent
  ON note_email_inboxes (parent_note_id)
  WHERE parent_note_id IS NOT NULL;

ALTER TABLE note_email_inboxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access note email inboxes" ON note_email_inboxes;
CREATE POLICY "Workspace members can access note email inboxes" ON note_email_inboxes
  FOR ALL USING (
    is_workspace_member(workspace_id, auth.uid())
  )
  WITH CHECK (
    is_workspace_member(workspace_id, auth.uid())
  );

DROP TRIGGER IF EXISTS update_note_email_inboxes_updated_at ON note_email_inboxes;
CREATE TRIGGER update_note_email_inboxes_updated_at
  BEFORE UPDATE ON note_email_inboxes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE note_email_inboxes IS 'Inbound email addresses mapped to a workspace for Brevo file intake (Files Review queue).';
COMMENT ON COLUMN note_email_inboxes.local_part IS 'Mailbox local-part before @inbound domain, e.g. n-a1b2c3d4-x9y8z7w6';