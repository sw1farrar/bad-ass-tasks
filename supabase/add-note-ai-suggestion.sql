-- Pending AI review suggestions stored on the note (no separate table).
-- status lives inside JSON: pending | ready | failed | approved | rejected

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS ai_suggestion JSONB;

COMMENT ON COLUMN notes.ai_suggestion IS
  'Ephemeral AI filing suggestion for pending_review notes (title, tags, memo, receipt line items). Cleared on reject or after filing.';