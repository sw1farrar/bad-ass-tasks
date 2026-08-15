-- ============================================
-- BAD ASS TASKS — Complete Supabase Schema
-- Run this in the Supabase SQL Editor (or via migrations)
-- ============================================

-- ============================================================
-- M2 MIGRATION INSTRUCTIONS (for existing projects / 2026-05-30+)
-- If you see errors like:
--   "Could not find the 'snapshots' column of 'notes' in the schema cache"
--   or note hierarchy / note-to-note links not persisting across reloads in live mode,
-- run the block below in the Supabase SQL Editor (Dashboard → SQL Editor).
-- It is idempotent and safe to re-run.
-- After running, hard-refresh your app (the PostgREST schema cache usually picks it up in <10s).
-- ============================================================
-- BEGIN M2 MIGRATION (paste this):
ALTER TABLE notes 
  ADD COLUMN IF NOT EXISTS linked_note_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER,
  ADD COLUMN IF NOT EXISTS snapshots JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN notes.linked_note_ids IS 'M2: bidirectional note-to-note links (symmetric to tasks.linked_note_ids).';
COMMENT ON COLUMN notes.sort_order IS 'M2: stable integer sort key for drag-to-reparent / reorder within parent (client uses 0/1000/2000... with renorm on mutations).';
COMMENT ON COLUMN notes.snapshots IS 'M2: lightweight version history. Array of {ts: string, content: string (TipTap JSON), label: string}. Client-bounded to ~10. Persisted via hybridStore.onPersistSnapshot + editor capture.';
-- END M2 MIGRATION
-- (Fresh deploys using the full schema below will include the columns automatically.)
-- ============================================================

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
  access_paused BOOLEAN NOT NULL DEFAULT FALSE,
  access_paused_at TIMESTAMPTZ,
  access_paused_reason TEXT,
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
  linked_note_ids UUID[] DEFAULT '{}', -- M2: note-to-note bidirectional links
  sort_order INTEGER,                    -- M2: stable ordering for drag reparent/reorder (dense client integers)
  snapshots JSONB DEFAULT '[]'::jsonb,   -- M2: version history snapshots ({ts, content: TipTap JSON string, label})
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
-- WORKSPACE MESSAGES (team chat)
-- ============================================

CREATE TABLE workspace_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- NULL = team channel; set for 1:1 DM with that peer in the same workspace
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 4000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workspace_messages_ws_created ON workspace_messages(workspace_id, created_at DESC);
CREATE INDEX idx_workspace_messages_team ON workspace_messages (workspace_id, created_at DESC) WHERE recipient_user_id IS NULL;
CREATE INDEX idx_workspace_messages_dm ON workspace_messages (workspace_id, recipient_user_id, created_at DESC) WHERE recipient_user_id IS NOT NULL;

-- PostgREST embed: workspace_messages.user_id → profiles.id (same UUID as auth.users)
ALTER TABLE workspace_messages
  ADD CONSTRAINT workspace_messages_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

CREATE TABLE workspace_message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES workspace_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (char_length(emoji) >= 1 AND char_length(emoji) <= 32),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_message_reactions_message ON workspace_message_reactions(message_id);
CREATE INDEX idx_message_reactions_workspace ON workspace_message_reactions(workspace_id);

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
ALTER TABLE workspace_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_message_reactions ENABLE ROW LEVEL SECURITY;
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

-- Workspace team chat + DMs: members can read team channel; DMs only for participants
CREATE POLICY "Workspace members can view messages" ON workspace_messages
  FOR SELECT USING (
    is_workspace_member(workspace_id, auth.uid())
    AND (
      recipient_user_id IS NULL
      OR user_id = auth.uid()
      OR recipient_user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can send messages" ON workspace_messages
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND is_workspace_member(workspace_id, auth.uid())
    AND (
      recipient_user_id IS NULL
      OR (
        recipient_user_id IS DISTINCT FROM auth.uid()
        AND is_workspace_member(workspace_id, recipient_user_id)
      )
    )
  );

CREATE POLICY "Workspace members can view reactions" ON workspace_message_reactions
  FOR SELECT USING (
    is_workspace_member(workspace_id, auth.uid())
  );

CREATE POLICY "Workspace members can add reactions" ON workspace_message_reactions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND is_workspace_member(workspace_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM workspace_messages m
      WHERE m.id = message_id AND m.workspace_id = workspace_message_reactions.workspace_id
    )
  );

