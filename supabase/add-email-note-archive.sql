-- ============================================
-- Email note archive + search (Phase 2)
-- Run in Supabase SQL Editor (idempotent)
-- ============================================

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS raw_html TEXT,
  ADD COLUMN IF NOT EXISTS email_source TEXT,
  ADD COLUMN IF NOT EXISTS search_plain TEXT,
  ADD COLUMN IF NOT EXISTS email_pipeline_version INTEGER;

COMMENT ON COLUMN notes.raw_html IS 'Original inbound HTML before TipTap conversion (for re-render).';
COMMENT ON COLUMN notes.email_source IS 'Storage path to archived .eml or brevo:messageId fallback.';
COMMENT ON COLUMN notes.search_plain IS 'Denormalized plain text for note search (includes email body).';
COMMENT ON COLUMN notes.email_pipeline_version IS 'Inbound HTML pipeline version at ingest time.';

CREATE INDEX IF NOT EXISTS idx_notes_search_plain ON notes USING gin (to_tsvector('english', coalesce(search_plain, '')));

ALTER TABLE note_attachments
  ADD COLUMN IF NOT EXISTS content_id TEXT;

COMMENT ON COLUMN note_attachments.content_id IS 'MIME Content-ID for inline CID image resolution.';

-- Backfill search_plain for existing from-email notes (title + extracted TipTap text)
UPDATE notes n
SET search_plain = trim(
  coalesce(n.title, '') || ' ' ||
  coalesce(
    (
      SELECT string_agg(elem->>'text', ' ')
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(n.content) = 'object' AND n.content ? 'content'
            THEN n.content->'content'
          ELSE '[]'::jsonb
        END
      ) AS elem
      WHERE elem->>'text' IS NOT NULL
    ),
    ''
  )
)
WHERE n.search_plain IS NULL
  AND 'from-email' = ANY (n.tags);

NOTIFY pgrst, 'reload schema';