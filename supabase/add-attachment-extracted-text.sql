-- ============================================
-- Attachment extracted text (PDF search indexing)
-- Run in Supabase SQL Editor (idempotent, optional)
-- ============================================

ALTER TABLE note_attachments
  ADD COLUMN IF NOT EXISTS extracted_text TEXT;

COMMENT ON COLUMN note_attachments.extracted_text IS 'Plain text extracted from PDF (and future OCR) for file search.';

NOTIFY pgrst, 'reload schema';