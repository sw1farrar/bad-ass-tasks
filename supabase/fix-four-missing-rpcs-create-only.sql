-- ============================================
-- CREATE ONLY — no GRANT, no REVOKE, no NOTIFY
-- Run this ENTIRE file in Supabase SQL Editor.
-- If still missing, run each numbered block separately.
-- ============================================

-- ── 1/4 create_dual_auth_challenge_atomic ─────────────────────
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
AS $fn$
DECLARE
  v_recent RECORD;
  v_count INT;
  v_window_start TIMESTAMPTZ := NOW() - INTERVAL '10 minutes';
  v_idempotency INTERVAL := INTERVAL '2 minutes';
  v_cooldown INTERVAL := INTERVAL '60 seconds';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  SELECT id, created_at INTO v_recent
  FROM dual_auth_challenges
  WHERE user_id = p_user_id AND consumed_at IS NULL AND expires_at > NOW()
  ORDER BY created_at DESC LIMIT 1;

  IF v_recent.id IS NOT NULL THEN
    IF NOT p_force AND v_recent.created_at > NOW() - v_idempotency THEN
      RETURN jsonb_build_object('action', 'already_sent',
        'retry_after_seconds', GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_recent.created_at + v_cooldown - NOW())))::INT));
    END IF;
    IF p_force AND v_recent.created_at > NOW() - v_cooldown THEN
      RETURN jsonb_build_object('action', 'cooldown',
        'retry_after_seconds', GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_recent.created_at + v_cooldown - NOW())))::INT));
    END IF;
  END IF;

  SELECT COUNT(*)::INT INTO v_count
  FROM dual_auth_challenges
  WHERE user_id = p_user_id AND created_at >= v_window_start AND consumed_at IS NULL;

  IF v_count >= 3 THEN
    RETURN jsonb_build_object('action', 'rate_limited');
  END IF;

  UPDATE dual_auth_challenges SET consumed_at = NOW()
  WHERE user_id = p_user_id AND consumed_at IS NULL AND expires_at > NOW();

  INSERT INTO dual_auth_challenges (user_id, code_hash, expires_at)
  VALUES (p_user_id, p_code_hash, p_expires_at);

  RETURN jsonb_build_object('action', 'send');
END;
$fn$;

-- ── 2/4 cleanup_orphan_invite_notifications ─────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_orphan_invite_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE deleted_count INTEGER;
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
$fn$;

-- ── 3/4 transfer_workspace_ownership ──────────────────────────
CREATE OR REPLACE FUNCTION public.transfer_workspace_ownership(
  p_workspace_id UUID,
  p_new_owner_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_caller_role user_role;
BEGIN
  SELECT role INTO v_caller_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid() LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the workspace owner can transfer ownership';
  END IF;
  IF p_new_owner_id = auth.uid() THEN RETURN FALSE; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_new_owner_id
  ) THEN RETURN FALSE; END IF;

  UPDATE workspace_members SET role = 'owner'
  WHERE workspace_id = p_workspace_id AND user_id = p_new_owner_id;
  UPDATE workspace_members SET role = 'admin'
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid();
  UPDATE workspaces SET owner_id = p_new_owner_id WHERE id = p_workspace_id;
  RETURN TRUE;
END;
$fn$;

-- ── 4/4 update_member_role ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_member_role(
  p_workspace_id UUID,
  p_user_id UUID,
  p_new_role user_role
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller_role user_role;
  v_target_role user_role;
  v_owner_count INT;
BEGIN
  SELECT role INTO v_caller_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid() LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  IF p_user_id = auth.uid() THEN RETURN FALSE; END IF;

  SELECT role INTO v_target_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id LIMIT 1;

  IF v_target_role IS NULL THEN RETURN FALSE; END IF;

  IF v_target_role = 'owner' AND p_new_role <> 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count
    FROM workspace_members WHERE workspace_id = p_workspace_id AND role = 'owner';
    IF v_owner_count <= 1 THEN RETURN FALSE; END IF;
  END IF;

  UPDATE workspace_members SET role = p_new_role
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  RETURN TRUE;
END;
$fn$;

-- VERIFY (must return 4 rows):
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'create_dual_auth_challenge_atomic',
    'cleanup_orphan_invite_notifications',
    'transfer_workspace_ownership',
    'update_member_role'
  )
ORDER BY proname;