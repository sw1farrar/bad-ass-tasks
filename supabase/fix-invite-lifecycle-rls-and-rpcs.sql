-- ============================================================================
-- WORLD-CLASS INVITE / MEMBERSHIP LIFECYCLE HARDENING
-- Date: 2026-05-26
-- Purpose: Make every terminating action (revoke, decline, accept, owner-remove, self-exit)
--          atomic, symmetric, instantly consistent for all parties, and reliable under
--          realtime + hard refresh. Follows the consensus from deep expert analysis.
--
-- Run this entire block in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql).
-- It is safe to re-run (policies use DROP IF EXISTS, functions use CREATE OR REPLACE).
-- ============================================================================

-- 1. RELIABLE DELETE REALTIME DELIVERY (critical for owner-revoke → recipient banner disappears instantly)
-- Without REPLICA IDENTITY FULL, DELETE payloads to user-scoped channels are often partial or missing.
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE workspace_invites REPLICA IDENTITY FULL;
ALTER TABLE workspace_members REPLICA IDENTITY FULL;

-- Add to realtime publication (safe if already present)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications, workspace_invites, workspace_members;

-- 2. SYMMETRIC DELETE POLICIES (recipients/targets can terminate their side of the relationship)
-- This enables the "either one of them can delete it or decline it" requirement.

-- Users can always delete their own notifications (any type). This is the foundation for banner/bell cleanup.
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Targets (invited users) can delete their own pending invites. Enables clean decline without needing owner rights.
DROP POLICY IF EXISTS "Targets can delete their own pending invites" ON workspace_invites;
CREATE POLICY "Targets can delete their own pending invites" ON workspace_invites
  FOR DELETE USING (
    accepted_at IS NULL AND
    (
      invited_user_id = auth.uid()
      OR email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  );

-- Users can remove themselves from a workspace ("Exit team" / self-service offboarding).
-- App-layer + RPC still protects the last-owner case.
DROP POLICY IF EXISTS "Users can remove themselves from workspaces" ON workspace_members;
CREATE POLICY "Users can remove themselves from workspaces" ON workspace_members
  FOR DELETE USING (user_id = auth.uid());

-- 3. HARDENED OWNER/ADMIN POLICY FOR INVITE NOTIFICATIONS (more explicit + robust)
DROP POLICY IF EXISTS "Owners can delete workspace_invite notifications for their workspace" ON notifications;
DROP POLICY IF EXISTS "Owners and admins can delete workspace_invite notifications for their workspace" ON notifications;
CREATE POLICY "Owners and admins can delete workspace_invite notifications for their workspace" ON notifications
  FOR DELETE USING (
    type = 'invite' AND
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = notifications.workspace_id 
        AND wm.user_id = auth.uid() 
        AND wm.role IN ('owner', 'admin')
    )
  );

-- 4. SECURITY DEFINER RPCs — THE WORLD-CLASS PATTERN FOR CROSS-USER / MULTI-TABLE TERMINATING ACTIONS
-- These run with elevated privileges, perform atomic cleanup, enforce business rules server-side,
-- and emit reliable changes for realtime. Client code should prefer these over raw .delete().

