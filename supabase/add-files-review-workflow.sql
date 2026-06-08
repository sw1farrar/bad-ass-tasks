-- ============================================
-- Files workflow: review queue + search index
-- Run in Supabase SQL Editor (idempotent)
-- ============================================

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'filed',
  ADD COLUMN IF NOT EXISTS record_type TEXT NOT NULL DEFAULT 'note',
  ADD COLUMN IF NOT EXISTS memo TEXT,
  ADD COLUMN IF NOT EXISTS filed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS search_document TEXT;

ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_review_status_check;
ALTER TABLE notes
  ADD CONSTRAINT notes_review_status_check
  CHECK (review_status IN ('pending_review', 'filed'));

ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_record_type_check;
ALTER TABLE notes
  ADD CONSTRAINT notes_record_type_check
  CHECK (record_type IN ('note', 'email', 'document', 'receipt', 'other'));

COMMENT ON COLUMN notes.review_status IS 'pending_review = triage queue; filed = approved library.';
COMMENT ON COLUMN notes.record_type IS 'File kind: note, email, document, receipt, other.';
COMMENT ON COLUMN notes.memo IS 'Short triage memo set during Review approve.';
COMMENT ON COLUMN notes.filed_at IS 'When the record was approved into the filed library.';
COMMENT ON COLUMN notes.reviewed_by IS 'User who approved the record from Review.';
COMMENT ON COLUMN notes.search_document IS 'Denormalized FTS text: title, body, tags, memo, attachment names.';

-- Existing rows: treat as already filed
UPDATE notes
SET review_status = 'filed'
WHERE review_status IS DISTINCT FROM 'pending_review'
  AND review_status IS DISTINCT FROM 'filed';

UPDATE notes
SET filed_at = COALESCE(filed_at, updated_at, created_at, now())
WHERE review_status = 'filed'
  AND filed_at IS NULL;

UPDATE notes
SET record_type = 'email'
WHERE 'from-email' = ANY (tags)
  AND (record_type IS NULL OR record_type = 'note');

-- Build search_document from known fields
UPDATE notes n
SET search_document = trim(
  coalesce(n.title, '') || ' ' ||
  coalesce(n.search_plain, '') || ' ' ||
  coalesce(n.memo, '') || ' ' ||
  coalesce(array_to_string(n.tags, ' '), '')
)
WHERE n.search_document IS NULL OR trim(n.search_document) = '';

-- Attachment filenames into search_document (best-effort backfill)
UPDATE notes n
SET search_document = trim(
  coalesce(n.search_document, '') || ' ' ||
  coalesce((
    SELECT string_agg(a.file_name, ' ')
    FROM note_attachments a
    WHERE a.note_id = n.id
  ), '')
)
WHERE EXISTS (SELECT 1 FROM note_attachments a WHERE a.note_id = n.id);

CREATE INDEX IF NOT EXISTS idx_notes_workspace_review
  ON notes (workspace_id, review_status);

CREATE INDEX IF NOT EXISTS idx_notes_filed_at
  ON notes (workspace_id, filed_at DESC NULLS LAST)
  WHERE review_status = 'filed';

CREATE INDEX IF NOT EXISTS idx_notes_search_document
  ON notes USING gin (to_tsvector('english', coalesce(search_document, '')));

-- Workspace-scoped file search (FTS + title fallback)
CREATE OR REPLACE FUNCTION search_workspace_files(
  p_workspace_id UUID,
  p_query TEXT,
  p_include_pending BOOLEAN DEFAULT FALSE,
  p_limit INT DEFAULT 100
)
RETURNS SETOF notes
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT n.*
  FROM notes n
  WHERE n.workspace_id = p_workspace_id
    AND n.is_archived = false
    AND (p_include_pending OR n.review_status = 'filed')
    AND (
      p_query IS NULL
      OR trim(p_query) = ''
      OR to_tsvector('english', coalesce(n.search_document, '')) @@ plainto_tsquery('english', p_query)
      OR n.title ILIKE '%' || replace(trim(p_query), '%', '\%') || '%'
      OR coalesce(n.search_document, '') ILIKE '%' || replace(trim(p_query), '%', '\%') || '%'
    )
  ORDER BY
    CASE
      WHEN p_query IS NOT NULL AND trim(p_query) <> '' THEN
        ts_rank(
          to_tsvector('english', coalesce(n.search_document, '')),
          plainto_tsquery('english', p_query)
        )
      ELSE 0
    END DESC,
    n.filed_at DESC NULLS LAST,
    n.updated_at DESC
  LIMIT greatest(1, least(p_limit, 200));
$$;

GRANT EXECUTE ON FUNCTION search_workspace_files(UUID, TEXT, BOOLEAN, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';