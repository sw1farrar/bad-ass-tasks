# AGENT-64-SCHEMA-RPC-PROPOSAL

**To:** Agent 44 (Architect & Primary Supervisor)  
**From:** Agent 64: Schema & RPC Alignment Agent  
**Date:** 2026-05-25 (PT)  
**Wave 8 Governance:** Full adherence to Critical Rule (exhaustive diagnostic/audit only; zero code edits, zero search_replace, zero user instructions to run SQL). Proposal submitted exclusively for Supervisor review and explicit authorization before any action. Phase 1 (Live Supabase) priority per WAVE8-MASTER-PLAN Iron Rule.

**Charter Executed:** Deep audit of `supabase/schema.sql`, all RPC functions (create_workspace_for_user, update_workspace_details, invite RPCs, delete_workspace_for_owner, helpers), RLS policies, recent additions (workspace_invites, notifications, activity_logs), cross-referenced against hybridStore.ts calls, useTaskStore.ts bootstrap, types/*, and supporting code. Identification of objects defined in code/schema but potentially missing/incorrect on a typical live Supabase project, gaps in RPCs for Phase 1 (workspace management, invites, member roles), and exact recommended SQL to bring a live project fully in sync.

---

## Executive Summary

The current `supabase/schema.sql` (~558 lines, confirmed complete via chunked reads ending at notifications section) is production-grade and largely aligned with the vision for Phase 1 Live Supabase activation (workspaces, teams, invites, realtime, notifications). However, there are **critical mismatches** between the schema, TypeScript definitions (types/supabase.ts), and runtime expectations in the hybrid data layer (lib/data/hybridStore.ts + store/useTaskStore.ts).

**Primary Findings:**
- 4 key RPCs + 1 helper defined in schema (all SECURITY DEFINER with server-side role/permission enforcement).
- **1 critical RPC completely absent** from schema.sql and types/supabase.ts: `update_workspace_details` (actively called by hybridStore.updateWorkspace at line 1783 for owner-safe name/slug updates; introduced in Wave 7 as a fix for PGRST116/RLS/auth-context issues).
- Recent tables (workspace_invites ~line 345, notifications ~line 512, activity_logs ~line 130) fully defined with indexes, RLS, and comments, but realtime publication exists **only as non-executable comments** (no consolidated ALTER PUBLICATION DDL).
- Types drift: `types/supabase.ts` Functions section (lines 291-314) includes only 3 RPCs (missing `delete_workspace_for_owner` and the absent update one); some tables (e.g., profiles, comments) incomplete or absent in the provided types.
- Code call sites confirmed: `create_workspace_for_user` (useTaskStore.ts ~lines 968 in ensureUserHasWorkspace and ~1038 in createWorkspace), invite RPCs and update/delete in hybridStore.ts, direct table ops for members/invites/notifs/activity/comments (guarded).
- No other .sql / migration files exist in the workspace (confirmed via list_dir + targeted greps across **/*.{sql,diff,txt,md} and source globs). `supabase/schema.sql` is the sole canonical source.
- RLS is comprehensive and uses the non-recursive `is_workspace_member` helper (lines 177-190). Recent tables have appropriate owner/admin or self-only policies.
- Realtime in code (hybridStore.ts ~1836-1904): only `postgres_changes` on tasks + notes per workspace. Presence stub present. Master Plan and handoffs require broader publication (tasks, notes, workspace_*, invites, activity_logs, notifications, members, comments).

**Impact on Phase 1 (Live Supabase):** A fresh or partially-migrated live Supabase project will hit runtime errors (e.g., PGRST205 "Could not find the table 'public.workspace_invites'" as documented in prior memory/sessions; similar for missing RPCs on workspace rename/settings flows; incomplete realtime for collab/notifs). Past one-off fixes (e.g., profiles relationships for embeds in getWorkspaceMembers/getComments) are not captured in schema.sql for reproducibility.

