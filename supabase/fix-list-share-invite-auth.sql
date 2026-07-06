-- Align list share accept/decline/workspace loading with recipient email fallback.
-- Safe to re-run. Run in Supabase SQL Editor on live.

CREATE OR REPLACE FUNCTION accept_list_share_invite(
  p_invite_id UUID,
  p_target_workspace_id UUID
)
RETURNS TABLE (list_id UUID, target_workspace_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_caller_email TEXT;
  v_share_id UUID;
BEGIN
  SELECT COALESCE(p.email, u.email) INTO v_caller_email
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE u.id = auth.uid();

  SELECT * INTO v_invite
  FROM list_share_invites
  WHERE id = p_invite_id
    AND declined_at IS NULL
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share invite not found, declined, revoked, or expired';
  END IF;

  IF v_invite.invited_user_id <> auth.uid()
    AND (
      v_invite.recipient_email IS NULL
      OR v_caller_email IS NULL
      OR lower(v_caller_email) <> lower(v_invite.recipient_email)
    )
  THEN
    RAISE EXCEPTION 'Not authorized to accept this share';
  END IF;

  IF NOT is_workspace_member(p_target_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not a member of the selected workspace';
  END IF;

  IF EXISTS (
    SELECT 1 FROM workspace_list_shares
    WHERE list_id = v_invite.list_id
      AND target_workspace_id = p_target_workspace_id
      AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This list is already shared into that workspace';
  END IF;

  INSERT INTO profiles (id, email)
  SELECT u.id, u.email FROM auth.users u WHERE u.id = auth.uid()
  ON CONFLICT (id) DO UPDATE SET email = COALESCE(EXCLUDED.email, profiles.email);

  INSERT INTO workspace_list_shares (
    list_id,
    source_workspace_id,
    target_workspace_id,
    shared_by,
    accepted_by,
    invite_id,
    permission
  )
  VALUES (
    v_invite.list_id,
    v_invite.source_workspace_id,
    p_target_workspace_id,
    v_invite.invited_by,
    auth.uid(),
    p_invite_id,
    v_invite.permission
  )
  RETURNING id INTO v_share_id;

  UPDATE list_share_invites
  SET accepted_at = COALESCE(accepted_at, NOW())
  WHERE id = p_invite_id;

  DELETE FROM notifications
  WHERE user_id = auth.uid()
    AND type = 'list_share'
    AND (metadata->>'list_share_id')::uuid = p_invite_id;

  RETURN QUERY SELECT v_invite.list_id, p_target_workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION decline_list_share_invite(p_invite_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_caller_email TEXT;
BEGIN
  SELECT COALESCE(p.email, u.email) INTO v_caller_email
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE u.id = auth.uid();

  SELECT * INTO v_invite FROM list_share_invites WHERE id = p_invite_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF v_invite.invited_user_id <> auth.uid()
    AND (
      v_invite.recipient_email IS NULL
      OR v_caller_email IS NULL
      OR lower(v_caller_email) <> lower(v_invite.recipient_email)
    )
  THEN
    RAISE EXCEPTION 'Not authorized to decline this share';
  END IF;

  UPDATE list_share_invites SET declined_at = NOW() WHERE id = p_invite_id;

  DELETE FROM notifications
  WHERE user_id = auth.uid()
    AND type = 'list_share'
    AND (metadata->>'list_share_id')::uuid = p_invite_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION get_list_share_linked_workspaces(p_invite_id UUID)
RETURNS TABLE (workspace_id UUID, workspace_name TEXT, already_linked BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_caller_email TEXT;
BEGIN
  SELECT COALESCE(p.email, u.email) INTO v_caller_email
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE u.id = auth.uid();

  SELECT * INTO v_invite FROM list_share_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_invite.invited_user_id <> auth.uid()
    AND (
      v_invite.recipient_email IS NULL
      OR v_caller_email IS NULL
      OR lower(v_caller_email) <> lower(v_invite.recipient_email)
    )
  THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    w.id AS workspace_id,
    w.name AS workspace_name,
    EXISTS (
      SELECT 1 FROM workspace_list_shares s
      WHERE s.list_id = v_invite.list_id
        AND s.target_workspace_id = w.id
        AND s.revoked_at IS NULL
    ) AS already_linked
  FROM workspace_members wm
  JOIN workspaces w ON w.id = wm.workspace_id
  WHERE wm.user_id = auth.uid()
  ORDER BY w.name ASC;
END;
$$;

NOTIFY pgrst, 'reload schema';