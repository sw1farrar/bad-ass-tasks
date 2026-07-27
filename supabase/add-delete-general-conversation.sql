-- =============================================================================
-- ADDITIVE ONLY — allow deleting the shared General channel messages
-- Extends delete_workspace_conversation: p_conversation_id NULL = General
-- (messages with conversation_id IS NULL, non-DM). Named channels unchanged.
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_workspace_conversation(
  p_workspace_id UUID,
  p_conversation_id UUID DEFAULT NULL
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

  -- General / Team channel: wipe shared messages (conversation_id IS NULL, not DMs)
  IF p_conversation_id IS NULL THEN
    DELETE FROM workspace_messages
    WHERE workspace_id = p_workspace_id
      AND conversation_id IS NULL
      AND recipient_user_id IS NULL;

    DELETE FROM workspace_conversation_prefs
    WHERE workspace_id = p_workspace_id
      AND conversation_key IN ('general', 'team');

    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM workspace_conversations c
    WHERE c.id = p_conversation_id
      AND c.workspace_id = p_workspace_id
  ) THEN
    RETURN false;
  END IF;

  -- Named channel: messages + prefs + row (reactions cascade from messages)
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
  'Member-only hard delete. NULL conversation_id = General messages; UUID = named channel + messages + prefs.';

GRANT EXECUTE ON FUNCTION delete_workspace_conversation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_workspace_conversation(UUID, UUID) TO service_role;