**Recommendation:** Supervisor review and explicit authorization to apply the exact ordered sync SQL below on the user's live Supabase project (as the activation step for Agent 45 / Phase 1 milestone). This is additive/idempotent where possible (CREATE OR REPLACE, comments for pub). No changes performed by Agent 64.

---

## Current State Analysis

### 1. Schema.sql Overview (Full Audit via Chunked Reads: lines 1-300, 301-558; end confirmed empty at offset 559)
- **Extensions & Enums** (lines 7-16): uuid-ossp, pg_trgm; user_role, task_priority, task_status.
- **Core Tables** (lines 22-139): 
  - workspaces (owner_id FK to auth.users, slug UNIQUE, settings JSONB)
  - workspace_members (composite PK, role, invited_by)
  - profiles (id PK to auth.users; **notification_prefs JSONB** with full structure for email/inApp/types/perWorkspace — recent addition support)
  - tasks (rich: assignee_ids[], recurring_rule, exception_dates[], linked_note_ids[], time_*, parent_task_id)
  - notes (content JSONB for TipTap, linked_task_ids[], parent_note_id, is_archived)
  - comments (task_id XOR note_id CHECK, parent_comment_id for threads)
  - activity_logs (append-only, metadata JSONB)
- **Indexes** (lines 145-157): workspace-scoped, GIN for arrays (assignee_ids, tags, exception_dates), GIN tsvector for title search, activity by (ws, created_at DESC).
- **RLS** (lines 163-274): ENABLED on workspaces, workspace_members, profiles, tasks, notes, comments, activity_logs (invites/notifs have their own ALTER later). Heavy use of `is_workspace_member(ws_id, uid)` helper (SECURITY DEFINER, lines 177-190 — critical non-recursive pattern).
  - Detailed policies (see RLS section below).
- **Triggers** (lines 280-295): update_updated_at_column() on workspaces, tasks, notes only (no equivalent yet on invites/notifs/comments in schema).
- **Recent Additions (Phase 2 Collab + Agent 31 Notifs)**:
  - workspace_invites (lines 345-354): id, ws_id FK, email (optional), role, invited_by, expires_at (14d default), accepted_at. Indexes (ws, created_at). RLS + 2 RPCs.
  - notifications (lines 512-524): id, ws_id, user_id (recipient), type (CHECK: mention/comment/invite/task_assigned/deadline/activity), title/message/link, activity_log_id FK, metadata JSONB, read_at. Indexes (user+created, ws+created, partial unread). RLS + comment for realtime.
  - activity_logs already in core.
- **RPCs & Helpers** (detailed below): create_workspace_for_user (301-325), create/accept_workspace_invite (377-440), delete_workspace_for_owner (480-501), is_workspace_member (177-190).
- **Realtime Notes** (comments only, lines 446-449, 509/556): Recommend `ALTER PUBLICATION supabase_realtime ADD TABLE tasks, notes, workspace_members, workspace_invites, activity_logs;` + notifications. **No executable DDL in file.**
- **Workspace Settings Section** (lines 452-503): Owner update/delete policies + delete RPC. (Update RPC absent.)
- **No other objects** (no views, no additional triggers/indexes for recent tables beyond listed, no publication creation).

**Exact Line References for Key Objects (from reads):**
- create_workspace_for_user: 301-325
- create_workspace_invite: 377-407
- accept_workspace_invite: 409-440
- delete_workspace_for_owner: 480-501
- workspace_invites table + policy + RPCs: 345-442
- notifications table + policy + realtime comment: 512-557
- is_workspace_member helper + core RLS: 177-274

### 2. RPC Function Definitions (Deep Audit — audit-specific-rpcs todo)
All privileged ops use SECURITY DEFINER + SET search_path = public + explicit role checks from workspace_members (prevents RLS/auth context issues like prior PGRST116).

**Defined in schema.sql:**
1. `create_workspace_for_user(user_id UUID, workspace_name TEXT, workspace_slug TEXT) RETURNS UUID` (301-325)
   - Inserts workspace (owner_id = user_id)
   - Inserts owner membership
   - Upserts profile from auth.users raw_user_meta_data (ON CONFLICT DO NOTHING)
   - Matches code call sites exactly (see below).

