-- ============================================
-- One files-review email per workspace
-- Run in Supabase SQL Editor (idempotent)
-- ============================================
-- Replaces per-note/per-sub-note inboxes with a single workspace address
-- that routes inbound email to Files → Review.

-- Clear legacy parent links (intake is workspace-level, not nested under a file)
UPDATE note_email_inboxes
SET parent_note_id = NULL
WHERE parent_note_id IS NOT NULL;

-- Keep the oldest inbox per workspace; remove extras from the old per-note model
DELETE FROM note_email_inboxes a
USING note_email_inboxes b
WHERE a.workspace_id = b.workspace_id
  AND a.created_at > b.created_at;

-- Enforce one inbox row per workspace (matches task_email_inboxes pattern)
ALTER TABLE note_email_inboxes
  DROP CONSTRAINT IF EXISTS note_email_inboxes_workspace_unique;

ALTER TABLE note_email_inboxes
  ADD CONSTRAINT note_email_inboxes_workspace_unique UNIQUE (workspace_id);

COMMENT ON TABLE note_email_inboxes IS 'One inbound email address per workspace; emails land in Files Review queue.';

NOTIFY pgrst, 'reload schema';