-- ============================================
-- BAD ASS TASKS — Complete Supabase Schema
-- Run this in the Supabase SQL Editor (or via migrations)
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fast text search

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'user');
CREATE TYPE task_priority AS ENUM ('P0', 'P1', 'P2', 'P3');
CREATE TYPE task_status AS ENUM ('backlog', 'todo', 'doing', 'done');

-- ============================================
-- WORKSPACES
-- ============================================

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WORKSPACE MEMBERS
-- ============================================

CREATE TABLE workspace_members (
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role DEFAULT 'user',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (workspace_id, user_id)
);

-- ============================================
-- PROFILES (extended user data)
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  username TEXT,   -- Unique-ish handle (e.g. "alexr", shown as @alexr). Editable by owner.
  location TEXT, -- "Where you're from" (city, region, "Remote", etc.) – editable by the user themselves via RLS
  avatar_url TEXT,
  email TEXT,
  -- Notification preferences (global defaults + per-workspace overrides). JSON for flexibility.
  -- Structure: { email: bool, inApp: bool, types: { mention:bool, ... }, perWorkspace: { [wsId]: { muted?:bool, ... } }, muteUntil?: string }
  notification_prefs JSONB DEFAULT '{"email": true, "inApp": true, "types": {"mention": true, "comment": true, "invite": true, "assignment": true, "deadline": true, "activity": true}, "perWorkspace": {}}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TASKS
-- ============================================

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'todo',
  priority task_priority DEFAULT 'P2',
  due_date TIMESTAMPTZ,
  assignee_ids UUID[] DEFAULT '{}',
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  recurring_rule TEXT, -- e.g. "FREQ=WEEKLY;BYDAY=MO"
  exception_dates TIMESTAMPTZ[] DEFAULT '{}', -- Agent 13: skipped occurrences for recurring series (skip one, etc.). Client-normalized YYYY-MM-DD or full ISO.
  time_estimate INTEGER, -- minutes
  time_spent INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  linked_note_ids UUID[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- NOTES
-- ============================================

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content JSONB, -- TipTap JSON content
  parent_note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  linked_task_ids UUID[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_edited_by UUID REFERENCES auth.users(id)
);

-- ============================================
-- COMMENTS (on tasks or notes)
-- ============================================

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (task_id IS NOT NULL AND note_id IS NULL) OR 
    (task_id IS NULL AND note_id IS NOT NULL)
  )
);

-- ============================================
-- ACTIVITY LOG
-- ============================================

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL, -- 'task.created', 'note.updated', 'comment.added', etc.
  target_type TEXT NOT NULL, -- 'task', 'note', 'workspace', 'member'
  target_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_assignee ON tasks USING GIN (assignee_ids);
CREATE INDEX idx_tasks_tags ON tasks USING GIN (tags);
CREATE INDEX idx_tasks_exception_dates ON tasks USING GIN (exception_dates); -- Agent 13 recurring exceptions support (prod perf)
CREATE INDEX idx_notes_workspace ON notes(workspace_id);
CREATE INDEX idx_notes_parent ON notes(parent_note_id);
CREATE INDEX idx_activity_workspace ON activity_logs(workspace_id, created_at DESC);

-- Full text search (simple for now, can upgrade to pgvector later)
CREATE INDEX idx_tasks_title_search ON tasks USING GIN (to_tsvector('english', title));
CREATE INDEX idx_notes_title_search ON notes USING GIN (to_tsvector('english', title));

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS HELPER FUNCTIONS
-- ============================================

-- Used by many RLS policies to check membership without causing recursion.
-- Must stay in sync with the deployed version in Supabase.
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members
    WHERE workspace_id = ws_id
      AND user_id = uid
  );
$$;

-- Profiles: users can see and edit their own
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Workspace members can see basic public profile info of other members in the same workspaces
-- (name, handle, avatar, last seen). This enables nice member lists without leaking sensitive data.
CREATE POLICY "Workspace members can view basic profiles of teammates" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm1
      JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid()
        AND wm2.user_id = profiles.id
    )
  );

