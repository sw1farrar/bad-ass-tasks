-- ============================================
-- BADAZZ TASKS — Sync all incremental features
-- Run once in Supabase SQL Editor on EXISTING projects.
-- Idempotent: safe to re-run.
--
-- Fresh projects: run supabase/schema.sql instead (includes everything below).
--
-- Also recommended (if not already applied):
--   • supabase/fix-invite-lifecycle-rls-and-rpcs.sql  (exit_workspace, invite cleanup)
--   • supabase/transfer-workspace-ownership-rpc.sql   (optional RPC mirrors)
--   • supabase/add-delete-workspace-rpc.sql             (delete_workspace_for_owner)
--
-- After running: verify with supabase/verify-schema.sql
-- ============================================

-- M2 notes columns (hierarchy, links, snapshots)
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS linked_note_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER,
  ADD COLUMN IF NOT EXISTS snapshots JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN notes.linked_note_ids IS 'M2: bidirectional note-to-note links.';
COMMENT ON COLUMN notes.sort_order IS 'M2: stable sort key for drag reorder within parent.';
COMMENT ON COLUMN notes.snapshots IS 'M2: lightweight version history (TipTap JSON snapshots).';

-- Profile editing fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;

-- Platform admin: pause accounts
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS access_paused BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS access_paused_at TIMESTAMPTZ;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS access_paused_reason TEXT;

COMMENT ON COLUMN profiles.access_paused IS 'When true, user is banned from auth and cannot use the app.';

-- Dual authentication challenges (server-managed OTP; no client RLS policies)
CREATE TABLE IF NOT EXISTS dual_auth_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dual_auth_challenges_user_active
  ON dual_auth_challenges (user_id, expires_at DESC)
  WHERE consumed_at IS NULL;

ALTER TABLE dual_auth_challenges ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE dual_auth_challenges IS 'Short-lived hashed email OTP codes for dual authentication at sign-in.';

-- Workspace lists + items
CREATE TABLE IF NOT EXISTS workspace_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'default',
  sort_order INTEGER NOT NULL DEFAULT 0,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES workspace_lists(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_lists_ws_sort
  ON workspace_lists (workspace_id, pinned DESC, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_list_items_list_sort ON list_items (list_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_list_items_workspace ON list_items (workspace_id);

ALTER TABLE workspace_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access lists" ON workspace_lists;
CREATE POLICY "Workspace members can access lists" ON workspace_lists
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can access list items" ON list_items;
CREATE POLICY "Workspace members can access list items" ON list_items
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

DROP TRIGGER IF EXISTS update_workspace_lists_updated_at ON workspace_lists;
CREATE TRIGGER update_workspace_lists_updated_at
  BEFORE UPDATE ON workspace_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_list_items_updated_at ON list_items;
CREATE TRIGGER update_list_items_updated_at
  BEFORE UPDATE ON list_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE workspace_lists IS 'Keep-style checklist cards per workspace (title, color, pin, sort).';
COMMENT ON TABLE list_items IS 'Checklist rows belonging to a workspace list.';

-- Realtime for lists (safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_lists') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_lists;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'list_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE list_items;
  END IF;
END $$;

-- Self-exit from workspace (used by Leave workspace in Teams settings)
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
  DELETE FROM notifications WHERE workspace_id = p_workspace_id AND user_id = auth.uid();

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION exit_workspace IS
  'SECURITY DEFINER self-service offboarding. Prevents last-owner lockout.';

-- Note attachments + inbound idempotency (see supabase/add-note-attachments.sql for full block)
-- Run supabase/add-note-attachments.sql if note_attachments / inbound_email_events are missing.

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';