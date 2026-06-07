-- Persist PDF highlight annotations per note attachment (idempotent)
ALTER TABLE note_attachments
  ADD COLUMN IF NOT EXISTS pdf_annotations JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN note_attachments.pdf_annotations IS
  'Saved PDF text highlights: [{ id, page, color, rects[], text?, createdAt }]';

NOTIFY pgrst, 'reload schema';