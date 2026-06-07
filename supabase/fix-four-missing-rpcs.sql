-- ============================================
-- Create the 4 missing RPCs only (no ALTER PUBLICATION)
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================

-- 1) Dual-auth (critical — sign-in verification emails)
CREATE OR REPLACE FUNCTION public.create_dual_auth_challenge_atomic(
  p_user_id UUID,
  p_code_hash TEXT,
  p_expires_at TIMESTAMPTZ,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent RECORD;
  v_count INT;
  v_window_start TIMESTAMPTZ := NOW() - INTERVAL '10 minutes';
  v_idempotency INTERVAL := INTERVAL '2 minutes';
  v_cooldown INTERVAL := INTERVAL '60 seconds';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  SELECT id, created_at
  INTO v_recent
  FROM dual_auth_challenges
  WHERE user_id = p_user_id
    AND consumed_at IS NULL
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_recent.id IS NOT NULL THEN
    IF NOT p_force AND v_recent.created_at > NOW() - v_idempotency THEN
      RETURN jsonb_build_object(
        'action', 'already_sent',
        'retry_after_seconds',
        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_recent.created_at + v_cooldown - NOW())))::INT)
      );
    END IF;

    IF p_force AND v_recent.created_at > NOW() - v_cooldown THEN
      RETURN jsonb_build_object(
        'action', 'cooldown',
        'retry_after_seconds',
        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_recent.created_at + v_cooldown - NOW())))::INT)
      );
    END IF;
  END IF;

  SELECT COUNT(*)::INT
  INTO v_count
  FROM dual_auth_challenges
  WHERE user_id = p_user_id
    AND created_at >= v_window_start
    AND consumed_at IS NULL;

  IF v_count >= 3 THEN
    RETURN jsonb_build_object('action', 'rate_limited');
  END IF;

  UPDATE dual_auth_challenges
  SET consumed_at = NOW()
  WHERE user_id = p_user_id
    AND consumed_at IS NULL
    AND expires_at > NOW();

  INSERT INTO dual_auth_challenges (user_id, code_hash, expires_at)
  VALUES (p_user_id, p_code_hash, p_expires_at);

  RETURN jsonb_build_object('action', 'send');
END;
$$;

REVOKE ALL ON FUNCTION public.create_dual_auth_challenge_atomic(UUID, TEXT, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_dual_auth_challenge_atomic(UUID, TEXT, TIMESTAMPTZ, BOOLEAN) TO service_role;

-- 2) Invite notification cleanup (called from client after revoke)
CREATE OR REPLACE FUNCTION public.cleanup_orphan_invite_notifications()
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

GRANT EXECUTE ON FUNCTION public.cleanup_orphan_invite_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_orphan_invite_notifications() TO service_role;

-- 3) Ownership transfer
CREATE OR REPLACE FUNCTION public.transfer_workspace_ownership(
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

GRANT EXECUTE ON FUNCTION public.transfer_workspace_ownership(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_workspace_ownership(UUID, UUID) TO service_role;

-- 4) Member role updates
CREATE OR REPLACE FUNCTION public.update_member_role(
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

GRANT EXECUTE ON FUNCTION public.update_member_role(UUID, UUID, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_role(UUID, UUID, user_role) TO service_role;

NOTIFY pgrst, 'reload schema';

-- Verify (should return 4 rows, all proname matching):
SELECT proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_dual_auth_challenge_atomic',
    'cleanup_orphan_invite_notifications',
    'transfer_workspace_ownership',
    'update_member_role'
  )
ORDER BY proname;