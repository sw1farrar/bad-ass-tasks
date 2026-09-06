-- ============================================
-- BADAZZ TASKS — Schema verification (read-only)
-- Run in Supabase SQL Editor. Returns rows for each check.
-- All checks should show status = 'OK'. Any 'MISSING' row needs a migration.
-- ============================================

WITH required_tables AS (
  SELECT unnest(ARRAY[
    'workspaces',
    'workspace_members',
    'profiles',
    'tasks',
    'notes',
    'comments',
    'workspace_messages',
    'workspace_message_reactions',
    'activity_logs',
    'workspace_invites',
    'notifications',
    'dual_auth_challenges',
    'workspace_lists',
    'list_items',
    'note_email_inboxes',
    'task_email_inboxes',
    'note_attachments',
    'inbound_email_events',
    'mcp_oauth_jtis',
    'mcp_access_tokens'
  ]) AS object_name
),
table_checks AS (
  SELECT
    rt.object_name,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_name = rt.object_name
      ) THEN 'OK'
      ELSE 'MISSING'
    END AS status,
    'table' AS kind
  FROM required_tables rt
),
required_columns AS (
  SELECT * FROM (VALUES
    ('notes', 'linked_note_ids'),
    ('notes', 'sort_order'),
    ('notes', 'snapshots'),
    ('profiles', 'username'),
    ('profiles', 'location'),
    ('profiles', 'access_paused'),
    ('profiles', 'access_paused_at'),
    ('profiles', 'access_paused_reason')
  ) AS v(table_name, column_name)
),
column_checks AS (
  SELECT
    rc.table_name || '.' || rc.column_name AS object_name,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = rc.table_name
          AND c.column_name = rc.column_name
      ) THEN 'OK'
      ELSE 'MISSING'
    END AS status,
    'column' AS kind
  FROM required_columns rc
),
required_functions AS (
  SELECT unnest(ARRAY[
    'is_workspace_member',
    'create_workspace_for_user',
    'create_workspace_invite',
    'accept_workspace_invite',
    'search_users_for_invite',
    'delete_workspace_for_owner',
    'exit_workspace'
  ]) AS object_name
),
function_checks AS (
  SELECT
    rf.object_name,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = rf.object_name
      ) THEN 'OK'
      ELSE 'MISSING'
    END AS status,
    'function' AS kind
  FROM required_functions rf
),
rls_checks AS (
  SELECT
    c.relname AS object_name,
    CASE WHEN c.relrowsecurity THEN 'OK' ELSE 'MISSING' END AS status,
    'rls' AS kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),
spatial_ref_sys_check AS (
  SELECT
    'spatial_ref_sys_not_in_public' AS object_name,
    CASE WHEN EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'spatial_ref_sys'
        AND c.relkind = 'r'
    ) THEN 'MISSING'
    ELSE 'OK'
    END AS status,
    'security' AS kind
)
SELECT * FROM table_checks
UNION ALL
SELECT * FROM column_checks
UNION ALL
SELECT * FROM function_checks
UNION ALL
SELECT * FROM rls_checks
UNION ALL
SELECT * FROM spatial_ref_sys_check
ORDER BY kind, object_name;

-- Summary row count (run separately if you want a quick pass/fail):
-- SELECT COUNT(*) FILTER (WHERE status = 'MISSING') AS missing_count FROM (...);