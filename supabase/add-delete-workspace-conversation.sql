-- =============================================================================
-- ADDITIVE ONLY — delete shared chat channels (and their messages)
-- Safe: CREATE POLICY / CREATE OR REPLACE FUNCTION. No table drops.
--
-- Why RPC: workspace_messages has no member DELETE policy; FK on conversation_id
-- is ON DELETE SET NULL, which would leak channel messages into General if we
-- only deleted the conversation row.
-- =============================================================================

-- Allow members to delete channel rows (used if messages already cleared)
DROP POLICY IF EXISTS "Members can delete workspace conversations" ON workspace_conversations;
CREATE POLICY "Members can delete workspace conversations" ON workspace_conversations
  FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE OR REPLACE FUNCTION delete_workspace_conversation(
  p_workspace_id UUID,
  p_conversation_id UUID
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_key TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_workspace_member(p_workspace_id, v_uid) THEN
    RAISE EXCEPTION 'Not a workspace member';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM workspace_conversations c
    WHERE c.id = p_conversation_id
      AND c.workspace_id = p_workspace_id
  ) THEN
    RETURN false;
  END IF;

  -- Reactions cascade from messages (message_id ON DELETE CASCADE)
  DELETE FROM workspace_messages
  WHERE workspace_id = p_workspace_id
    AND conversation_id = p_conversation_id;

  v_key := 'channel:' || p_conversation_id::text;

  DELETE FROM workspace_conversation_prefs
  WHERE workspace_id = p_workspace_id
    AND conversation_key = v_key;

  DELETE FROM workspace_conversations
  WHERE id = p_conversation_id
    AND workspace_id = p_workspace_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION delete_workspace_conversation(UUID, UUID) IS
  'Member-only hard delete of a shared chat channel, its messages, and related prefs.';

GRANT EXECUTE ON FUNCTION delete_workspace_conversation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_workspace_conversation(UUID, UUID) TO service_role;
