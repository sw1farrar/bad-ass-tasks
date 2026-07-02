-- Direct workspace-to-workspace list linking (same user or cross-user via membership)
-- Run after add-list-share.sql

-- ============================================================
-- RPC: link a list into another workspace the caller belongs to
-- ============================================================

CREATE OR REPLACE FUNCTION share_list_to_workspace(
  p_list_id UUID,
  p_target_workspace_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list RECORD;
  v_share_id UUID;
BEGIN
  SELECT wl.*, wm.role AS caller_role
  INTO v_list
  FROM workspace_lists wl
  JOIN workspace_members wm ON wm.workspace_id = wl.workspace_id AND wm.user_id = auth.uid()
  WHERE wl.id = p_list_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'List not found or you are not a member';
  END IF;

  IF v_list.caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only workspace owners and admins may share lists';
  END IF;

  IF v_list.workspace_id = p_target_workspace_id THEN
    RAISE EXCEPTION 'Cannot share a list into the same workspace';
  END IF;

  IF NOT is_workspace_member(p_target_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not a member of the target workspace';
  END IF;

  IF EXISTS (
    SELECT 1 FROM workspace_list_shares
    WHERE list_id = p_list_id
      AND target_workspace_id = p_target_workspace_id
      AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This list is already linked to that workspace';
  END IF;

  INSERT INTO workspace_list_shares (
    list_id,
    source_workspace_id,
    target_workspace_id,
    shared_by,
    accepted_by,
    permission
  )
  VALUES (
    p_list_id,
    v_list.workspace_id,
    p_target_workspace_id,
    auth.uid(),
    auth.uid(),
    'edit'
  )
  RETURNING id INTO v_share_id;

  RETURN v_share_id;
END;
$$;

-- ============================================================
-- RPC: list workspaces a list is currently linked into
-- ============================================================

CREATE OR REPLACE FUNCTION get_list_share_targets(p_list_id UUID)
RETURNS TABLE (
  share_id UUID,
  target_workspace_id UUID,
  target_workspace_name TEXT,
  permission TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_lists wl
    JOIN workspace_members wm ON wm.workspace_id = wl.workspace_id
    WHERE wl.id = p_list_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id AS share_id,
    s.target_workspace_id,
    tw.name AS target_workspace_name,
    s.permission,
    s.created_at
  FROM workspace_list_shares s
  JOIN workspaces tw ON tw.id = s.target_workspace_id
  WHERE s.list_id = p_list_id
    AND s.revoked_at IS NULL
  ORDER BY tw.name ASC;
END;
$$;

NOTIFY pgrst, 'reload schema';