2. `create_workspace_invite(p_workspace_id UUID, p_email TEXT DEFAULT NULL, p_role user_role DEFAULT 'user') RETURNS UUID` (377-407)
   - Checks caller is owner/admin in workspace_members
   - Raises exception on insufficient perms
   - Inserts into workspace_invites (invited_by = auth.uid())

3. `accept_workspace_invite(p_invite_id UUID) RETURNS UUID` (409-440)
   - Validates not accepted + not expired
   - Inserts membership (ON CONFLICT DO NOTHING, role from invite)
   - Marks accepted_at = NOW()
   - Returns ws_id

4. `delete_workspace_for_owner(p_workspace_id UUID) RETURNS BOOLEAN` (480-501)
   - Checks caller role == 'owner'
   - DELETE FROM workspaces (cascades via FKs)
   - Hybrid has fallback to direct delete.

5. `is_workspace_member(ws_id UUID, uid UUID) RETURNS BOOLEAN` (177-190) — helper used by RLS.

**Absent from schema.sql (and types/supabase.ts Functions):**
- `update_workspace_details(p_workspace_id UUID, p_name TEXT DEFAULT NULL, p_slug TEXT DEFAULT NULL)` — **Critical gap**. Called in production paths.

**In types/supabase.ts (lines 291-314, confirmed via grep + reads 280-323):**
- Functions: only create_workspace_for_user, create_workspace_invite, accept_workspace_invite (Returns string for all).
- Missing: delete_workspace_for_owner, update_workspace_details, is_workspace_member.
- Tables coverage: workspaces/tasks/notes/workspace_members/workspace_invites/notifications/activity (good for recent); profiles/comments incomplete in the file.

**Code Call Sites (hybridStore + useTaskStore cross-ref, from full file reads + targeted greps):**
- `create_workspace_for_user`: 
  - store/useTaskStore.ts:968 (inside ensureUserHasWorkspace, post-auth bootstrap for new users)
  - store/useTaskStore.ts:1038 (inside createWorkspace action for additional real workspaces)
  - Payload: { user_id, workspace_name, workspace_slug }
  - Followed by fetchUserWorkspaces + initializeFromSupabase (authoritative sync).
- `update_workspace_details`:
  - lib/data/hybridStore.ts:1783 (in updateWorkspace): `await supabase.rpc('update_workspace_details', { p_workspace_id, p_name: trimmed or null, p_slug: trimmed or null })`
  - Store action: updateWorkspaceDetails (declared 200; wired to hybrid).
- `create_workspace_invite` / `accept_workspace_invite`:
  - lib/data/hybridStore.ts:1615 (createInvite), 1640 (acceptInvite)
  - Used by store: sendInvite (194), acceptInviteLink (195), etc.
- `delete_workspace_for_owner`:
  - lib/data/hybridStore.ts:1809 (in deleteWorkspace, with try/fallback to direct .from("workspaces").delete())
- Direct (RLS-protected) for members/invites: getWorkspaceMembers (1558), getWorkspaceInvites (1584), updateMemberRole (1668), removeMember (1693), revokeInvite (1719).
- Notifications/activity/comments: full guarded CRUD in hybrid (e.g. getUserNotifications 1238, createNotification 1293, logActivity 1163, getComments 1424, createComment 1469 with mention extraction + createNotification fanout).
- Realtime: subscribeToWorkspaceRealtime (1836) — only tasks/notes postgres_changes channels. No subs on invites/notifs/activity/members/comments in current code (optimistic + broadcast for some).

**useTaskStore Workspace Bootstrap (key for Phase 1 auth/teams):**
- fetchUserWorkspaces, ensureUserHasWorkspace, createWorkspace, updateWorkspaceDetails, deleteCurrentWorkspace, fetchMembers/fetchInvites, setupWorkspaceRealtime (wires subs + presence after switch).
- Strong guards against demo IDs ("w1"/"w2"), empty UUIDs (prevents 22P02 errors), offline skips.
- Authoritative currentWorkspace sync from fresh list.

