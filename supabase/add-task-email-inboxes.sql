-- ============================================
-- Task email inboxes (Brevo inbound → tasks)
-- Run in Supabase SQL Editor (idempotent)
-- ============================================

CREATE TABLE IF NOT EXISTS task_email_inboxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  local_part TEXT NOT NULL,
  label TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT task_email_inboxes_local_part_unique UNIQUE (local_part),
  CONSTRAINT task_email_inboxes_workspace_unique UNIQUE (workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_task_email_inboxes_workspace
  ON task_email_inboxes (workspace_id);

ALTER TABLE task_email_inboxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access task email inboxes" ON task_email_inboxes;
CREATE POLICY "Workspace members can access task email inboxes" ON task_email_inboxes
  FOR ALL USING (
    is_workspace_member(workspace_id, auth.uid())
  )
  WITH CHECK (
    is_workspace_member(workspace_id, auth.uid())
  );

DROP TRIGGER IF EXISTS update_task_email_inboxes_updated_at ON task_email_inboxes;
CREATE TRIGGER update_task_email_inboxes_updated_at
  BEFORE UPDATE ON task_email_inboxes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE task_email_inboxes IS 'Inbound email addresses mapped to a workspace for Brevo task creation webhooks.';
COMMENT ON COLUMN task_email_inboxes.local_part IS 'Mailbox local-part before @inbound domain, e.g. t-a1b2c3d4-x9y8z7w6';

-- Extend inbound idempotency table for task webhooks
ALTER TABLE inbound_email_events
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

ALTER TABLE inbound_email_events
  ADD COLUMN IF NOT EXISTS task_inbox_id UUID REFERENCES task_email_inboxes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inbound_email_events_task_inbox
  ON inbound_email_events (task_inbox_id);