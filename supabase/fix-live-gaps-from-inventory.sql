-- ============================================
-- BADAZZ TASKS — Fix gaps from inventory audit
-- Run once in Supabase SQL Editor. Safe to re-run.
--
-- Fixes 11 MISSING items:
--   columns: notes email archive (4), note_attachments.content_id
--   functions: create_dual_auth_challenge_atomic, cleanup_orphan_invite_notifications,
--              transfer_workspace_ownership, update_member_role
--   realtime: workspace_lists, list_items
-- ============================================

-- ── 1) Email note archive columns ───────────────────────────────
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS raw_html TEXT,
  ADD COLUMN IF NOT EXISTS email_source TEXT,
  ADD COLUMN IF NOT EXISTS search_plain TEXT,
  ADD COLUMN IF NOT EXISTS email_pipeline_version INTEGER;

COMMENT ON COLUMN notes.raw_html IS 'Original inbound HTML before TipTap conversion (for re-render).';
COMMENT ON COLUMN notes.email_source IS 'Storage path to archived .eml or brevo:messageId fallback.';
COMMENT ON COLUMN notes.search_plain IS 'Denormalized plain text for note search (includes email body).';
COMMENT ON COLUMN notes.email_pipeline_version IS 'Inbound HTML pipeline version at ingest time.';

CREATE INDEX IF NOT EXISTS idx_notes_search_plain
  ON notes USING gin (to_tsvector('english', coalesce(search_plain, '')));

ALTER TABLE note_attachments
  ADD COLUMN IF NOT EXISTS content_id TEXT;

COMMENT ON COLUMN note_attachments.content_id IS 'MIME Content-ID for inline CID image resolution.';

-- ── 2) Dual-auth atomic send RPC ────────────────────────────────
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

-- ── 3) Invite notification cleanup helper ───────────────────────
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
  'Maintenance helper. Returns number of orphan invite notifications removed.';

-- ── 4) Ownership transfer + member role RPCs ────────────────────
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

  UPDATE workspace_members SET role = 'owner'
  WHERE workspace_id = p_workspace_id AND user_id = p_new_owner_id;

  UPDATE workspace_members SET role = 'admin'
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid();

  UPDATE workspaces SET owner_id = p_new_owner_id
  WHERE id = p_workspace_id;

  RETURN TRUE;
END;
$$;

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

  UPDATE workspace_members SET role = p_new_role
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- ── 5) Lists realtime publication ───────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_lists'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_lists;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'list_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE list_items;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';