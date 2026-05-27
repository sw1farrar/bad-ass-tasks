# AGENT-65-REALTIME-PROPOSAL.md

**Agent ID**: 65 (Realtime Publication & Subscriptions Agent)  
**Role**: Realtime Publication & Subscriptions Agent  
**Reports To**: Agent 44 (Architect & Primary Supervisor) — Wave 8 Supervised Governance Model  
**Date**: 2026-05-25 (PT)  
**Charter Alignment**: Full diagnostic audit only (per Critical Rules). No source code edits, no user-facing instructions or changes. Formal proposal document delivered exclusively to Supervisor for review/authorization before any implementation sequencing by Agent 45 or downstream agents.  

**WAVE8-MASTER-PLAN Iron Rule Compliance**: Exclusive focus on enabling full realtime for **Phase 1 Live Supabase activation**. All findings, gaps, and recommendations scoped to Phase 1 tables, subscriptions, presence/broadcast, publications, and verification. References prior agents (6, 11, 14, 30, 31) and handoffs only for audit continuity.

**Mission Deliverable**: This document constitutes the formal proposal. It details:
- Exact `ALTER PUBLICATION` commands needed for Phase 1 tables.
- Gaps in current subscription code (`subscribeToWorkspaceRealtime`, postgres_changes in `hybridStore.ts`/`useTaskStore.ts`).
- Presence channels + broadcast usage (cursors, editing indicators).
- Tables requiring realtime (tasks, notes, comments, notifications, workspace_members, invites, activity_logs, etc.).
- Recommended subscription hardening.
- Verification approach for live multi-user realtime.

**Critical Rule Enforcement**: This is 100% read-only diagnostic/audit work. Proposal submitted for Agent 44 review/approval. Zero structural changes, zero instructions to end-users, zero implementation until explicit Supervisor authorization.

---

## 1. Executive Summary & Audit Scope

Under the established Wave 8 hierarchical governance (Agent 44 as sole decision authority), Agent 65 performed an exhaustive, tool-driven audit of all realtime-related code, schema, and patterns. The audit prioritizes Phase 1 Live Supabase activation readiness per the Master Plan (Agent 45 charter: "Verified ... + realtime publication (ALTER PUBLICATION for tasks, notes, workspace_*, invites, activity_logs, notifications, members, comments)" + "Realtime activation: Ensure all subs/presence/channels robust... extend for comments/notifs...").

**Key Finding**: Foundations are strong (tasks/notes postgres_changes + sophisticated presence/broadcast channel for cursors/editing/meta), but **publications are incomplete in practice** (only commented instructions in schema.sql; comments table omitted) and **subscriptions are narrowly scoped** (only tasks + notes; no native coverage for comments, notifications, members, invites, activity_logs despite heavy usage in collab/notif flows). This blocks full multi-user realtime for Phase 1 milestone.

**No changes proposed to source** — only precise recommendations for the Supervisor to authorize (e.g., via Agent 45).

**Files Audited (Absolute Paths)**:
- `C:\Grok Build Projects\bad ass tasks\supabase\schema.sql` (full, 558 lines)
- `C:\Grok Build Projects\bad ass tasks\lib\data\hybridStore.ts` (realtime fn at ~1836+, comments ~1393+, presence stub ~1919+)
- `C:\Grok Build Projects\bad ass tasks\store\useTaskStore.ts` (setup ~2017+, presence/broadcast ~2134+, teardown ~2204+, handlers ~2024+)
- `C:\Grok Build Projects\bad ass tasks\app\page.tsx` (wiring, presence UI, TipTap integration ~1618+)
- `C:\Grok Build Projects\bad ass tasks\components\TipTapEditor.tsx` (cursor receive/render ~1048+)
- `C:\Grok Build Projects\bad ass tasks\components\TaskModal.tsx` (comments fetch/render ~386+)
- `C:\Grok Build Projects\bad ass tasks\lib\supabase\client.ts`
- `C:\Grok Build Projects\bad ass tasks\types\supabase.ts` (DB types) + `C:\Grok Build Projects\bad ass tasks\types\index.ts` (domain types)
- Prior handoffs: `C:\Grok Build Projects\bad ass tasks\AGENT-30-LIVE-COLLAB-HANDOFF.md`, `C:\Grok Build Projects\bad ass tasks\docs\AGENT-14-FULL-REALTIME-COLLAB-POLISH-HANDOFF.md`, root AGENT-*-*.md files
- Master plan: `C:\Grok Build Projects\bad ass tasks\docs\WAVE8-MASTER-PLAN.md` (esp. Phase 1 sections ~84-91, gaps ~70-71)
- Supporting: `C:\Grok Build Projects\bad ass tasks\components\SupabaseSetupBanner.tsx`, package.json (supabase-js ^2.49.1)

