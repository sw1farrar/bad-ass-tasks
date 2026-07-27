-- =============================================================================
-- ADDITIVE ONLY — shared workspace chat channels (visible to all members)
-- Safe: CREATE TABLE / ADD COLUMN IF NOT EXISTS. No DELETE of message rows.
--
-- Model:
--   workspace_conversations = named channels everyone in the workspace can use
--   workspace_messages.conversation_id NULL = legacy "General" / Team channel
--   workspace_messages.conversation_id = UUID → that shared channel
-- =============================================================================

CREATE TABLE IF NOT EXISTS workspace_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL
    CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 80),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_conversations_ws
  ON workspace_conversations (workspace_id, updated_at DESC);

ALTER TABLE workspace_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view workspace conversations" ON workspace_conversations;
CREATE POLICY "Members can view workspace conversations" ON workspace_conversations
  FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Members can create workspace conversations" ON workspace_conversations;
CREATE POLICY "Members can create workspace conversations" ON workspace_conversations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND is_workspace_member(workspace_id, auth.uid())
    AND (created_by IS NULL OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Members can update workspace conversations" ON workspace_conversations;
CREATE POLICY "Members can update workspace conversations" ON workspace_conversations
  FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

-- Messages: link to a shared channel (NULL = General/Team legacy channel)
ALTER TABLE workspace_messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES workspace_conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_messages_conversation
  ON workspace_messages (workspace_id, conversation_id, created_at DESC);

-- Prefs keys: allow general | channel:<uuid> | team | dm:<uuid> (legacy)
ALTER TABLE workspace_conversation_prefs
  DROP CONSTRAINT IF EXISTS workspace_conversation_prefs_conversation_key_check;

ALTER TABLE workspace_conversation_prefs
  ADD CONSTRAINT workspace_conversation_prefs_conversation_key_check
  CHECK (
    conversation_key = 'general'
    OR conversation_key = 'team'
    OR conversation_key ~ '^channel:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR conversation_key ~ '^dm:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

COMMENT ON TABLE workspace_conversations IS
  'Shared chat channels for a workspace; all members can read and post.';
COMMENT ON COLUMN workspace_messages.conversation_id IS
  'NULL = General/Team channel. UUID = named shared channel in workspace_conversations.';