-- Workspaces: members can see their workspaces
CREATE POLICY "Users can view workspaces they belong to" ON workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = workspaces.id 
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Workspace members policies
CREATE POLICY "Users can view members of their workspaces" ON workspace_members
  FOR SELECT USING (
    workspace_members.user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Owners and admins can remove other members (but not the last owner — enforced in app + ideally in RPC)
CREATE POLICY "Owners and admins can remove members" ON workspace_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Tasks: only workspace members can access
CREATE POLICY "Workspace members can access tasks" ON tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = tasks.workspace_id 
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Notes: same as tasks
CREATE POLICY "Workspace members can access notes" ON notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = notes.workspace_id 
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Comments
CREATE POLICY "Workspace members can access comments" ON comments
  FOR ALL USING (
    (task_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM tasks t 
      JOIN workspace_members wm ON wm.workspace_id = t.workspace_id 
      WHERE t.id = comments.task_id AND wm.user_id = auth.uid()
    )) OR
    (note_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM notes n 
      JOIN workspace_members wm ON wm.workspace_id = n.workspace_id 
      WHERE n.id = comments.note_id AND wm.user_id = auth.uid()
    ))
  );

-- Activity logs: workspace members
CREATE POLICY "Workspace members can view activity" ON activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = activity_logs.workspace_id 
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Allow authenticated workspace members to insert activity logs (for their own actions in the workspace)
CREATE POLICY "Workspace members can log activity" ON activity_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = activity_logs.workspace_id 
      AND workspace_members.user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTION: Create workspace + owner membership
-- ============================================

CREATE OR REPLACE FUNCTION create_workspace_for_user(
  user_id UUID,
  workspace_name TEXT,
  workspace_slug TEXT
)
RETURNS UUID AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  -- Create profile first (critical for FK on workspace_members)
  INSERT INTO profiles (id, full_name, email)
  SELECT user_id, raw_user_meta_data->>'full_name', email
  FROM auth.users WHERE id = user_id
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO workspaces (name, slug, owner_id)
  VALUES (workspace_name, workspace_slug, user_id)
  RETURNING id INTO new_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, user_id, 'owner');

  RETURN new_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- PROFILE FIELDS (name, username, location) - REQUIRED FOR EDITING IN UI
-- =====================================================================
-- If you applied the schema before the profile editing features were added,
-- run these commands in the Supabase SQL Editor (one-time):
--
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;
--
-- After running the above, users can edit:
--   - Full name
--   - Username / handle (shown as @username)
--   - Location ("where you're from")
--
-- via the top-right avatar pill or the Teams view.
-- RLS already allows users to update their own row.
-- Existing rows will have NULL for the new columns until edited.
-- =====================================================================

-- ============================================
-- SEED DATA (optional - for development)
-- ============================================

-- You can run this manually after creating your first user
-- INSERT INTO workspaces ... etc.

COMMENT ON TABLE workspaces IS 'Core workspaces / teams';
COMMENT ON TABLE tasks IS 'All tasks with rich properties';
COMMENT ON TABLE notes IS 'Block-based notes (TipTap JSON in content)';

-- ============================================
-- PHASE 2 COLLABORATION FOUNDATIONS: WORKSPACE INVITES
-- Add this section (or re-run full schema) in Supabase SQL Editor.
-- Enables invite links (token = invite UUID), role selection, accept flow.
-- Realtime publication note at bottom.
-- ============================================

CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT, -- optional (for future email delivery); link-based invites work without
  role user_role DEFAULT 'user',
  invited_by UUID REFERENCES auth.users(id),
  -- populated by client after create_workspace_invite RPC when invite originates from user search (privacy-safe id)
  invited_user_id UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_workspace ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invites_created ON workspace_invites(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invites_invited_user ON workspace_invites(invited_user_id);

ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

-- Only owners/admins of a workspace can create, view, or manage its invites.
-- (Safe non-recursive policy)
CREATE POLICY "Admins and owners can manage invites for their workspaces" ON workspace_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

-- Allow a user to SELECT a pending invite row that is explicitly targeted at them (via the id we enrich
-- on the search path, or email). This lets recipient UIs safely discover their own invites without
-- requiring membership in the target workspace yet. (Notifications table is the primary signal.)
-- Safe version: only references the public `profiles` table (which has proper RLS).
-- Never reference `auth.users` directly from RLS policies — the authenticated role
-- does not have SELECT on it by default, and doing so causes 403 "permission denied for table users"
-- for *every* query against the table (even for rows the owner policy would otherwise allow),
-- because Postgres evaluates the entire policy set.
CREATE POLICY "Targets can view invites addressed to them" ON workspace_invites
  FOR SELECT USING (
    invited_user_id = auth.uid()
    OR email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- Secure RPCs (SECURITY DEFINER) for invite creation and acceptance.
-- These enforce role checks server-side and handle membership atomically.
-- Client calls via supabase.rpc(...) after role guard in UI.

CREATE OR REPLACE FUNCTION create_workspace_invite(
  p_workspace_id UUID,
  p_email TEXT DEFAULT NULL,
  p_role user_role DEFAULT 'user'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_id UUID;
  v_caller_role user_role;
BEGIN
  -- Permission check
  SELECT role INTO v_caller_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions: only workspace owners and admins may send invites';
  END IF;

  INSERT INTO workspace_invites (workspace_id, email, role, invited_by)
  VALUES (p_workspace_id, p_email, p_role, auth.uid())
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$;

CREATE OR REPLACE FUNCTION accept_workspace_invite(p_invite_id UUID)
RETURNS UUID  -- workspace_id on success
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_ws_id UUID;
BEGIN
  SELECT * INTO v_invite
  FROM workspace_invites
  WHERE id = p_invite_id
    AND accepted_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found, already accepted, or expired';
  END IF;

  v_ws_id := v_invite.workspace_id;

  -- Add as member (safe if already present)
  INSERT INTO workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (v_ws_id, auth.uid(), v_invite.role, v_invite.invited_by)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE workspace_invites SET accepted_at = NOW() WHERE id = p_invite_id;

  RETURN v_ws_id;
END;
$$;

COMMENT ON TABLE workspace_invites IS 'Pending invites for workspace collaboration. Use id (UUID) as the secure shareable token for invite links. Accept exclusively via accept_workspace_invite() RPC.';

-- ============================================
-- REALTIME PUBLICATION (for Supabase Realtime subscriptions on tasks/notes/members)
-- If you see "relation ... is not in publication" errors, run the following once in SQL editor:
-- ALTER PUBLICATION supabase_realtime ADD TABLE tasks, notes, workspace_members, workspace_invites, activity_logs;
-- (Safe to re-run; errors on duplicates are ignorable or use the DO block in full setup.)
-- ============================================

-- ============================================
-- WORKSPACE SETTINGS (name/slug update + delete for owners)
-- Add these policies + RPCs for safe owner-only mutations (non-recursive).
-- Run in SQL editor alongside original schema.
-- ============================================

-- Allow owners (checked via member role) to update workspace metadata
CREATE POLICY "Owners can update workspace details" ON workspaces
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
    )
  );

-- Allow owners to delete their workspace (cascades via FKs to members/tasks/notes/etc)
CREATE POLICY "Owners can delete their workspaces" ON workspaces
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
    )
  );

-- ============================================
-- TEAMMATE DIRECTORY SEARCH (for empty owner "Build your team" invite flow)
-- SECURITY DEFINER RPC so it can query profiles despite RLS ("Users can view own profile" only).
-- Supports search on full_name (name), username (handle), location (city/where from), email.
-- Excludes caller + existing workspace members (if exclude_workspace_id provided).
-- Returns minimal safe fields for rich result cards before invite action.
-- Call via supabase.rpc from guarded hybrid fn only. LIMIT + ranking for perf/UX.
-- User must run this (and any prior ALTERs) in Supabase SQL Editor after pulling schema.
-- ============================================

