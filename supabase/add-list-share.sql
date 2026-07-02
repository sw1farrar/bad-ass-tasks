-- Cross-workspace list sharing (live link grants)
-- Run in Supabase SQL editor after workspace_lists / list_items exist.

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS list_share_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES workspace_lists(id) ON DELETE CASCADE,
  source_workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email TEXT,
  target_workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'edit' CHECK (permission IN ('view', 'edit', 'manage')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_list_share_invites_list
  ON list_share_invites (list_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_list_share_invites_recipient
  ON list_share_invites (invited_user_id)
  WHERE accepted_at IS NULL AND declined_at IS NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_list_share_invites_pending_recipient
  ON list_share_invites (list_id, invited_user_id)
  WHERE accepted_at IS NULL AND declined_at IS NULL AND revoked_at IS NULL AND target_workspace_id IS NULL;

CREATE TABLE IF NOT EXISTS workspace_list_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES workspace_lists(id) ON DELETE CASCADE,
  source_workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  target_workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_id UUID REFERENCES list_share_invites(id) ON DELETE SET NULL,
  permission TEXT NOT NULL DEFAULT 'edit' CHECK (permission IN ('view', 'edit', 'manage')),
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_list_share_target UNIQUE (list_id, target_workspace_id),
  CONSTRAINT chk_list_share_distinct_ws CHECK (source_workspace_id <> target_workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_list_shares_target
  ON workspace_list_shares (target_workspace_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_list_shares_list
  ON workspace_list_shares (list_id)
  WHERE revoked_at IS NULL;

ALTER TABLE list_share_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_list_shares ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ACCESS HELPER
-- ============================================================

CREATE OR REPLACE FUNCTION has_shared_list_access(
  p_list_id UUID,
  p_uid UUID,
  p_mode TEXT DEFAULT 'read'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_lists wl
    JOIN workspace_members wm ON wm.workspace_id = wl.workspace_id
    WHERE wl.id = p_list_id AND wm.user_id = p_uid
  )
  OR EXISTS (
    SELECT 1
    FROM workspace_list_shares s
    JOIN workspace_members wm ON wm.workspace_id = s.target_workspace_id
    WHERE s.list_id = p_list_id
      AND s.revoked_at IS NULL
      AND wm.user_id = p_uid
      AND (
        p_mode = 'read'
        OR s.permission IN ('edit', 'manage')
      )
  );
$$;

-- ============================================================
-- RLS: list share tables
-- ============================================================

DROP POLICY IF EXISTS "Source admins manage list share invites" ON list_share_invites;
CREATE POLICY "Source admins manage list share invites" ON list_share_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = list_share_invites.source_workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Recipients can view their list share invites" ON list_share_invites;
CREATE POLICY "Recipients can view their list share invites" ON list_share_invites
  FOR SELECT USING (
    invited_user_id = auth.uid()
    OR recipient_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Recipients can decline their list share invites" ON list_share_invites;
CREATE POLICY "Recipients can decline their list share invites" ON list_share_invites
  FOR UPDATE USING (
    invited_user_id = auth.uid()
    OR recipient_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can view workspace list shares" ON workspace_list_shares;
CREATE POLICY "Members can view workspace list shares" ON workspace_list_shares
  FOR SELECT USING (
    is_workspace_member(source_workspace_id, auth.uid())
    OR is_workspace_member(target_workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS "Source admins manage workspace list shares" ON workspace_list_shares;
CREATE POLICY "Source admins manage workspace list shares" ON workspace_list_shares
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_list_shares.source_workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Target members can update share presentation" ON workspace_list_shares;
CREATE POLICY "Target members can update share presentation" ON workspace_list_shares
  FOR UPDATE USING (
    is_workspace_member(target_workspace_id, auth.uid())
    AND revoked_at IS NULL
  )
  WITH CHECK (
    is_workspace_member(target_workspace_id, auth.uid())
  );

-- ============================================================
-- RLS: extend workspace_lists + list_items for shared access
-- ============================================================

DROP POLICY IF EXISTS "Workspace members can access lists" ON workspace_lists;
CREATE POLICY "Workspace members can access lists" ON workspace_lists
  FOR SELECT USING (
    is_workspace_member(workspace_id, auth.uid())
    OR has_shared_list_access(id, auth.uid(), 'read')
  );

DROP POLICY IF EXISTS "Workspace members can mutate lists" ON workspace_lists;
CREATE POLICY "Workspace members can mutate lists" ON workspace_lists
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update lists" ON workspace_lists
  FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete lists" ON workspace_lists
  FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can access list items" ON list_items;
CREATE POLICY "Workspace members can access list items" ON list_items
  FOR SELECT USING (
    is_workspace_member(workspace_id, auth.uid())
    OR has_shared_list_access(list_id, auth.uid(), 'read')
  );

DROP POLICY IF EXISTS "Workspace members can mutate list items" ON list_items;
CREATE POLICY "Workspace members can mutate list items" ON list_items
  FOR INSERT WITH CHECK (
    is_workspace_member(workspace_id, auth.uid())
    OR has_shared_list_access(list_id, auth.uid(), 'write')
  );

CREATE POLICY "Workspace members can update list items" ON list_items
  FOR UPDATE USING (
    is_workspace_member(workspace_id, auth.uid())
    OR has_shared_list_access(list_id, auth.uid(), 'write')
  )
  WITH CHECK (
    is_workspace_member(workspace_id, auth.uid())
    OR has_shared_list_access(list_id, auth.uid(), 'write')
  );

CREATE POLICY "Workspace members can delete list items" ON list_items
  FOR DELETE USING (
    is_workspace_member(workspace_id, auth.uid())
    OR has_shared_list_access(list_id, auth.uid(), 'write')
  );

-- ============================================================
-- RPCs
-- ============================================================

CREATE OR REPLACE FUNCTION create_list_share_invite(
  p_list_id UUID,
  p_invited_user_id UUID,
  p_recipient_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_id UUID;
  v_caller_role user_role;
  v_list RECORD;
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

  IF p_invited_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot share a list with yourself';
  END IF;

  INSERT INTO list_share_invites (
    list_id,
    source_workspace_id,
    invited_by,
    invited_user_id,
    recipient_email
  )
  VALUES (
    p_list_id,
    v_list.workspace_id,
    auth.uid(),
    p_invited_user_id,
    NULLIF(trim(coalesce(p_recipient_email, '')), '')
  )
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$;

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

  IF v_invite.invited_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'This share was sent to a different user';
  END IF;

  IF v_invite.recipient_email IS NOT NULL AND (
    v_caller_email IS NULL OR lower(v_caller_email) <> lower(v_invite.recipient_email)
  ) THEN
    RAISE EXCEPTION 'This share was sent to a different email address';
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
    AND (v_invite.recipient_email IS NULL OR lower(v_caller_email) <> lower(v_invite.recipient_email))
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

CREATE OR REPLACE FUNCTION revoke_list_share_invite(p_invite_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  SELECT * INTO v_invite FROM list_share_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = v_invite.source_workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only workspace owners and admins may revoke shares';
  END IF;

  UPDATE list_share_invites SET revoked_at = NOW() WHERE id = p_invite_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION revoke_list_share(
  p_list_id UUID,
  p_target_workspace_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
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
    RAISE EXCEPTION 'Only workspace owners and admins may revoke list shares';
  END IF;

  UPDATE workspace_list_shares
  SET revoked_at = NOW(), revoked_by = auth.uid()
  WHERE list_id = p_list_id
    AND target_workspace_id = p_target_workspace_id
    AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION get_shared_lists_for_workspace(p_target_workspace_id UUID)
RETURNS TABLE (
  share_id UUID,
  list_id UUID,
  source_workspace_id UUID,
  source_workspace_name TEXT,
  shared_by UUID,
  sharer_name TEXT,
  title TEXT,
  color TEXT,
  archived BOOLEAN,
  pinned BOOLEAN,
  sort_order INTEGER,
  permission TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_workspace_member(p_target_workspace_id, auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id AS share_id,
    wl.id AS list_id,
    s.source_workspace_id,
    sw.name AS source_workspace_name,
    s.shared_by,
    COALESCE(
      CASE WHEN sp.username IS NOT NULL THEN '@' || sp.username END,
      sp.full_name,
      'A teammate'
    ) AS sharer_name,
    wl.title,
    wl.color,
    wl.archived,
    s.pinned,
    s.sort_order,
    s.permission,
    wl.created_at,
    wl.updated_at
  FROM workspace_list_shares s
  JOIN workspace_lists wl ON wl.id = s.list_id
  JOIN workspaces sw ON sw.id = s.source_workspace_id
  LEFT JOIN profiles sp ON sp.id = s.shared_by
  WHERE s.target_workspace_id = p_target_workspace_id
    AND s.revoked_at IS NULL
    AND wl.archived = FALSE
  ORDER BY s.pinned DESC, s.sort_order ASC, wl.title ASC;
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
BEGIN
  SELECT * INTO v_invite FROM list_share_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_invite.invited_user_id <> auth.uid() THEN
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

-- ============================================================
-- NOTIFICATION TYPE (extend CHECK if notifications table exists)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
      CHECK (type IN (
        'mention', 'comment', 'invite', 'task_assigned', 'deadline',
        'activity', 'inbound_file', 'list_share'
      ));
  END IF;
END $$;

-- ============================================================
-- REALTIME
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_list_shares'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_list_shares;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'list_share_invites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE list_share_invites;
  END IF;
END $$;

ALTER TABLE workspace_list_shares REPLICA IDENTITY FULL;
ALTER TABLE list_share_invites REPLICA IDENTITY FULL;

NOTIFY pgrst, 'reload schema';