### 3. RLS Policies (Exhaustive from schema reads)
- Core helper + policies for profiles (own view/update), workspaces (member SELECT), members (self or fellow members), tasks/notes (member ALL), comments (member via join to task/note ws), activity (member SELECT + INSERT for own actions).
- workspace_invites (345-371): "Admins and owners can manage invites..." (role IN owner/admin).
- notifications (532-551): own SELECT/UPDATE; INSERT by any ws member targeting a peer member in same ws.
- No policies on some (e.g., no explicit for profiles in all cases; relies on auth).
- All use auth.uid() + EXISTS subqueries (no recursion thanks to helper).
- Recent tables have ENABLE ROW LEVEL SECURITY.

### 4. Other Findings (find-other-sql, analyze-code-vs-schema, gap prep)
- **No other SQL sources**: Confirmed via list_dir (only supabase/schema.sql), greps for "CREATE (TABLE|FUNCTION|POLICY|TRIGGER)" across globs **/*.{sql,diff,txt,md} and source — only hits in schema.sql + handoff .md files (which reference it). No migrations/ seeds in lib/data or elsewhere.
- **Types vs Schema/Code**: Domain types (types/index.ts) align well (WorkspaceInvite, WorkspaceMember, Notification, ActivityLog, Comment match schema columns). DB types (supabase.ts) cover recent tables but lag on full RPCs and some relationships (profiles/comments for embeds used in hybrid getWorkspaceMembers 1560, getComments 1426 — `*, profiles(...)`).
- **Hybrid Guards**: Every public export has isSupabaseLive() + demo ID blocks at top (e.g., lines 529, 578, 1144, 1551, 1577). Offline queue + LWW for tasks/notes. No leakage.
- **Realtime/Publication Gap**: Code only tasks/notes. Master Plan (docs/WAVE8-MASTER-PLAN.md lines 85, 448 in schema comments) requires broader for "workspace_*, invites, activity_logs, notifications, members, comments".
- **Past Context (memory + handoffs)**: PGRST205 for workspace_invites exactly matches "defined in schema but never created on live". Notifications schema noted as pending in Wave 7. Agent 31 handoff (AGENT-31-NOTIFICATIONS-HANDOFF.md) and SupabaseSetupBanner emphasize running full schema.sql.
- **Other Docs Surfaced (broad grep)**: Existing proposals (e.g., docs/AGENT-PHASE1-SUPABASE-ACTIVATION-PROPOSAL.md, AGENT-65-REALTIME-PROPOSAL.md) independently identified the same update_workspace_details + realtime gaps and provided draft SQL. My audit independently confirms and expands with exact line numbers + full cross-refs.

**Objects Defined in Code/Schema but Potentially Absent/Incorrect on Live Supabase Project:**
- All recent tables (workspace_invites, notifications) + supporting indexes/RLS/RPCs.
- RPCs: create_workspace_invite, accept_workspace_invite, delete_workspace_for_owner, create_workspace_for_user (and the missing update one).
- Realtime publication entries for non-task/note tables.
- Potential: profiles/comments FKs/relationships for PostgREST embeds (past one-off fixes not in schema).

**Gaps in RPCs for Phase 1 (workspace mgmt, invites, member roles):**
- Missing `update_workspace_details` (highest priority — blocks reliable owner settings/rename in live; direct UPDATE was fragile per Wave 7).
- No RPC for member role changes or remove (current hybrid uses direct .update/.delete — works under RLS but RPC preferred for consistency/enforcement like others).
- Realtime gaps limit live invites/notifs/activity presence.
- No dedicated RPCs yet for notification prefs updates or bulk activity (scaffolded in hybrid).

---

## Exact Ordered SQL Script(s) with Explanations

**Script Purpose:** Bring a typical live Supabase project (fresh or partial schema run) fully in sync with current code expectations + Master Plan for Phase 1. Run **once** in Supabase SQL Editor (as project owner or via service_role for safety on DDL).

**Order Rationale (critical for dependencies/RLS/realtime):**
1. Ensure/update core RPCs (including the missing one) — functions are independent.
2. Consolidated, idempotent realtime publication block (covers full required set per Master Plan + code/comments).
3. Optional alignment for past fixes (profiles relationships for embeds used in hybrid).
4. Post-DDL reload + verification.

**Full Copy-Paste Ready Sync Block** (safe to re-run; uses OR REPLACE / DO blocks):

```sql
-- ============================================
-- AGENT-64 PHASE 1 SCHEMA & RPC SYNC (for live Supabase activation)
-- Run in Supabase SQL Editor after .env.local is set.
-- Idempotent where possible. Follow with app verification.
-- ============================================

-- 1. THE CRITICAL MISSING RPC: update_workspace_details
--    (Called by lib/data/hybridStore.ts:1783 updateWorkspace + store updateWorkspaceDetails.
--     Owner-only, SECURITY DEFINER (consistent with delete/invite RPCs).
--     Handles partial updates via COALESCE. Updates updated_at via trigger (already present on workspaces).
--     Prevents direct UPDATE RLS/auth issues from Wave 7.)
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
  -- Owner-only enforcement (server-side, matches delete_workspace_for_owner pattern at schema:489)
  SELECT role INTO v_caller_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'Only the workspace owner may update details';
  END IF;

  -- Partial update (name and/or slug); slug must still satisfy UNIQUE (app/UI should validate)
  UPDATE workspaces
  SET 
    name = COALESCE(p_name, name),
    slug = COALESCE(p_slug, slug)
    -- updated_at auto via existing trigger (line 288)
  WHERE id = p_workspace_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION update_workspace_details IS 
  'Owner-only workspace name/slug update via RPC (Wave 7 fix for RLS/auth context/PGRST116). Use exclusively from hybridStore.updateWorkspace. Matches call signature at hybridStore:1783.';

-- 2. RECREATE/ENSURE OTHER KEY RPCs (safe OR REPLACE; base schema already has them but ensures sync)
-- (Omitted full bodies for brevity in this proposal — copy from current supabase/schema.sql lines 301-325, 377-440, 480-501 if your live project is partial or out-of-date. Re-running CREATE OR REPLACE is harmless.)

-- 3. CONSOLIDATED REALTIME PUBLICATION (executable, safe, per Master Plan + schema comments + hybrid realtime needs)
--    Current code: postgres_changes only on tasks/notes (hybridStore:1863-1903).
--    Required for full Phase 1 (invites for teams, notifs/activity for Agent 31/49, members/comments for collab).
--    Use DO block to ignore duplicates on re-run.
DO $$
BEGIN
  -- Add core workspace-scoped tables for live updates (tasks/notes already primary in code)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notes;
  END IF;

  -- Phase 1 collab / invites / notifs / activity (per schema comments 447/509/556 + Master Plan)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_invites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_invites;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'activity_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;

  -- Comments for full realtime collab (Agent 14/30/49; currently optimistic + broadcast in code)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE comments;
  END IF;

  -- Optional but recommended for presence/profile embeds (if joins used)
  -- IF NOT EXISTS (...) THEN ALTER PUBLICATION supabase_realtime ADD TABLE profiles; END IF;
  -- IF NOT EXISTS (...) THEN ALTER PUBLICATION supabase_realtime ADD TABLE workspaces; END IF;

  RAISE NOTICE 'Realtime publication updated for Phase 1 tables.';
END $$;

-- 4. POST-DDL RELOAD (essential after any schema/RPC/pub changes for PostgREST cache)
NOTIFY pgrst, 'reload schema';

-- 5. OPTIONAL: ALIGN PAST ONE-OFF FIXES FOR EMBEDS (profiles relationships used in hybrid getWorkspaceMembers/getComments)
--    These were applied manually in prior sessions to fix PGRST200/PGRST116 on profile joins.
--    Add only if your live project lacks them (check via \d workspace_members or information_schema).
--    (Safe; no data impact.)
-- ALTER TABLE workspace_members 
--   ADD CONSTRAINT IF NOT EXISTS workspace_members_user_id_profiles_fkey 
--   FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE comments 
--   ADD CONSTRAINT IF NOT EXISTS comments_user_id_profiles_fkey 
--   FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
--
-- NOTIFY pgrst, 'reload schema';

-- End of sync script. Verify below before app testing.
```

**Explanations per Section:**
- Update RPC: Directly addresses the #1 gap. Pattern-matched to existing RPCs (permission check + exception, like delete at 489-495 and invite at 392-398). COALESCE for partial (matches hybrid payload with nulls for unchanged fields). Trigger handles updated_at.
- Realtime Block: Makes the comments in schema (447, 509, 556) executable and complete per Master Plan charter (Agent 45/49). Covers everything referenced in hybridStore realtime + handoffs. DO + IF NOT EXISTS for safety on re-runs.
- Reload: Critical (documented in prior fixes and schema comments).
- FKs: Optional alignment for the embeds actually used in production hybrid code (select with profiles()).

---

## Verification Steps

**Pre-Apply (on live project):**
1. Backup: Supabase dashboard > Database > Backups (or pg_dump if needed).
2. Inspect current state (run in SQL Editor):
   ```sql
   -- RPCs present?
   SELECT proname, proowner, prosecdef FROM pg_proc 
   WHERE proname IN ('create_workspace_for_user', 'update_workspace_details', 'create_workspace_invite', 'accept_workspace_invite', 'delete_workspace_for_owner', 'is_workspace_member')
   ORDER BY proname;

   -- Recent tables?
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name IN ('workspace_invites', 'notifications', 'activity_logs');

   -- Publication status?
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;
   ```
3. Check for errors in app console with live .env (expect PGRST or "function does not exist" for update/details flows).

**Post-Apply:**
1. Re-run the inspection queries above — all RPCs should appear, tables present, publication should list the 7+ tables.
2. `NOTIFY pgrst, 'reload schema';` (or wait 30s).
3. App-side (with live Supabase + real user):
   - Sign in / ensureUserHasWorkspace → creates via RPC (no errors).
   - Create additional workspace via UI → succeeds, appears in switcher.
   - Update workspace details (rename/slug in settings/Teams) → succeeds (tests the new RPC).
   - Send invite (as owner/admin) → create_workspace_invite succeeds, invite appears in list.
   - Accept invite (different user/browser) → succeeds, membership created, ws accessible.
   - Delete workspace (owner) → succeeds (tests delete RPC + cascades).
   - Realtime: Changes to tasks/notes (and now invites/notifs if wired) propagate across tabs/clients. Check for "SUBSCRIBED" logs.
   - Notifications: Create events (mentions, comments, invites) → appear in bell, unread count, realtime if subscribed.
   - No PGRST205/116/200 errors. Activity logs populate.
   - Offline queue + LWW still works when toggling connectivity.
4. Run `npm run typecheck` (or equivalent) — no new errors from types (note: may need follow-up types update for full RPCs).
5. Full E2E: Multi-user teams flow end-to-end (invite → accept → collab → notif → activity).

**Success Criteria (per Master Plan Agent 45):** Real Supabase project works for workspaces/invites/members/roles/notifs/realtime; banner dismissible; demo pristine; no critical errors.

---

## Risks & Mitigations

- **RPC/Auth Context:** SECURITY DEFINER functions execute with definer privileges but `auth.uid()` still reflects the caller (standard Supabase pattern; used successfully in existing RPCs). Test with real authenticated sessions.
- **Slug Uniqueness on Update:** If COALESCE sets a conflicting slug, UPDATE fails (constraint). Mitigation: UI validation + unique error handling in hybrid (already robust error paths).
- **Realtime Pub Duplicates/Errors:** DO + EXISTS checks mitigate; Supabase ignores some dups gracefully. Re-run safe.
- **Partial Schema on Live:** Script is additive. If tables/RPCs partially present, OR REPLACE / IF NOT handles. Always inspect first (verification step 2).
- **PostgREST Cache:** Forgetting NOTIFY can cause "could not find" errors for hours. Always include + advise manual reload in dashboard if needed.
- **Data Safety:** All operations are non-destructive (no DROP). Cascades on delete are intentional (FKs). Backup recommended.
- **Types Drift Follow-up:** After SQL apply, a future hygiene agent (e.g. Agent 69) should regen or manually extend types/supabase.ts Functions + missing tables for full TS safety. Not blocking for runtime.
- **Comments Realtime:** Adding to pub enables postgres_changes; current code may still use optimistic/broadcast for comments (non-breaking).
- **FK Alignment (optional section):** Only if embeds fail post-apply. Test hybrid getWorkspaceMembers/getComments first.
- **Production:** Run in staging first if possible. Monitor for new RLS violations (use Supabase logs).
- **No Impact on Demo:** All paths remain guarded; demo never touches these RPCs/tables.

**Overall Risk:** Low for additive sync on a standard project. Highest value: unblocks Phase 1 workspace/teams/realtime/notifs flows.

---

## References & Audit Trail (Internal to Proposal)

- **Schema:** C:\Grok Build Projects\bad ass tasks\supabase\schema.sql (full reads + greps for CREATE FUNCTION/POLICY/TABLE, specific RPCs, realtime comments, recent tables).
- **Hybrid Core:** C:\Grok Build Projects\bad ass tasks\lib\data\hybridStore.ts (full read in chunks to line ~2124; RPC calls at 1615, 1640, 1783, 1809; realtime 1836; notifications/activity/invites/members 1208-1600+; guards everywhere).
- **Store Bootstrap:** C:\Grok Build Projects\bad ass tasks\store\useTaskStore.ts (imports of RPC wrappers + actions; create_workspace_for_user calls at 968/1038; workspace functions 880+).
- **Types:** C:\Grok Build Projects\bad ass tasks\types\supabase.ts (Functions section 291-314 incomplete; tables coverage); types/index.ts (domain models aligned).
- **Clients:** lib/supabase/client.ts (isSupabaseConfigured + typed client).
- **UI/Setup:** components/SupabaseSetupBanner.tsx (instructions reference schema.sql); app/page.tsx (orchestration); AGENT-31-NOTIFICATIONS-HANDOFF.md (notifs schema context).
- **Governance:** docs/WAVE8-MASTER-PLAN.md (Iron Rule, Agent 45 charter, Agent 64 launch at 227, proposal requirement); memory sessions (PGRST205 history, Phase 1 priority).
- **Broad Searches:** Multiple list_dir (root, supabase, lib, store, types, components, docs, app); 10+ greps (hybridStore/rpc patterns, specific functions, CREATE statements, realtime, other sql, instructions files — no AGENTS.md/Claude.md found in workspace).
- **Cross-Refs:** Existing Wave 8 proposals in docs/ (e.g., AGENT-PHASE1-SUPABASE-ACTIVATION-PROPOSAL.md, AGENT-65-REALTIME-PROPOSAL.md) independently surfaced identical gaps + draft SQL; my audit provides independent verification with precise line numbers and code call sites.

---

**Proposal Complete.** All work was diagnostic/audit-only per Critical Rule. No files outside this proposal document were modified. No SQL was suggested to the user.

**Next Step Recommendation to Supervisor (Agent 44):** Review this proposal for alignment with WAVE8-MASTER-PLAN Phase 1. If approved, authorize execution of the provided sync SQL on the user's live Supabase project (as the enabling step for full workspace/invites/roles/notifs/realtime activation). Upon verification milestone, unlock downstream agents and update the Master Plan.

Ready for your direction, Agent 44.

*Agent 64 — Schema & RPC Alignment — reporting exclusively through governance.*
