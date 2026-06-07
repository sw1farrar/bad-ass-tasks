-- ============================================
-- BADAZZ TASKS — Full database inventory (read-only)
-- Run in Supabase → SQL Editor → Run
--
-- You will get MULTIPLE result tabs (one per SELECT).
-- Copy/paste ALL result tabs back for schema audit.
--
-- Safe to re-run. Does not modify anything.
-- ============================================

-- ── 0) Environment ─────────────────────────────────────────────
SELECT
  current_database() AS database_name,
  current_user AS connected_as,
  version() AS postgres_version,
  NOW() AT TIME ZONE 'UTC' AS checked_at_utc;


-- ── 1) Extensions ────────────────────────────────────────────────
SELECT
  e.extname AS extension_name,
  n.nspname AS schema_name,
  e.extversion AS version
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname IN ('uuid-ossp', 'pgcrypto', 'pg_trgm', 'vector')
   OR n.nspname = 'public'
ORDER BY e.extname;


-- ── 2) Custom types (enums) ────────────────────────────────────
SELECT
  t.typname AS type_name,
  e.enumlabel AS enum_value,
  e.enumsortorder AS sort_order
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;


-- ── 3) Tables + RLS flags ──────────────────────────────────────
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  (SELECT COUNT(*)::int
   FROM information_schema.columns col
   WHERE col.table_schema = 'public' AND col.table_name = c.relname) AS column_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;


-- ── 4) Columns (full detail) ───────────────────────────────────
SELECT
  c.table_name,
  c.column_name,
  c.ordinal_position,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;


-- ── 5) Indexes ─────────────────────────────────────────────────
SELECT
  t.relname AS table_name,
  i.relname AS index_name,
  pg_get_indexdef(ix.indexrelid) AS index_definition
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relkind = 'r'
ORDER BY t.relname, i.relname;


-- ── 6) Functions (public schema) ───────────────────────────────
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
  l.lanname AS language
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);


-- ── 7) RLS policies (public tables) ────────────────────────────
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ── 8) Triggers ────────────────────────────────────────────────
SELECT
  event_object_table AS table_name,
  trigger_name,
  action_timing,
  event_manipulation AS event,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;


-- ── 9) Realtime publication membership ─────────────────────────
SELECT
  pubname AS publication_name,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;


-- ── 10) Storage buckets ──────────────────────────────────────────
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets
ORDER BY name;


-- ── 11) Storage RLS policies ─────────────────────────────────────
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;


