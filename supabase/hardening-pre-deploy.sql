-- Pre-deploy hardening (idempotent). Run after fix-invite-lifecycle-rls-and-rpcs.sql

-- Invite accept: enforce email restriction at RPC layer (prevents browser RPC bypass)
CREATE OR REPLACE FUNCTION accept_workspace_invite(p_invite_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_ws_id UUID;
  v_caller_email TEXT;
BEGIN
  SELECT COALESCE(p.email, u.email) INTO v_caller_email
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE u.id = auth.uid();

  SELECT * INTO v_invite FROM workspace_invites
  WHERE id = p_invite_id
    AND accepted_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found, already accepted, or expired';
  END IF;

  IF v_invite.invited_user_id IS NOT NULL AND v_invite.invited_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'This invite was sent to a different user';
  END IF;

  IF v_invite.email IS NOT NULL AND (
    v_caller_email IS NULL OR lower(v_caller_email) <> lower(v_invite.email)
  ) THEN
    RAISE EXCEPTION 'This invite was sent to a different email address';
  END IF;

  v_ws_id := v_invite.workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (v_ws_id, auth.uid(), v_invite.role, v_invite.invited_by)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE workspace_invites SET accepted_at = NOW() WHERE id = p_invite_id;

  DELETE FROM notifications
  WHERE user_id = auth.uid()
    AND type = 'invite'
    AND (metadata->>'invite_id')::uuid = p_invite_id;

  RETURN v_ws_id;
END;
$$;

NOTIFY pgrst, 'reload schema';