CREATE OR REPLACE FUNCTION search_users_for_invite(
  search_term TEXT,
  exclude_workspace_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  username TEXT,
  location TEXT,
  email TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  term TEXT := lower(trim(coalesce(search_term, '')));
BEGIN
  IF length(term) < 1 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.username,
    p.location,
    p.email,
    p.avatar_url
  FROM profiles p
  WHERE p.id <> auth.uid()
    AND (
      lower(coalesce(p.full_name, '')) ILIKE '%' || term || '%'
      OR lower(coalesce(p.username, '')) ILIKE '%' || term || '%'
      OR lower(coalesce(p.location, '')) ILIKE '%' || term || '%'
      OR lower(coalesce(p.email, '')) ILIKE '%' || term || '%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.user_id = p.id
        AND (exclude_workspace_id IS NULL OR wm.workspace_id = exclude_workspace_id)
    )
  ORDER BY
    CASE
      WHEN lower(coalesce(p.username, '')) = term THEN 0
      WHEN lower(coalesce(p.username, '')) ILIKE term || '%' THEN 1
      WHEN lower(coalesce(p.full_name, '')) ILIKE term || '%' THEN 2
      ELSE 3
    END,
    coalesce(p.full_name, p.username, p.email, '')
  LIMIT 15;
END;
$$;

COMMENT ON FUNCTION search_users_for_invite IS 'SECURITY DEFINER multi-field search (name/username/city/email) for potential teammates in owner empty-invite state. Safe projection, privacy-respecting excludes. Companion to create_workspace_invite RPC.';

-- Secure RPC for delete (recommended for extra validation / future soft-delete hooks)
CREATE OR REPLACE FUNCTION delete_workspace_for_owner(p_workspace_id UUID)
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

  IF v_caller_role IS NULL OR v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'Only the workspace owner may delete it';
  END IF;

  DELETE FROM workspaces WHERE id = p_workspace_id;
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION delete_workspace_for_owner IS 'Owner-only workspace deletion with server-side role enforcement. Use from client via supabase.rpc when available.';

-- ============================================
-- NOTIFICATIONS TABLE (Agent 31: dedicated per-user notifications foundation)
-- Links optionally to activity_logs for traceability. Supports read status, email/in-app flags via prefs.
-- RLS: only recipient can SELECT/UPDATE their own rows. Inserts allowed for workspace members (target must be member).
-- Realtime: add to publication for live delivery: ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- recipient
  type TEXT NOT NULL CHECK (type IN ('mention', 'comment', 'invite', 'task_assigned', 'deadline', 'activity')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- e.g. relative path or hash for deep link in app
  activity_log_id UUID REFERENCES activity_logs(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb, -- actor info, target ids, original content preview, etc.
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view/update their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications (e.g. mark read)" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Workspace members can insert notifications targeted at other members of the same workspace (for fan-out on events)
CREATE POLICY "Workspace members can create notifications for workspace peers" ON notifications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = notifications.workspace_id AND wm.user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM workspace_members wm2
      WHERE wm2.workspace_id = notifications.workspace_id AND wm2.user_id = notifications.user_id
    )
  );

-- Special policy for workspace invites: owners/admins must be able to create 'invite' notifications
-- for any target user (the prospective teammate), even if they are not yet a workspace_member.
-- This powers the specific recipient bell + any-page global banner ("X invited you to Y").
-- The regular peer policy above is too strict for the pre-acceptance invite case.
CREATE POLICY "Owners can create workspace_invite notifications for any target user" ON notifications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    type = 'invite' AND   -- matches what sendInvite actually inserts
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = notifications.workspace_id 
        AND wm.user_id = auth.uid() 
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Owners/admins can also DELETE 'invite' notifications for their workspace (used when they revoke an invite).
-- This keeps the recipient's persistent banner and bell in sync without stale notifications.
CREATE POLICY "Owners can delete workspace_invite notifications for their workspace" ON notifications
  FOR DELETE USING (
    type = 'invite' AND
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = notifications.workspace_id 
        AND wm.user_id = auth.uid() 
        AND wm.role IN ('owner', 'admin')
    )
  );

COMMENT ON TABLE notifications IS 'Per-user in-app + email-targeted notifications. Timely, non-intrusive events derived from activity + collab actions. Use activity_logs as source of truth for history; this for actionable per-user alerts.';

-- After applying schema, run in Supabase SQL editor for reliable realtime (especially DELETEs):
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- ALTER TABLE notifications REPLICA IDENTITY FULL;
--
-- REPLICA IDENTITY FULL is critical for DELETE events to include the full row
-- in the postgres_changes payload so filtered subscriptions (user_id=eq.xxx) work reliably.
-- Without it, DELETE events are often incomplete or don't match filters (while INSERT usually works).
--
-- (Add the above alongside the existing activity_logs etc. lines if re-running full setup.)
