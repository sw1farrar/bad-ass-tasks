# Milestone 1 — Live Supabase Activation

**Status**: Ready for execution (post M0 hygiene baseline restoration)  
**Priority**: NON-NEGOTIABLE FIRST per WAVE8-MASTER-PLAN Iron Rule  
**Owner**: User (under Agent 44 governance)  
**Goal**: Turn the prototype into a real multi-user, realtime, persistent app while keeping demo mode 100% pristine.

---

## Why This Milestone Matters

Until a real Supabase project is connected and verified:
- Everything runs in local/demo mode only (`w1` / `w2` workspaces).
- No real auth, no cross-device sync, no teams/invites, limited realtime.
- All downstream work (deep Notes, AI/Graph, advanced views, production hardening) is blocked by the Iron Rule.

Success criteria (from Master Plan):
- Real Supabase project works end-to-end for teams.
- Banner can be permanently dismissed for live users.
- All features (tasks, notes, editor, graph, AI, collab) function seamlessly in live multi-user mode.
- Demo mode remains completely untouched and perfect.
- Full offline queue + LWW + conflict resolution battle-tested on real data.

---

## Prerequisites

1. You have the app running locally (`npm run dev` → http://localhost:3000).
2. You have a Supabase account (free tier is perfect).
3. You have completed the recent TS hygiene pass (0 TypeScript errors).

---

## Step-by-Step Activation

### 1. Create a Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Choose a name (e.g. `bad-ass-tasks-prod` or `bad-ass-tasks-dev`)
4. Set a strong database password (save it somewhere safe)
5. Choose a region close to you
6. Wait for the project to provision (~1-2 minutes)

### 2. Get Your Connection Details

In your new Supabase project, go to:

**Settings → API**

Copy these two values:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Create `.env.local`

In the root of `Bad Ass Tasks/` create a file named `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important**: Never commit this file.

Restart your dev server after creating/editing `.env.local`.

### 4. Run the Schema + Activation SQL (Critical)

In your Supabase dashboard, go to **SQL Editor** → **New query**.

Copy and paste the **entire block below**, then click **Run**.

```sql
-- ============================================================
-- MILESTONE 1: BAD ASS TASKS — FULL ACTIVATION SCRIPT
-- Run this in Supabase SQL Editor (as project owner)
-- Safe to re-run. Idempotent where possible.
-- ============================================================

-- 1. Core schema (the big one)
-- If you have not run the main schema yet, run this first:
\i supabase/schema.sql

-- (If the above \i doesn't work in the web editor, manually paste the entire contents of supabase/schema.sql first.)

-- 2. THE CRITICAL MISSING RPC (Wave 7 fix - update_workspace_details)
-- Called by hybridStore.updateWorkspace for reliable owner name/slug changes.
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
  -- Owner-only enforcement
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
  'Owner-only workspace name/slug update via RPC (Wave 7 fix). Use from hybridStore.';

-- 3. CONSOLIDATED REALTIME PUBLICATION (full Phase 1 set)
-- Covers tasks, notes, members, invites, activity, notifications, comments
DO $$
BEGIN
  -- Core tables
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notes;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_members;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_invites') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_invites;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'activity_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE comments;
  END IF;

  RAISE NOTICE 'Realtime publication updated for full Phase 1 tables.';
END $$;

-- 4. Important replica identity for reliable DELETEs in realtime (especially notifications & invites)
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE workspace_invites REPLICA IDENTITY FULL;

-- 5. Force PostgREST to reload schema cache (critical)
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- END OF ACTIVATION SCRIPT
-- ============================================================
```

**After running**, you should see notices and no fatal errors.

### 5. Verify in the App

1. Hard refresh the app (or restart `npm run dev`).
2. The purple "Supabase Setup" banner should disappear (or show you are now in LIVE mode).
3. Try creating an account (magic link or OAuth).
4. Create a new workspace.
5. Create tasks and notes — they should persist in your Supabase project.
6. Open the app in two different browsers/tabs → changes should appear in realtime.

---

## Verification Checklist (Milestone 1 Gate)

- [ ] `.env.local` present with real keys
- [ ] Schema + activation SQL ran without errors
- [ ] `NOTIFY pgrst` reload executed
- [ ] App starts in LIVE mode (no demo banner or banner acknowledges live)
- [ ] Magic link / Google / GitHub sign-in works
- [ ] Can create workspace (uses `create_workspace_for_user` RPC)
- [ ] Can rename workspace (uses new `update_workspace_details` RPC)
- [ ] Realtime works for tasks + notes (cross-tab)
- [ ] Invites can be sent and accepted
- [ ] Notifications appear in real time
- [ ] Offline queue still works when you kill the connection
- [ ] Demo workspaces (`w1`/`w2`) still function perfectly when no `.env.local` is present

---

## Rollback / Safety

- Demo mode is **never** affected by live Supabase keys.
- All hybrid paths have strict `isSupabaseLive()` guards + explicit `["w1", "w2"]` blocks.
- You can always delete `.env.local` to instantly go back to pure demo.

---

## Next After This Milestone

Once the checklist above is fully green and signed off:

- Agent 44 will record Milestone 1 completion.
- Work on Phase 2 (Deep Notes + bidirectional task/note linking) becomes unlocked.

---

**This document + the SQL block above is the authoritative activation package for Milestone 1.**

Run the script, test the flows, and report back with results. We will then close the milestone gate properly.