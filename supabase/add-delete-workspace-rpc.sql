-- ============================================================================
-- WORKSPACE DELETE (owner-only)
-- Date: 2026-06-06
-- Purpose: Enable owners to permanently delete a workspace from the app.
--
-- Run this entire block in the Supabase SQL Editor.
-- Safe to re-run (DROP IF EXISTS + CREATE OR REPLACE).
-- ============================================================================

-- 1. RLS: owners may delete workspaces they own (direct-delete fallback path)
DROP POLICY IF EXISTS "Owners can delete their workspaces" ON workspaces;
CREATE POLICY "Owners can delete their workspaces" ON workspaces
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
    )
  );

-- 2. RPC: preferred server-side delete (SECURITY DEFINER, owner enforced)
CREATE OR REPLACE FUNCTION delete_workspace_for_owner(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
  v_membership_count INTEGER;
  v_primary_workspace_id UUID;
BEGIN
  SELECT role INTO v_caller_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'Only the workspace owner may delete it';
  END IF;

  SELECT COUNT(*) INTO v_membership_count
  FROM workspace_members
  WHERE user_id = auth.uid();

  IF v_membership_count <= 1 THEN
    RAISE EXCEPTION 'Cannot delete your only workspace';
  END IF;

  SELECT w.id INTO v_primary_workspace_id
  FROM workspaces w
  INNER JOIN workspace_members wm ON wm.workspace_id = w.id
  WHERE wm.user_id = auth.uid()
    AND wm.role = 'owner'
    AND w.owner_id = auth.uid()
  ORDER BY w.created_at ASC
  LIMIT 1;

  IF v_primary_workspace_id IS NOT NULL AND v_primary_workspace_id = p_workspace_id THEN
    RAISE EXCEPTION 'Cannot delete your original workspace';
  END IF;

  DELETE FROM workspaces WHERE id = p_workspace_id;
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION delete_workspace_for_owner IS
  'Owner-only workspace deletion with server-side role enforcement. Cascades to members, tasks, notes, etc. via FKs.';

NOTIFY pgrst, 'reload schema';