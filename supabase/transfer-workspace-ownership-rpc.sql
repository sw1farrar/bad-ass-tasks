-- ============================================================================
-- OWNERSHIP TRANSFER + MEMBER ROLE UPDATES
-- Run in Supabase SQL Editor if you prefer RPC-based client paths.
-- The production app also uses /api/workspace/transfer-ownership (service role).
-- ============================================================================

CREATE OR REPLACE FUNCTION transfer_workspace_ownership(
  p_workspace_id UUID,
  p_new_owner_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  SELECT role INTO v_caller_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the workspace owner can transfer ownership';
  END IF;

  IF p_new_owner_id = auth.uid() THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_new_owner_id
  ) THEN
    RETURN FALSE;
  END IF;

  UPDATE workspace_members
  SET role = 'owner'
  WHERE workspace_id = p_workspace_id AND user_id = p_new_owner_id;

  UPDATE workspace_members
  SET role = 'admin'
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid();

  UPDATE workspaces
  SET owner_id = p_new_owner_id
  WHERE id = p_workspace_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION transfer_workspace_ownership IS
  'Owner transfers workspace to another member immediately. Former owner becomes admin.';

CREATE OR REPLACE FUNCTION update_member_role(
  p_workspace_id UUID,
  p_user_id UUID,
  p_new_role user_role
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
  v_target_role user_role;
  v_owner_count INT;
BEGIN
  SELECT role INTO v_caller_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_user_id = auth.uid() THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_target_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  LIMIT 1;

  IF v_target_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_target_role = 'owner' AND p_new_role <> 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count
    FROM workspace_members
    WHERE workspace_id = p_workspace_id AND role = 'owner';

    IF v_owner_count <= 1 THEN
      RETURN FALSE;
    END IF;
  END IF;

  UPDATE workspace_members
  SET role = p_new_role
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION update_member_role IS
  'Owner/admin updates another member role with last-owner protection.';