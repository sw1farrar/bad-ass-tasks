-- Summary: ok_count should be 65, missing_count should be 0
WITH expected AS (
  SELECT kind, object_name FROM (VALUES
    ('table', 'workspaces'), ('table', 'workspace_members'), ('table', 'profiles'),
    ('table', 'tasks'), ('table', 'notes'), ('table', 'comments'),
    ('table', 'workspace_messages'), ('table', 'workspace_message_reactions'),
    ('table', 'activity_logs'), ('table', 'workspace_invites'), ('table', 'notifications'),
    ('table', 'dual_auth_challenges'), ('table', 'workspace_lists'), ('table', 'list_items'),
    ('table', 'note_email_inboxes'), ('table', 'task_email_inboxes'),
    ('table', 'note_attachments'), ('table', 'inbound_email_events'),
    ('column', 'notes.linked_note_ids'), ('column', 'notes.sort_order'), ('column', 'notes.snapshots'),
    ('column', 'notes.raw_html'), ('column', 'notes.email_source'), ('column', 'notes.search_plain'),
    ('column', 'notes.email_pipeline_version'), ('column', 'profiles.username'),
    ('column', 'profiles.location'), ('column', 'profiles.notification_prefs'),
    ('column', 'profiles.access_paused'), ('column', 'profiles.access_paused_at'),
    ('column', 'profiles.access_paused_reason'), ('column', 'note_attachments.pdf_annotations'),
    ('column', 'note_attachments.content_id'), ('column', 'inbound_email_events.task_id'),
    ('column', 'inbound_email_events.task_inbox_id'),
    ('function', 'is_workspace_member'), ('function', 'create_workspace_for_user'),
    ('function', 'create_workspace_invite'), ('function', 'accept_workspace_invite'),
    ('function', 'search_users_for_invite'), ('function', 'delete_workspace_for_owner'),
    ('function', 'exit_workspace'), ('function', 'update_workspace_details'),
    ('function', 'create_dual_auth_challenge_atomic'), ('function', 'revoke_workspace_invite'),
    ('function', 'decline_workspace_invite'), ('function', 'cleanup_orphan_invite_notifications'),
    ('function', 'transfer_workspace_ownership'), ('function', 'update_member_role'),
    ('function', 'update_updated_at_column'),
    ('enum', 'user_role'), ('enum', 'task_priority'), ('enum', 'task_status'),
    ('realtime', 'tasks'), ('realtime', 'notes'), ('realtime', 'workspace_members'),
    ('realtime', 'workspace_invites'), ('realtime', 'activity_logs'), ('realtime', 'notifications'),
    ('realtime', 'comments'), ('realtime', 'workspace_messages'),
    ('realtime', 'workspace_message_reactions'), ('realtime', 'workspace_lists'),
    ('realtime', 'list_items'),
    ('storage_bucket', 'note-attachments')
  ) AS v(kind, object_name)
),
resolved AS (
  SELECT e.kind, e.object_name,
    CASE
      WHEN e.kind = 'table' THEN CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_name = e.object_name) THEN 'OK' ELSE 'MISSING' END
      WHEN e.kind = 'column' THEN CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = split_part(e.object_name, '.', 1)
          AND c.column_name = split_part(e.object_name, '.', 2)) THEN 'OK' ELSE 'MISSING' END
      WHEN e.kind = 'function' THEN CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = e.object_name) THEN 'OK' ELSE 'MISSING' END
      WHEN e.kind = 'enum' THEN CASE WHEN EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = e.object_name AND t.typtype = 'e') THEN 'OK' ELSE 'MISSING' END
      WHEN e.kind = 'realtime' THEN CASE WHEN EXISTS (
        SELECT 1 FROM pg_publication_tables pt
        WHERE pt.pubname = 'supabase_realtime' AND pt.schemaname = 'public'
          AND pt.tablename = e.object_name) THEN 'OK' ELSE 'MISSING' END
      WHEN e.kind = 'storage_bucket' THEN CASE WHEN EXISTS (
        SELECT 1 FROM storage.buckets b WHERE b.id = e.object_name) THEN 'OK' ELSE 'MISSING' END
      ELSE 'UNKNOWN'
    END AS status
  FROM expected e
)
SELECT COUNT(*) FILTER (WHERE status = 'OK') AS ok_count,
       COUNT(*) FILTER (WHERE status = 'MISSING') AS missing_count
FROM resolved;