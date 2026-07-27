-- =============================================================================
-- ADDITIVE ONLY — per-user conversation rename + archive
-- Safe: CREATE TABLE IF NOT EXISTS, no DROP of existing data tables.
-- =============================================================================

CREATE TABLE IF NOT EXISTS workspace_conversation_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'team' or 'dm:<peer_user_uuid>'
  conversation_key TEXT NOT NULL
    CHECK (
      conversation_key = 'team'
      OR conversation_key ~ '^dm:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),
  title TEXT CHECK (title IS NULL OR (char_length(trim(title)) > 0 AND char_length(title) <= 80)),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id, conversation_key)
);

CREATE INDEX IF NOT EXISTS idx_conversation_prefs_user_ws
  ON workspace_conversation_prefs (workspace_id, user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_prefs_archived
  ON workspace_conversation_prefs (workspace_id, user_id, archived_at)
  WHERE archived_at IS NOT NULL;

ALTER TABLE workspace_conversation_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own conversation prefs" ON workspace_conversation_prefs;
CREATE POLICY "Users manage own conversation prefs" ON workspace_conversation_prefs
  FOR ALL
  USING (
    user_id = auth.uid()
    AND is_workspace_member(workspace_id, auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND is_workspace_member(workspace_id, auth.uid())
  );

COMMENT ON TABLE workspace_conversation_prefs IS
  'Per-user chat preferences: custom title and archive state for team or DM threads.';