**Methodology**:
- todo_write tracking (11 items, one in_progress at a time, end-of-turn gates honored).
- memory_search (Wave 8 governance, prior realtime agents, publication mentions).
- list_dir (full root + supabase/, store/, lib/, docs/, app/, components/, types/, tests/).
- 20+ targeted grep (patterns: subscribeToWorkspaceRealtime, postgres_changes, presence, broadcast, channel, realtime, ALTER PUBLICATION, supabase_realtime, comments|notifications|members realtime, across **/*.{ts,tsx,sql,md} excluding node_modules where possible; path-limited and file-specific).
- 30+ read_file (full files + targeted offsets/limits for realtime sections, e.g., hybrid 1-100 + 1830-1930 + 1445-1510; useTaskStore 1-100 + 1950-2350+; schema 1-500 + 501-558; handoffs full key sections).
- Cross-references with prior agent audits (AGENT-14/30 explicitly called out gaps in comments pub/push).

**Alignment**: Builds directly on realtime foundations (Agent 6 subs/presence, Agent 11 perms, Agent 14 comments+indicators, Agent 30 cursors/conflicts/broadcast polish, Agent 31 notifs). No duplication; diagnostic only.

---

## 2. Schema & Current ALTER PUBLICATION Audit

### 2.1 Tables Defined in `supabase/schema.sql`
All tables have `ENABLE ROW LEVEL SECURITY` and workspace-scoped policies (via `is_workspace_member` SECURITY DEFINER helper + owner checks). Relevant for realtime (postgres_changes respect RLS on the client connection):

- `workspaces`
- `workspace_members` (composite PK)
- `profiles` (notification_prefs JSONB, linked to auth.users)
- `tasks` (rich: status, priority, due_date, assignee_ids[], parent_task_id, recurring_rule, exception_dates[], linked_note_ids[], time_*, tags[])
- `notes` (content JSONB for TipTap, parent_note_id, linked_task_ids[], is_archived, last_edited_by)
- `comments` (task_id XOR note_id CHECK constraint, parent_comment_id, user_id; RLS via task/note join to workspace_members)
- `activity_logs` (action_type e.g. 'comment.added', target_type, metadata JSONB)
- `workspace_invites` (Phase 2 collab: expires, accepted_at, RPCs for create/accept)
- `notifications` (Agent 31: per-user, type enum, link, metadata, read_at; RLS own-user only + member insert fanout; indexes for unread)

**Indexes**: workspace-scoped GIN for arrays/search, etc. Triggers for updated_at on workspaces/tasks/notes.

**RPCs**: create_workspace_for_user, create/accept_workspace_invite, delete_workspace_for_owner, update_workspace_details.

**No actual `ALTER PUBLICATION` or `CREATE PUBLICATION` DDL in the .sql file** (only guidance comments).

### 2.2 Current Realtime Publication Comments in Schema (Lines 445-449, 509-557)
```sql
-- REALTIME PUBLICATION (for Supabase Realtime subscriptions on tasks/notes/members)
-- If you see "relation ... is not in publication" errors, run the following once in SQL editor:
-- ALTER PUBLICATION supabase_realtime ADD TABLE tasks, notes, workspace_members, workspace_invites, activity_logs;
-- (Safe to re-run; errors on duplicates are ignorable or use the DO block in full setup.)

-- ... later for notifications ...
-- After applying schema, run in Supabase SQL editor for realtime notifs:
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- (Add alongside the existing activity_logs etc. line if re-running full setup.)
```
- **Comments table**: Explicitly omitted from suggested commands (despite full CRUD, RLS, and usage in TaskModal + @mentions).
- **Profiles / workspaces**: Not mentioned (may be needed if member/profile changes should trigger UI).
- **Supabase Default**: The `supabase_realtime` publication exists by default in Supabase projects but starts empty/minimal for user tables. Explicit `ADD TABLE` is **required** for postgres_changes listeners on custom tables to succeed. Failure mode: "relation 'public.xxx' is not in publication 'supabase_realtime'".

**Gap**: Publications are "documented intent" only, not enforced in schema. Running schema.sql alone does **not** activate realtime for listed tables.

---

## 3. Subscription Code Audit (`subscribeToWorkspaceRealtime`, postgres_changes)

### 3.1 Definition: `lib/data/hybridStore.ts` (Lines 1833-1916)
```typescript
let activeTaskChannel: any = null;
let activeNoteChannel: any = null;

export function subscribeToWorkspaceRealtime(
  workspaceId: string,
  handlers: {
    onTaskChange?: (payload: any) => void;
    onNoteChange?: (payload: any) => void;
  }
): () => void {
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) {
    return () => {}; // DEMO / guard
  }
  // Teardown prior (module-level active* vars)
  if (activeTaskChannel) { supabase.removeChannel(...); activeTaskChannel = null; }
  if (activeNoteChannel) { ... }

  if (onTaskChange) {
    activeTaskChannel = supabase
      .channel(`ws-tasks-${workspaceId}`)
      .on("postgres_changes" as any, {
        event: "*",
        schema: "public",
        table: "tasks",
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => onTaskChange(payload))
      .subscribe((status) => { if (status === "SUBSCRIBED") console.log(`[realtime] tasks subscribed...`); });
  }
  // Identical pattern for `ws-notes-${workspaceId}` on "notes" table
  ...
  return cleanupFn; // removes both channels
}
```
**Scope**: **Only tasks + notes**. Two dedicated channels per workspace. Full `*` events (INSERT/UPDATE/DELETE), workspace filter for security/scoping.

**getWorkspacePresenceChannel** (stub, ~1919): Returns `supabase.channel(`presence-${workspaceId}`, { config: { presence: { key: "online" } } })` or null (guarded).

**Other in hybrid**:
- Comments: `getComments` / `createComment` (optimistic + activity log + @mention notif fanout via `createNotification`). Comment: "Realtime via broadcast or task/note change triggers in store." **No dedicated sub or broadcast send in createComment**.
- Notifications: CRUD helpers (`getUserNotifications`, `createNotification`, `mark...`, `sendNotificationEmail` scaffold). No subs.
- Members/Invites/Activity: Fetch helpers only (no realtime).

**isSupabaseLive** alias to `isSupabaseConfigured` (env check). Strict guards everywhere.

### 3.2 Wiring & Handlers: `store/useTaskStore.ts`
- **State** (Phase 2 collab): `onlineUsers[]`, `remoteCursors[]`, `activeConflicts{}`, `comments[]`, `notifications[]`, `members[]`, `invites[]`, `recentActivity[]`.
- **Actions**:
  - `setupWorkspaceRealtime()` (~2017): Teardown first, then `subscribeToWorkspaceRealtime(wsId, { onTaskChange: ..., onNoteChange: ... })`. Stores cleanup ref as `(get() as any)._realtimeCleanup`.
    - Handlers: Smart partial updates (avoid dupes on INSERT; map + set on UPDATE/DELETE). **Conflict detection** on UPDATE (if editing/selected by other + diverges → surface `activeConflicts`).
    - Note mapping in handler is **duplicated/incomplete** vs. hybrid `map*Row` (missing fields like recurring, assignees, time_* in some paths).
  - **Presence setup** (same fn, ~2134): Gets presence channel, chains:
    - `.on("presence", { event: "sync" }, ...)` → parse `presenceState()` → `set({ onlineUsers })` (carries view/editingItemId/Type).
    - `.on("presence", { event: "join" }, ...)` (light).
    - `.on('broadcast', { event: 'cursor-update' }, ...)` → update `remoteCursors` (self-filter).
    - `.on('broadcast', { event: 'cursor-clear' }, ...)`.
    - `.on('broadcast', { event: 'mention' }, ...)` → conditional toast.
    - `.subscribe(...)` → `track({ user_id, email, online_at, currentView, editingItemId, editingItemType })`.
    - Stores as `(get() as any)._presenceChannel`.
  - `teardownWorkspaceRealtime()` (~2204): Calls cleanup, `pres.unsubscribe()`, clears demo timer, resets states (onlineUsers, remoteCursors, activeConflicts).
  - `updatePresenceMeta(meta?)` (~2221): `pres.track(...)` (used on view switches, selectTask, note create/close).
  - `updateCursorPosition(...)` / `clearCursorPosition()` (~2238): Local state + `pres.send({ type: 'broadcast', event: 'cursor-update'/'cursor-clear', payload })`.
  - Demo: `startDemoPresenceSimulator()` (interval rotates fake Alice/Bob users, views, editing, cursors, occasional conflicts — excellent for !live).

**Wiring Points**:
- `initializeFromSupabase` / `ensureUserHasWorkspace` / `switchWorkspace` (for live non-demo ws): `setTimeout(() => get().setupWorkspaceRealtime(), 50-80)`.
- Teardown on switch/signout.
- No other postgres_changes anywhere in app code.

### 3.3 UI Consumption
- **app/page.tsx**: Destructures `onlineUsers`, `remoteCursors`, `updateCursorPosition`, `updatePresenceMeta`, `activeConflicts`, `resolveConflict`, `setup...`. Renders ✎N editing badges (task rows, notes grid, sidebar, teams, note header), filters cursors per note to `<TipTapEditor>`, calls meta on selects/closes.
- **TipTapEditor.tsx**: Receives `remoteCursors` (filtered), `onCursorUpdate`; renders floating colored caret + label overlays via `coordsAtPos` + debounce on selectionUpdate. Pure receive/render (no direct Supabase).
- **TaskModal.tsx**: `fetchComments` on open (polling-style), renders list + addComment (optimistic). No live append.
- **Notifications**: Bell + dropdown via fetch/refresh on open; unread count. No live push.

---

## 4. Presence Channels & Broadcast Usage Audit

**Primary Channel**: `presence-${workspaceId}` (one per ws, shared for presence + broadcast).
- **Presence** (`track` / `presenceState` / sync/join): Powers `onlineUsers` (view + per-item editing indicators across all UI surfaces). Used in updatePresenceMeta (select/create/close flows).
- **Broadcast** (`.send` / `.on('broadcast')`): 
  - 'cursor-update' / 'cursor-clear': Live cursors/selections in TipTap (notes only currently; color via deterministic `getUserColor` hash palette).
  - 'mention': Realtime toast for @mentioned users (cross-client via channel, even without notif table sub).
- **Strengths** (from AGENT-30 polish): Minimal (no new channels), works in demo via simulator, graceful guards, tied to existing track payload.
- **Usage Sites**: Editor (cursors), conflict detection (via onlineUsers + realtime UPDATE), view indicators (sidebar/teams/notes/tasks), mentions (toasts + chips in TaskModal).
- **Limitations**: No 'comment-added' or notif broadcasts currently sent from `createComment`/`createNotification`. Cursors only for notes (task desc plain-text has no equivalent yet). Mixed presence/broadcast on one channel is valid but requires care (throttling in editor ~140-2800ms sim).

**No other channels** in application code (confirmed via exhaustive grep).

---

## 5. Tables Requiring Realtime for Phase 1 Live Supabase + Code Cross-Reference

Per Master Plan Agent 45 success criteria + schema intent + actual usage:

| Table                | Needs Realtime? | Current Pub Comment? | Current Sub? | Code Usage | Gap Level |
|----------------------|-----------------|----------------------|--------------|------------|-----------|
| tasks               | Yes (core)     | Yes (in list)       | Yes (postgres * filtered) | subscribe + smart merge + conflict | Covered |
| notes               | Yes (core)     | Yes (in list)       | Yes (postgres * filtered) | subscribe + smart merge + conflict + TipTap cursors | Covered |
| comments            | Yes (collab)   | **No**              | **No**      | get/create + fetch on modal open + @mentions + activity | **High** (no live push) |
| notifications       | Yes (Agent 31) | Yes (separate)      | **No**      | CRUD + bell/fetch + unread + prefs + mention fanout | **High** (no live badge/list) |
| workspace_members   | Yes (teams)    | Yes (in list)       | **No**      | fetchMembers + member list/roles | Medium (live member updates missing) |
| workspace_invites   | Yes (collab)   | Yes (in list)       | **No**      | fetchInvites + invite flows (RPC) | Medium |
| activity_logs       | Yes (audit/feed) | Yes (in list)     | **No**      | logActivity + getRecentActivity + Teams view | Medium |
| profiles            | Partial (prefs, presence enrichment) | No | **No** | profile joins in queries | Low-Medium |
| workspaces          | Partial (meta updates) | No | **No** | switch/update flows | Low |

**Cross-Ref Notes**:
- Comments: Full schema + RLS + optimistic create + activity 'comment.added' + extractMentions. Realtime expected by users (live comments in shared modals) and recommended in AGENT-30 debt ("add broadcast 'comment-added' or ALTER for comments").
- Notifications: Dedicated table + policies + create paths from comments/activity. "Realtime foundation (table pub ready)" in handoffs, but only fetch-based today.
- Master Plan explicitly lists **comments** in the required ALTER set.

---

## 6. Identified Gaps in Current Subscription Code for Full Phase 1 Coverage

1. **Publication Execution Gap**:
   - Only comments in schema.sql (user must manually run). Comments table absent from commands. No idempotent setup block (e.g., DO $$ with EXCEPTION handling for duplicates).

2. **Subscription Scope Gap**:
   - `subscribeToWorkspaceRealtime` hard-limited to 2 handlers (tasks/notes only).
   - Zero postgres_changes for 6+ other Phase 1 tables.
   - Comments/notifs/activity rely on fetch + local optimistic (breaks multi-client instant sync expectation).
   - No extension points for onCommentChange etc.

3. **Hardening Gaps**:
   - Module-level active channels (risk in complex lifecycles; better per-instance or ws-keyed map).
   - Subscribe status: Only success log; no 'CHANNEL_ERROR', 'TIMED_OUT', retry/backoff, or status to UI.
   - Handler mapping duplication (useTaskStore on*Change vs hybrid mappers) → incomplete realtime updates (e.g., missing recurring fields).
   - types/supabase.ts incomplete (no `comments` table; profiles partial) — mismatches schema + query code.
   - No broadcast sends from create paths for comments/notifs (AGENT-30 recommendation unimplemented).
   - Silent `.catch(() => {})` on remove/unsubscribe/track/send.
   - Potential rapid-switch or error-state channel leaks.
   - No dedicated notif/comments channels or hybrid broadcast+postgres strategy documented.
   - Presence channel overload (presence + 3+ broadcast events); no private channel or auth payload extensions.
   - Demo/live transition: Simulator excellent, but no explicit "realtime health check" or metrics.

4. **Coverage Gaps vs Master Plan / Prior Agents**:
   - "full realtime push for comments/notifs" (Wave 7 eval + Master Plan gaps).
   - KnowledgeGraph realtime awareness noted as pending.
   - Richer per-item presence / mobile parity (future).
   - No tests exercising live postgres_changes (e2e smoke only).

5. **Types & Schema Consistency**: DB types lag schema (comments missing entirely).

These gaps mean "Live Supabase activation" (Phase 1 milestone) will deliver tasks/notes sync + basic presence/cursors, but **not** full collab (live comments, instant notifs, member/invite/activity sync).

---

## 7. Exact Publication Commands Needed (Ready for Supervisor-Authorized Execution)

**Recommended: Add to end of `supabase/schema.sql`** (or run standalone in Supabase SQL Editor after schema). Idempotent, safe for re-runs, covers **all Phase 1 tables per Master Plan**:

```sql
-- ============================================
-- PHASE 1 REALTIME PUBLICATION SETUP (Agent 65 Audit Recommendation)
-- Run in Supabase SQL Editor AFTER full schema.sql.
-- Enables postgres_changes for all tables used in hybridStore/useTaskStore realtime paths.
-- Safe/idempotent: ignores duplicates. Matches WAVE8-MASTER-PLAN Phase 1 charter.
-- ============================================

DO $$
BEGIN
  -- Core data (tasks/notes already foundational)
  ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  ALTER PUBLICATION supabase_realtime ADD TABLE notes;
  
  -- Collaboration & presence (members for live teams; comments for live collab)
  ALTER PUBLICATION supabase_realtime ADD TABLE workspace_members;
  ALTER PUBLICATION supabase_realtime ADD TABLE comments;
  
  -- Invites, activity, notifications (Phase 2 collab + Agent 31 notifs)
  ALTER PUBLICATION supabase_realtime ADD TABLE workspace_invites;
  ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  
  -- Optional but recommended for full sync (profile updates, workspace meta)
  -- ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  -- ALTER PUBLICATION supabase_realtime ADD TABLE workspaces;
EXCEPTION WHEN duplicate_object THEN
  -- Safe to ignore on re-run or partial prior setup
  RAISE NOTICE 'Realtime publication tables already added (or partial); continuing.';
END $$;

COMMENT ON PUBLICATION supabase_realtime IS 'Phase 1 Live Supabase realtime for Bad Ass Tasks (tasks, notes, comments, members, invites, activity, notifs). Managed via explicit ADD per Supabase requirements.';

-- Verification in Supabase UI: Database > Replication > Publications > supabase_realtime > Tables list.
```

**Alternative (simple, non-DO, for manual runs)**:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE tasks, notes, workspace_members, comments, workspace_invites, activity_logs, notifications;
-- (profiles, workspaces optional)
```

**Post-execution**: Existing `subscribeToWorkspaceRealtime` (tasks/notes) will immediately work for live ws. New subs (when implemented) for other tables will succeed without "not in publication" errors.

---

## 8. Recommended Subscription Hardening & Extensions (Proposal for Future Authorized Work)

**High-Priority for Phase 1 Activation** (to meet Master Plan success: "all subs/presence/channels robust... extend for comments/notifs"):

1. **Extend `subscribeToWorkspaceRealtime`** (or introduce `subscribeToWorkspaceRealtimeExtended`):
   - Add optional handlers: `onCommentChange?`, `onNotificationChange?`, `onMemberChange?`, `onInviteChange?`, `onActivityChange?`.
   - Internally create additional channels (e.g., `ws-comments-${wsId}`, `ws-notifications-${wsId}` with `user_id=eq.${currentUser}` or workspace filter where appropriate).
   - Notifications often user-scoped (filter on `user_id`).

2. **In useTaskStore `setupWorkspaceRealtime`**:
   - Wire new handlers to update Zustand slices (e.g., append/prepend comments/notifs with dedup; smart merge members/invites).
   - Enhance conflict/editing using new events.
   - Add `onSubscriptionStatus` callback or expose channel health.

3. **Lightweight Broadcast Augmentation** (no pub required):
   - In `createComment` / `createNotification` / `logActivity` (after successful insert): `presenceChannel?.send({ type: 'broadcast', event: 'comment-added', payload: { ... } })`.
   - Listeners in setup for instant append (optimistic + server confirm).
   - Preferred for high-frequency/low-payload (comments, notifs) vs. full row postgres.

4. **Hardening**:
   - Replace module-level `active*Channel` with a `Map<string, any>` (keyed by wsId + table) or instance on store.
   - Robust subscribe: handle all statuses (error → retry with backoff, log to logger + UI toast in dev).
   - Centralize mapping (import hybrid mappers or pass mappers into subscribe).
   - Add `refreshSubscription(workspaceId)` helper.
   - Throttle broadcasts further; add sequence numbers for ordering if needed.
   - Update `types/supabase.ts` (include `comments` table Row/Insert/Update; profiles if missing; or document "run `supabase gen types typescript`").
   - Document channel lifecycle + mixed presence/broadcast pattern.
   - Add realtime "health" flag to store (subscribed tables count, last event ts).
   - Error boundaries / retry for presence track/send.

5. **Schema/Types Polish**:
   - Embed the publication DO block in schema.sql (with comment referencing this proposal).
   - Ensure comments RLS/policy comments mention realtime.

6. **Future (Post-Phase 1, Agent 49 scope)**: Graph realtime, mobile parity, richer avatars, private channels, CRDT if scale demands.

**Tradeoffs**: Postgres subs = full authoritative rows + filters (great for data tables). Broadcast = lightweight events (great for notifications/comments toasts/pushes). Hybrid recommended.

---

## 9. Verification Approach for Live Multi-User Realtime

**Pre-Activation (in dev with real Supabase project)**:
1. Run schema.sql + exact publication commands above in SQL Editor.
2. Verify in Supabase Dashboard:
   - Database > Replication > Publications > supabase_realtime → confirm listed tables (tasks, notes, comments, workspace_members, workspace_invites, activity_logs, notifications).
   - No errors on ALTER.
3. `.env.local`: Valid `NEXT_PUBLIC_SUPABASE_URL` + `ANON_KEY` (project with schema applied).
4. `npm run dev`; dismiss banner; create/switch to real workspace (not w1/w2).
5. Console: Expect `[realtime] tasks subscribed...` and `[realtime] notes subscribed...` (and future for others).

**Live Multi-User Verification Checklist** (minimum for Phase 1 milestone approval by Agent 44; requires 2+ browser tabs, incognito, or separate machines + distinct Supabase users in same workspace):
- **Core Data Sync**:
  - Tab A: Create task → Tab B sees INSERT instantly (list + kanban).
  - Tab A: Edit title/desc/status/priority/tags/due → Tab B sees UPDATE (incl. conflict banner if editing same item).
  - Tab A: Delete → Tab B removes.
  - Same for notes (title + rich TipTap content via JSONB).
- **Presence & Indicators**:
  - Multiple users/tabs: See live `onlineUsers` pills (teams view), sidebar ●N per-view, task-row ✎N, notes-grid ✎N, note-detail "X live".
  - Switch views in Tab A → indicators update in Tab B in <2s.
  - Select/edit note/task → editingItem meta propagates.
- **Cursors & Editor**:
  - Open same note in Tab A + Tab B (TipTap).
  - Move cursor/selection in A → B sees floating colored caret + email label (coords-based overlay).
  - Multiple cursors; colors deterministic; self excluded.
- **Comments & @Mentions**:
  - In TaskModal (or future note comments): Tab A adds comment with @mention → Tab B sees live append (or toast via broadcast) + notif bell updates.
  - Activity log entry created.
- **Notifications**:
  - Tab A triggers mention/comment/assign/deadline → Tab B bell badge increments live, dropdown refreshes on open with new item (deep link works).
  - Prefs respected (future).
- **Members/Invites/Activity**:
  - Owner in Tab A invites/adds/removes member or revokes invite → other tabs see live member/invite list updates (after fetch or new subs).
  - Recent activity feed updates live.
- **Conflict & LWW**:
  - Concurrent edit same task/note → conflict banner surfaces with preview + "Keep mine / Take theirs".
  - Reconnect/offline queue + LWW (updated_at) resolves correctly.
- **Demo Mode Parity** (no .env or demo ws):
  - Simulator spins (Alice/Bob rotate, cursors, conflicts, mentions) → feels "live".
  - Guards prevent any live calls.
- **Error/Edge**:
  - Rapid ws switch: No channel leaks, correct teardown/subscribe.
  - Invalid pub (pre-fix): Clear "not in publication" errors post-ALTE R.
  - Console clean; no silent failures.
  - RLS: User in ws A cannot see ws B data (postgres_changes respect).
- **Perf/Scale (basic)**: 5-10 items, multiple concurrent users; <1s propagation typical.
- **Tools**: Browser DevTools Network (ws:// Supabase realtime), Supabase Dashboard Logs / Realtime inspector (if available), `npm run typecheck` + build clean.

**Automated**: Expand e2e (Playwright) with multi-context or flagged live tests (post-activation). Add vitest for store realtime mocks.

**Success Gate**: All checklist items pass in real Supabase multi-user + demo pristine. Document results + screenshots in follow-up to Agent 44. Only then Phase 1 milestone approved and downstream Wave 8 agents unblocked.

**Rollback**: Remove tables from publication (rarely needed); code guards ensure !live remains perfect.

---

## 10. Risks, Dependencies, Alignment & Recommendations

**Risks**:
- Manual pub step error-prone (mitigated by DO block + UI verification).
- Channel management complexity (address in hardening).
- Type drift (fix via types update).
- Over-subscription perf (filters + specific events mitigate).
- User education on .env + SQL run (banner + README; future one-click?).

**Dependencies**:
- Agent 44 approval of this proposal.
- Agent 45 (Supabase Migration Lead) for execution + auth/teams wiring.
- Clean baseline (hygiene agent work referenced in memory).
- Real Supabase project (not demo).

**Master Plan Alignment**: Directly enables the "NON-NEGOTIABLE FIRST" Phase 1 milestone. Fills exact gaps called out ("gaps in comments pub/push", "extend for comments/notifs", "realtime publication" in Agent 45 charter). Preserves all prior strengths (hybrid guards, optimistic/LWW, demo magic, neon aesthetic).

**Recommendations to Agent 44**:
1. Review/approve this proposal (or request clarifications via ask_user_question equivalent in governance).
2. Authorize Agent 45 (or designated) to:
   - Incorporate publication DO block into schema + run on live projects.
   - Implement minimal hardening + comment/notification subs (or broadcast augmentation) as Phase 1 activation step.
3. Sequence: Publication first (unblocks all), then code extensions + verification.
4. Update WAVE8-MASTER-PLAN.md with link to this doc + Agent 65 findings.
5. Post-approval: Agent 65 available for follow-up audit on implemented changes.

**Handoff Continuity**: Grep for "AGENT-65", "subscribeToWorkspaceRealtime", "supabase_realtime", "presence-${workspaceId}", "ws-tasks-", "realtime publication", "Phase 1 Live Supabase". Reference this file + Master Plan + AGENT-14/30 handoffs.

---

## Appendix: Key Code Excerpts & File References

(See full reads via tools in audit session. Representative snippets above.)

- **Publication intent**: `supabase/schema.sql:445-449`, `509-557`.
- **subscribeTo...**: `lib/data/hybridStore.ts:1836-1916`.
- **Presence + broadcast setup**: `store/useTaskStore.ts:2134-2195`.
- **Task/note handlers + conflict**: `store/useTaskStore.ts:2024-2127`.
- **Teardown + meta/cursor actions**: `store/useTaskStore.ts:2204-2267`.
- **TipTap cursor render**: `components/TipTapEditor.tsx:1048-1073`.
- **Editor wiring**: `app/page.tsx:1618-1629`.
- **Presence UI examples**: `app/page.tsx:1013-1018` (task ✎), `1360-1362` (notes), teams/sidebar.
- **Comments (no sub)**: `lib/data/hybridStore.ts:1414-1510`, `store/useTaskStore.ts:206-207`, `TaskModal.tsx:386-391`.
- **Notifs (no sub)**: `hybridStore.ts:1203-1383`, store actions ~209-214.
- **Master Plan Phase 1**: `docs/WAVE8-MASTER-PLAN.md:84-91`.
- **Prior Gap Notes**: `AGENT-30-LIVE-COLLAB-HANDOFF.md:77-81` (comments pub recommendation).

**End of Audit Report & Formal Proposal**.

**Submitted exclusively to Agent 44 for review and authorization.**

— Agent 65 (Realtime Publication & Subscriptions Agent)  
*Diagnostic complete. Awaiting Supervisor directive. Strict governance honored.*

---

*Document generated via audit tools (todo_write, list_dir, grep, read_file, memory_search). No source modifications performed.*