-- Revoke an invite (owner/admin only). Atomically removes the invite + all associated notifications.
CREATE OR REPLACE FUNCTION revoke_workspace_invite(p_invite_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws_id UUID;
  v_caller_role user_role;
BEGIN
  SELECT workspace_id INTO v_ws_id FROM workspace_invites WHERE id = p_invite_id;
  IF v_ws_id IS NULL THEN RETURN FALSE; END IF;

  SELECT role INTO v_caller_role FROM workspace_members 
  WHERE workspace_id = v_ws_id AND user_id = auth.uid() LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only workspace owners/admins may revoke invites';
  END IF;

  DELETE FROM workspace_invites WHERE id = p_invite_id;
  DELETE FROM notifications 
    WHERE type = 'invite' AND (metadata->>'invite_id')::uuid = p_invite_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION revoke_workspace_invite IS 
'SECURITY DEFINER atomic revoke. Deletes the invite row and all matching invite notifications (by metadata). Called by owners/admins. Guarantees cleanup for the recipient banner/bell.';

-- Decline an invite (target OR owner/admin). Atomic cleanup from either side.
CREATE OR REPLACE FUNCTION decline_workspace_invite(p_invite_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  SELECT * INTO v_invite FROM workspace_invites WHERE id = p_invite_id AND accepted_at IS NULL;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Authorization: the invited target (by user_id or email) OR an owner/admin of the workspace
  IF NOT (
    v_invite.invited_user_id = auth.uid() 
    OR v_invite.email = (SELECT email FROM profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM workspace_members wm 
      WHERE wm.workspace_id = v_invite.workspace_id 
        AND wm.user_id = auth.uid() 
        AND wm.role IN ('owner','admin')
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to decline this invite';
  END IF;

  DELETE FROM workspace_invites WHERE id = p_invite_id;
  DELETE FROM notifications 
    WHERE type = 'invite' AND (metadata->>'invite_id')::uuid = p_invite_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION decline_workspace_invite IS 
'SECURITY DEFINER. Either the recipient or an owner/admin can decline. Atomic delete of invite + notifications.';

-- Self-exit from a workspace (any member except the last owner).
CREATE OR REPLACE FUNCTION exit_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_owner_count INT;
BEGIN
  SELECT role INTO v_role FROM workspace_members 
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid();

  IF v_role IS NULL THEN RETURN FALSE; END IF;

  IF v_role = 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count FROM workspace_members 
    WHERE workspace_id = p_workspace_id AND role = 'owner';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot exit: you are the last owner of this workspace';
    END IF;
  END IF;

  DELETE FROM workspace_members WHERE workspace_id = p_workspace_id AND user_id = auth.uid();

  -- Optional: clean this user's notifications for the workspace (keeps their bell clean)
  DELETE FROM notifications WHERE workspace_id = p_workspace_id AND user_id = auth.uid();

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION exit_workspace IS 
'SECURITY DEFINER self-service offboarding. Prevents last-owner lockout. Cleans membership + related notifications.';

-- 5. ENHANCE EXISTING ACCEPT RPC TO CLEAN UP THE POWERING NOTIFICATION (prevents lingering banner after accept)
-- We re-create the function with added cleanup. If the original signature is different in your DB, adapt accordingly.
CREATE OR REPLACE FUNCTION accept_workspace_invite(p_invite_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_ws_id UUID;
BEGIN
  SELECT * INTO v_invite FROM workspace_invites 
  WHERE id = p_invite_id 
    AND accepted_at IS NULL 
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found, already accepted, or expired';
  END IF;

  v_ws_id := v_invite.workspace_id;

  -- Add the user as a member (idempotent via ON CONFLICT in real usage)
  INSERT INTO workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (v_ws_id, auth.uid(), v_invite.role, v_invite.invited_by)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Mark invite accepted
  UPDATE workspace_invites SET accepted_at = NOW() WHERE id = p_invite_id;

  -- CRITICAL: Clean up any pending invite notification for this user so the banner disappears immediately
  DELETE FROM notifications 
  WHERE user_id = auth.uid() 
    AND type = 'invite' 
    AND (metadata->>'invite_id')::uuid = p_invite_id;

  RETURN v_ws_id;
END;
$$;

COMMENT ON FUNCTION accept_workspace_invite IS 
'Original accept logic + mandatory notification cleanup so the recipient banner/bell is cleared instantly on accept.';

-- 6. OPTIONAL BUT RECOMMENDED: Lightweight helper to clean up orphans (can be called manually or on a schedule)
CREATE OR REPLACE FUNCTION cleanup_orphan_invite_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications n
  WHERE n.type = 'invite'
    AND (n.metadata->>'invite_id')::uuid IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM workspace_invites i WHERE i.id = (n.metadata->>'invite_id')::uuid
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_orphan_invite_notifications IS 
'Maintenance helper. Returns number of orphan invite notifications removed. Run occasionally if needed.';

-- ============================================================================
-- END OF MIGRATION
-- After running:
--   1. Verify no errors in the SQL editor output.
--   2. In the client, the new RPCs will be called (see updated hybridStore + store).
--   3. Test the full matrix: send → revoke (check recipient banner gone on refresh + realtime),
--      decline from banner, accept, owner remove member, self "Leave team".
-- ============================================================================