CREATE POLICY "Users can remove own reactions" ON workspace_message_reactions
  FOR DELETE USING (
    user_id = auth.uid()
    AND is_workspace_member(workspace_id, auth.uid())
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
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM user_id THEN
    RAISE EXCEPTION 'Not authorized to create workspace for this user';
  END IF;

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
$$;

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

  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot invite as owner; use transfer ownership';
  END IF;

  IF p_role = 'admin' AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners may invite admins';
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
  v_caller_email TEXT;
BEGIN
  SELECT COALESCE(p.email, u.email) INTO v_caller_email
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE u.id = auth.uid();

  SELECT * INTO v_invite
  FROM workspace_invites
  WHERE id = p_invite_id
    AND accepted_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found, already accepted, or expired';
  END IF;

  IF v_invite.role = 'owner' THEN
    RAISE EXCEPTION 'Invalid invite role';
  END IF;

  IF v_invite.invited_user_id IS NOT NULL AND v_invite.invited_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'This invite was sent to a different user';
  END IF;

  IF v_invite.email IS NOT NULL AND (
    v_caller_email IS NULL OR lower(v_caller_email) <> lower(v_invite.email)
  ) THEN
    RAISE EXCEPTION 'This invite was sent to a different email address';
  END IF;

  -- workspace_members may FK to profiles.id; bootstrap profile for new invitees.
  INSERT INTO profiles (id, email)
  SELECT u.id, u.email
  FROM auth.users u
  WHERE u.id = auth.uid()
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email);

  v_ws_id := v_invite.workspace_id;

  -- Never elevate an existing member via re-accept
  INSERT INTO workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (v_ws_id, auth.uid(), v_invite.role, v_invite.invited_by)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE workspace_invites SET accepted_at = NOW() WHERE id = p_invite_id;

  DELETE FROM notifications
  WHERE user_id = auth.uid()
    AND type = 'invite'
    AND (metadata->>'invite_id')::uuid = p_invite_id;

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

-- Secure RPC for owner to rename workspace (name + slug)
-- Added for Milestone 1 / Wave 7 stability (prevents fragile direct UPDATE under RLS)
CREATE OR REPLACE FUNCTION update_workspace_details(
  p_workspace_id UUID,
  p_name TEXT DEFAULT NULL,
  p_slug TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  -- Owner-only enforcement (server-side)
  SELECT role INTO v_caller_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'Only the workspace owner may update details';
  END IF;

  UPDATE workspaces
  SET 
    name = COALESCE(p_name, name),
    slug = COALESCE(p_slug, slug)
  WHERE id = p_workspace_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION update_workspace_details IS 
  'Owner-only workspace name/slug update via RPC. Called from hybridStore.updateWorkspace.';

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
  type TEXT NOT NULL CHECK (type IN ('mention', 'comment', 'invite', 'task_assigned', 'deadline', 'activity', 'inbound_file')),
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

CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

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

-- ============================================================
-- MILESTONE 1 REALTIME PUBLICATION (safe, idempotent)
-- Run this block after the main schema to enable full live collaboration.
-- ============================================================

DO $$
BEGIN
  -- Core data tables (most important for realtime)
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notes;
  END IF;

  -- Workspace membership & collaboration
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_members;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_invites') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_invites;
  END IF;

  -- Activity + notifications (for live bell + activity feed)
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'activity_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;

  -- Comments (for realtime comment threads on tasks/notes)
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE comments;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_messages;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_message_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_message_reactions;
  END IF;

  RAISE NOTICE 'Realtime publication updated for Milestone 1 tables.';
END $$;

-- Important: Full replica identity for reliable DELETE events in realtime
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE workspace_invites REPLICA IDENTITY FULL;
ALTER TABLE workspace_message_reactions REPLICA IDENTITY FULL;

-- Force PostgREST to pick up the new tables/functions
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- PLATFORM ADMIN, DUAL AUTH, WORKSPACE LISTS (2026-06+)
-- Idempotent additions for existing + fresh projects.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS access_paused BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS access_paused_at TIMESTAMPTZ;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS access_paused_reason TEXT;

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
  parent_item_id UUID REFERENCES list_items(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_lists_ws_sort
  ON workspace_lists (workspace_id, pinned DESC, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_list_items_list_sort ON list_items (list_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_list_items_list_parent_sort
  ON list_items (list_id, parent_item_id, sort_order ASC);
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_lists') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_lists;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'list_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE list_items;
  END IF;
END $$;

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

-- ============================================================
-- End of Milestone 1 activation additions
-- ============================================================
