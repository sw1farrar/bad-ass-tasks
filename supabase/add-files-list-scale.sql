-- ============================================
-- Files list scale: slim search hits + aggregated attachment counts
-- Safe to re-run (idempotent).
--
-- Prerequisites (run first if missing):
--   supabase/add-note-attachments.sql
--   supabase/add-files-review-workflow.sql
-- ============================================

-- Columns required by search_workspace_files_slim (no-op if already applied)
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'filed',
  ADD COLUMN IF NOT EXISTS filed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS search_document TEXT;

-- ------------------------------------------------------------------
-- Aggregated attachment counts per workspace (GROUP BY in SQL)
-- Skipped gracefully when note_attachments has not been migrated yet.
-- ------------------------------------------------------------------
DO $scale$
BEGIN
  IF to_regclass('public.note_attachments') IS NULL THEN
    RAISE NOTICE 'Skipping note_attachment_counts_by_workspace: run add-note-attachments.sql first.';
  ELSE
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.note_attachment_counts_by_workspace(p_workspace_id UUID)
      RETURNS TABLE(note_id UUID, attachment_count BIGINT)
      LANGUAGE sql
      STABLE
      SECURITY INVOKER
      SET search_path = public
      AS $body$
        SELECT na.note_id, COUNT(*)::BIGINT AS attachment_count
        FROM public.note_attachments na
        WHERE na.workspace_id = p_workspace_id
        GROUP BY na.note_id;
      $body$;
    $fn$;

    EXECUTE 'GRANT EXECUTE ON FUNCTION public.note_attachment_counts_by_workspace(UUID) TO authenticated';
  END IF;
END
$scale$;

-- ------------------------------------------------------------------
-- Slim file search: ids + relevance only (no heavy note bodies)
-- Uses search_rank instead of rank (rank is a reserved keyword in PostgreSQL).
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_workspace_files_slim(
  p_workspace_id UUID,
  p_query TEXT,
  p_include_pending BOOLEAN DEFAULT FALSE,
  p_limit INT DEFAULT 100
)
RETURNS TABLE(id UUID, search_rank REAL)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    n.id,
    CASE
      WHEN p_query IS NOT NULL AND trim(p_query) <> '' THEN
        ts_rank(
          to_tsvector('english', coalesce(n.search_document, '')),
          plainto_tsquery('english', p_query)
        )
      ELSE 0::REAL
    END AS search_rank
  FROM public.notes n
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
    search_rank DESC,
    n.filed_at DESC NULLS LAST,
    n.updated_at DESC
  LIMIT greatest(1, least(p_limit, 200));
$$;

GRANT EXECUTE ON FUNCTION public.search_workspace_files_slim(UUID, TEXT, BOOLEAN, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Quick verification (read results in SQL Editor)
SELECT
  to_regclass('public.note_attachments') IS NOT NULL AS note_attachments_ready,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'note_attachment_counts_by_workspace'
  ) AS attachment_counts_rpc_ready,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'search_workspace_files_slim'
  ) AS slim_search_rpc_ready;