-- ── 12) APP EXPECTATION CHECKLIST (paste this tab first if large) ─
-- Every row should be status = 'OK'. MISSING = run migrations.
WITH expected AS (
  SELECT kind, object_name, detail FROM (VALUES
    -- Tables
    ('table', 'workspaces', NULL),
    ('table', 'workspace_members', NULL),
    ('table', 'profiles', NULL),
    ('table', 'tasks', NULL),
    ('table', 'notes', NULL),
    ('table', 'comments', NULL),
    ('table', 'workspace_messages', NULL),
    ('table', 'workspace_message_reactions', NULL),
    ('table', 'activity_logs', NULL),
    ('table', 'workspace_invites', NULL),
    ('table', 'notifications', NULL),
    ('table', 'dual_auth_challenges', NULL),
    ('table', 'workspace_lists', NULL),
    ('table', 'list_items', NULL),
    ('table', 'note_email_inboxes', NULL),
    ('table', 'task_email_inboxes', NULL),
    ('table', 'note_attachments', NULL),
    ('table', 'inbound_email_events', NULL),

    -- Critical columns
    ('column', 'notes.linked_note_ids', NULL),
    ('column', 'notes.sort_order', NULL),
    ('column', 'notes.snapshots', NULL),
    ('column', 'notes.raw_html', NULL),
    ('column', 'notes.email_source', NULL),
    ('column', 'notes.search_plain', NULL),
    ('column', 'notes.email_pipeline_version', NULL),
    ('column', 'profiles.username', NULL),
    ('column', 'profiles.location', NULL),
    ('column', 'profiles.notification_prefs', NULL),
    ('column', 'profiles.access_paused', NULL),
    ('column', 'profiles.access_paused_at', NULL),
    ('column', 'profiles.access_paused_reason', NULL),
    ('column', 'note_attachments.pdf_annotations', NULL),
    ('column', 'note_attachments.content_id', NULL),
    ('column', 'inbound_email_events.task_id', NULL),
    ('column', 'inbound_email_events.task_inbox_id', NULL),

    -- RPCs / functions used by the app
    ('function', 'is_workspace_member', NULL),
    ('function', 'create_workspace_for_user', NULL),
    ('function', 'create_workspace_invite', NULL),
    ('function', 'accept_workspace_invite', NULL),
    ('function', 'search_users_for_invite', NULL),
    ('function', 'delete_workspace_for_owner', NULL),
    ('function', 'exit_workspace', NULL),
    ('function', 'update_workspace_details', NULL),
    ('function', 'create_dual_auth_challenge_atomic', NULL),
    ('function', 'revoke_workspace_invite', NULL),
    ('function', 'decline_workspace_invite', NULL),
    ('function', 'cleanup_orphan_invite_notifications', NULL),
    ('function', 'transfer_workspace_ownership', NULL),
    ('function', 'update_member_role', NULL),
    ('function', 'update_updated_at_column', NULL),

    -- Custom enums
    ('enum', 'user_role', NULL),
    ('enum', 'task_priority', NULL),
    ('enum', 'task_status', NULL),

    -- Realtime (supabase_realtime publication)
    ('realtime', 'tasks', NULL),
    ('realtime', 'notes', NULL),
    ('realtime', 'workspace_members', NULL),
    ('realtime', 'workspace_invites', NULL),
    ('realtime', 'activity_logs', NULL),
    ('realtime', 'notifications', NULL),
    ('realtime', 'comments', NULL),
    ('realtime', 'workspace_messages', NULL),
    ('realtime', 'workspace_message_reactions', NULL),
    ('realtime', 'workspace_lists', NULL),
    ('realtime', 'list_items', NULL),

    -- Storage
    ('storage_bucket', 'note-attachments', NULL)
  ) AS v(kind, object_name, detail)
),
resolved AS (
  SELECT
    e.kind,
    e.object_name,
    CASE
      WHEN e.kind = 'table' THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM information_schema.tables t
          WHERE t.table_schema = 'public' AND t.table_name = e.object_name
        ) THEN 'OK' ELSE 'MISSING' END

      WHEN e.kind = 'column' THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = split_part(e.object_name, '.', 1)
            AND c.column_name = split_part(e.object_name, '.', 2)
        ) THEN 'OK' ELSE 'MISSING' END

      WHEN e.kind = 'function' THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = e.object_name
        ) THEN 'OK' ELSE 'MISSING' END

      WHEN e.kind = 'enum' THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typname = e.object_name AND t.typtype = 'e'
        ) THEN 'OK' ELSE 'MISSING' END

      WHEN e.kind = 'realtime' THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM pg_publication_tables pt
          WHERE pt.pubname = 'supabase_realtime'
            AND pt.schemaname = 'public'
            AND pt.tablename = e.object_name
        ) THEN 'OK' ELSE 'MISSING' END

      WHEN e.kind = 'storage_bucket' THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM storage.buckets b WHERE b.id = e.object_name
        ) THEN 'OK' ELSE 'MISSING' END

      ELSE 'UNKNOWN'
    END AS status
  FROM expected e
)
SELECT kind, object_name, status
FROM resolved
ORDER BY
  CASE status WHEN 'MISSING' THEN 0 ELSE 1 END,
  kind,
  object_name;

-- Quick summary (optional second paste):
-- SELECT status, COUNT(*) FROM resolved GROUP BY status ORDER BY status;