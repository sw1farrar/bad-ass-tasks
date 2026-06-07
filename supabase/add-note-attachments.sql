-- ============================================
-- Note attachments (email + manual upload) + Storage bucket
-- Run in Supabase SQL Editor (idempotent)
-- ============================================

CREATE TABLE IF NOT EXISTS note_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('email', 'upload')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_attachments_note ON note_attachments (note_id);
CREATE INDEX IF NOT EXISTS idx_note_attachments_workspace ON note_attachments (workspace_id);

ALTER TABLE note_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access note attachments" ON note_attachments;
CREATE POLICY "Workspace members can access note attachments" ON note_attachments
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

COMMENT ON TABLE note_attachments IS 'Files attached to notes (from inbound email or manual upload).';

-- Idempotency + audit for inbound email webhooks
CREATE TABLE IF NOT EXISTS inbound_email_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id TEXT NOT NULL,
  inbox_id UUID REFERENCES note_email_inboxes(id) ON DELETE SET NULL,
  note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  local_part TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inbound_email_events_message_id_unique UNIQUE (message_id)
);

CREATE INDEX IF NOT EXISTS idx_inbound_email_events_inbox ON inbound_email_events (inbox_id);

ALTER TABLE inbound_email_events ENABLE ROW LEVEL SECURITY;

-- Service role only for inbound events (no client access)
DROP POLICY IF EXISTS "No direct client access to inbound email events" ON inbound_email_events;
CREATE POLICY "No direct client access to inbound email events" ON inbound_email_events
  FOR ALL USING (false);

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('note-attachments', 'note-attachments', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: workspace members can read/write paths under their workspace_id prefix
DROP POLICY IF EXISTS "Workspace members read note attachments" ON storage.objects;
CREATE POLICY "Workspace members read note attachments" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'note-attachments'
    AND is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "Workspace members upload note attachments" ON storage.objects;
CREATE POLICY "Workspace members upload note attachments" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'note-attachments'
    AND is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "Workspace members delete note attachments" ON storage.objects;
CREATE POLICY "Workspace members delete note attachments" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'note-attachments'
    AND is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

NOTIFY pgrst, 'reload schema';