-- =============================================================================
-- ADDITIVE ONLY — workspace chat DMs (1:1 within a workspace)
-- Safe to run on live: no DELETE/TRUNCATE/DROP TABLE of data.
-- Existing message rows are kept. New column is NULL for all existing rows
-- (NULL = team channel, same behavior as today).
-- =============================================================================

-- 1) Column (nullable — existing team messages stay team channel)
ALTER TABLE workspace_messages
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN workspace_messages.recipient_user_id IS
  'NULL = workspace team channel. Set to peer user id for a 1:1 DM in this workspace.';

-- 2) Indexes (CREATE IF NOT EXISTS — no data change)
CREATE INDEX IF NOT EXISTS idx_workspace_messages_team
  ON workspace_messages (workspace_id, created_at DESC)
  WHERE recipient_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_messages_dm
  ON workspace_messages (workspace_id, recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_messages_dm_sender
  ON workspace_messages (workspace_id, user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;

-- 3) RLS: replace SELECT/INSERT policies only (does not touch rows)
-- Team channel (NULL recipient) still visible to all workspace members.
-- DMs only visible to the two participants.

DROP POLICY IF EXISTS "Workspace members can view messages" ON workspace_messages;

CREATE POLICY "Workspace members can view messages" ON workspace_messages
  FOR SELECT USING (
    is_workspace_member(workspace_id, auth.uid())
    AND (
      recipient_user_id IS NULL
      OR user_id = auth.uid()
      OR recipient_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workspace members can send messages" ON workspace_messages;

CREATE POLICY "Workspace members can send messages" ON workspace_messages
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND is_workspace_member(workspace_id, auth.uid())
    AND (
      recipient_user_id IS NULL
      OR (
        recipient_user_id IS DISTINCT FROM auth.uid()
        AND is_workspace_member(workspace_id, recipient_user_id)
      )
    )
  );
