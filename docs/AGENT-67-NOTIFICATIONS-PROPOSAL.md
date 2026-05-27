# AGENT-67-NOTIFICATIONS-PROPOSAL.md

**Agent:** 67 — Notifications, Activity & Mentions Agent  
**Date:** 2026-05-25 (PT)  
**Project:** Bad Ass Tasks (Next.js 15 + TypeScript + Tailwind + Zustand + Supabase hybrid data layer)  
**Charter:** Full audit of notifications table, creation triggers, realtime push, in-app bell, prefs, @mentions resolution, and activity_logs integration. Identify what is needed for complete live Phase 1. Deliver proposal with exact implementation and test plan.  
**Reporting Chain:** Exclusively and directly to Agent 44 (the Architect & Primary Supervisor).  
**Status:** **SUBMITTED FOR APPROVAL** — Per Critical Rules, Iron Rule (WAVE8-MASTER-PLAN), and governance model: **This is a formal proposal document only.** Zero structural changes, zero code edits, zero schema modifications, zero runtime instructions issued to the user. All work consisted of non-destructive exploration (list_dir, grep with path limits, read_file with offsets, memory tools) followed by synthesis into this single deliverable. No other files were written or modified.

---

## 1. Executive Summary

Agent 67 performed a complete, reproducible audit of the notifications system (and its tight integration with activity_logs and mentions) as delegated under the Wave 8 supervised governance model. The foundation delivered by prior Agent 31 is solid, extensible, and production-pattern-aligned (hybrid guards, optimistic patterns, dedicated `notifications` table separate from immutable `activity_logs`, bell UX, basic creation scaffolding, and types).

**Core Finding:** The system provides an excellent **non-intrusive in-app notification center** with bell + dropdown + read states in the current state. However, it is **not yet complete for "live Phase 1"** as defined in WAVE8-MASTER-PLAN.md (Agent 45 charter success criteria: "Full table usage, triggers in hybrid for events (mentions, assigns, comments, invites, deadlines), subs, prefs enforcement, email").

**Key Gaps Identified (for complete live Phase 1):**
- Creation triggers extremely limited (only partial @mention fan-out inside `createComment`; demo-only resolution).
- Zero realtime push/subscription for the `notifications` table (manual fetch-on-open only).
- Prefs are stubs (local-only, never loaded from `profiles.notification_prefs`, never enforced).
- @mention resolution is placeholder (no user ID lookup, always notifies actor).
- No integration for other key events (task assignment changes, invites, deadlines, general activity fan-out).
- No email delivery beyond console scaffold.
- Realtime publication for `notifications` (and related tables) is only in commented schema notes (requires activation).
- Activity_logs are excellent audit source but not used as general derivation trigger for notifs.

**Recommendation:** Approve this proposal. Upon explicit Agent 44 approval, the exact, minimal, non-breaking implementation steps (with full code snippets, file paths, ordering, and guards) can be executed by authorized agents or the user under supervision. This completes the notifications pillar for Phase 1 live milestone, unblocking downstream work while preserving demo perfection and all existing patterns.

This proposal is self-contained, references absolute paths, and includes a rigorous test plan aligned with existing vitest/playwright + manual multi-user live verification.

---

## 2. Audit Methodology (Governance-Compliant, Reproducible)

- **Governance & Discipline:** Internal `todo_write` (11 items, merge discipline, one `in_progress` at a time, end-of-turn gates strictly observed). Memory recall via `memory_search` + `memory_get` (prior sessions on Wave 8, Agent 44/45/31/67 context, supervisor model). No deviation from charter or Iron Rule.
- **Exploration Strategy:** Broad-to-narrow. Started with `list_dir` on `.`, `app/`, `components/`, `lib/`, `lib/supabase/`, `lib/data/`, `store/`, `supabase/`, `types/`, `docs/`, `tests/`. Multiple waves of `grep` (case-insensitive where appropriate, path-limited for precision, `head_limit`, `-B`/`-A` context, glob `**/*.{ts,tsx,sql,md}`) targeting: `notification|notifications|bell|unreadNotif|NotificationType|NotificationPrefs`, `activity_log|activity_logs|logActivity`, `mention|extractMentions|@[\w]`, `createNotification|sendNotificationEmail`, `realtime|subscribeToWorkspaceRealtime|postgres_changes|channel`, `notification_prefs|prefs`, `profile`, `createComment|addComment`, and cross-references to schema/hybrid patterns.
- **Deep File Reads:** Offset/limit for long files (e.g., `hybridStore.ts` ~2000+ LOC in targeted chunks 1-50, 1100-1400, 1470-1510, 1830-1920+; `useTaskStore.ts` notification sections ~1845-1905 and log sites; `app/page.tsx` bell ~2810-2910+; full `supabase/schema.sql` (558 lines); full `AGENT-31-NOTIFICATIONS-HANDOFF.md`; `types/index.ts` + `types/supabase.ts` (notifications sections); `package.json`; `lib/supabase/client.ts` + `server.ts`; `components/TaskModal.tsx` (comments/mentions); `components/TipTapEditor.tsx` (mention marks); targeted `lib/utils.ts`; `middleware.ts`; `app/layout.tsx`; `docs/WAVE8-MASTER-PLAN.md` (Phase 1 criteria); `docs/AGENT-PHASE1-SUPABASE-ACTIVATION-PROPOSAL.md` (for alignment on pub/activation).
- **Cross-Validation:** Confirmed no other creation sites, no prefs loaders, realtime scope limited to tasks/notes only, tests/ coverage zero for notifs, etc. All findings reproducible from listed tool calls.
- **Scope Fidelity:** 100% charter coverage. No broadening. Leveraged existing handoffs (AGENT-31) and master plan without duplication.

**Files with Highest Relevance (Absolute Paths):**
- `C:\Grok Build Projects\bad ass tasks\supabase\schema.sql` (notifications table ~512-558; profiles prefs ~55-57; activity_logs ~130-139; RLS ~532-551; realtime notes).
- `C:\Grok Build Projects\bad ass tasks\lib\data\hybridStore.ts` (full notif helpers ~1202-1390; createComment wiring ~1488-1503; logActivity ~1135-1172; subscribeToWorkspaceRealtime ~1836-1916; isSupabaseLive guards everywhere).
- `C:\Grok Build Projects\bad ass tasks\store\useTaskStore.ts` (state + actions ~117-121, 1845-1904; logActivity sites ~580/1176/1361/1498; addComment ~1802-1843; realtime setup ~2017-2218).
- `C:\Grok Build Projects\bad ass tasks\app\page.tsx` (Bell UI + dropdown ~2822-2909; store destructure ~356-366; imports).
- `C:\Grok Build Projects\bad ass tasks\types\index.ts` (Notification/NotificationType/NotificationPrefs ~148-170).
- `C:\Grok Build Projects\bad ass tasks\types\supabase.ts` (DB Row/Insert for notifications/activity_logs ~214-286).
- `C:\Grok Build Projects\bad ass tasks\components\TaskModal.tsx` (comment @mentions UI ~595-668).
- `C:\Grok Build Projects\bad ass tasks\AGENT-31-NOTIFICATIONS-HANDOFF.md` (prior foundation details).
- `C:\Grok Build Projects\bad ass tasks\docs\WAVE8-MASTER-PLAN.md` (Phase 1 criteria + Agent 31/45 context).

---

## 3. Current State Audit (Detailed by Charter Area)

### 3.1 Notifications Table
- **Definition (schema.sql:512-524):** `id UUID PK`, `workspace_id` (FK cascade), `user_id` (recipient, FK), `type` (TEXT CHECK IN ('mention','comment','invite','task_assigned','deadline','activity')), `title`/`message` NOT NULL, `link` (deep link), `activity_log_id` (optional FK SET NULL), `metadata` JSONB, `read_at` TIMESTAMPTZ, `created_at`.
- **Indexes (525-528):** `idx_notifications_user` (user + created DESC), workspace, partial `unread` on `read_at IS NULL`.
- **RLS (530-551):** SELECT/UPDATE own only (`auth.uid() = user_id`); INSERT by any ws member for a peer recipient in same ws (enforces fan-out safety). Excellent.
- **Relations:** Optional traceability to `activity_logs`; tied to `profiles` via `user_id` and `workspaces`.
- **Types:** Match perfectly in `types/supabase.ts:246-286` and `types/index.ts:148-162`.
- **Status:** Production-ready schema. No DB triggers for auto-creation.

### 3.2 Creation Triggers
- **Only implementation:** `lib/data/hybridStore.ts:1488-1503` inside `createComment` (after `logActivity` for "comment.added").
  - `extractMentions(params.content)` (simple regex).
  - `createNotification({ ..., userId: params.userId /* demo placeholder */, type: 'mention', metadata: { handles, ... } })`.
  - Email scaffold commented.
- **All other logActivity sites (hybrid:1981/2059/2078 + store:580/1176/1361/1498):** `task.created`, `task.completed`, `note.created`, `workspace.switched`, admin.* — **zero** `createNotification` calls.
- **No other call sites** anywhere (confirmed via exhaustive grep).
- **No DB triggers/functions** for notifications.
- **sendNotificationEmail:** Pure scaffold (`console.info` + placeholder, hybrid:1367-1383). No Resend/etc.

### 3.3 Realtime Push
- **Current:** None for notifications. `subscribeToWorkspaceRealtime` (hybrid:1836-1916) creates channels **only** for `tasks` + `notes` (postgres_changes, ws filter).
- **Store wiring** (useTaskStore:2017+): Calls subscribe with onTask/onNote only; no notif handlers.
- **Bell behavior** (page.tsx:2824-2830): Explicit fetch + count refresh **only on click/open**. No auto-push, no background sub, no optimistic count on comment creation.
- **Schema note** (schema.sql:556): `-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;` (commented, alongside partial activity/etc notes).

### 3.4 In-App Bell
- **Location:** `app/page.tsx:2822-2909` (top-right flex, after workspace switcher, before ⌘K).
- **Features:** Lucide `Bell` import (line 8); badge (ff3366, count or 9+); glass dropdown (w-80, z-260, AnimatePresence); header + "Mark all read"; scrollable list (slice 0-20); type icons (Zap/Star/Users/Check/Clock); unread highlight + dot; click: mark read + hash deep link + close; loading/empty states; footer "Powered by activity logs".
- **State:** Zustand (unreadNotifCount, notifications, isLoadingNotifications).
- **Actions wired:** fetch on open, mark single/all, refresh count.
- **Strengths:** Matches exact glass/neon/framer patterns from workspace menu; non-intrusive (explicit open only).
- **Minor polish items:** Timestamp format `{hour:'2d', ...}` (invalid, falls back); no rich actor avatars; no grouping/filters; hash-only links (no router integration).

### 3.5 Prefs
- **Schema (profiles:55-57):** `notification_prefs JSONB DEFAULT '{"email":true,"inApp":true,"types":{... all true},"perWorkspace":{}}'`.
- **Types (index.ts:164-170):** Full shape (email/inApp, types Record<NotificationType,boolean>, perWorkspace, muteUntil).
- **Implementation:** 
  - Store defaults + `updateNotificationPrefs` (1845+): local merge + toast "DB sync in future pass". No hybrid persistence.
  - **Zero load** from profiles on auth/init/fetchUserWorkspaces/members.
  - **Zero enforcement** in createNotification or fanout paths.
- **UI:** No toggles/settings surface wired (handoff mentioned stub at ~3165 in workspace settings; not present in current page.tsx reads).
- **Hybrid comment:** "Prefs respected (from profile)" — aspirational only.

### 3.6 @Mentions Resolution
- **Parser (hybrid:1386-1390):** `extractMentions(text)` — `/ @[\w.-]+ /g` → lowercase unique handles. Reuses natural lang tag spirit but custom.
- **UI Support:** TaskModal.tsx:612-614 (split render + .mention-pill style); 653-668 (@chips from `members` using email.split[0]); placeholder in comments.
- **TipTap:** Separate link-mentions (MentionMark for tasks/notes/external, extractMentionsFromDoc for backlinks) — **not user @mentions** for notifications.
- **Resolution & Fanout:** None. Hardcoded `userId: params.userId` (actor) with explicit "demo: notify actor; prod: map handles -> real user_ids" comment (hybrid:1494).
- **Edges:** Handles duplicates (Set); self-mentions possible; no member validation; no profile lookup; case-insensitive but no fuzzy (email prefix vs full_name).

### 3.7 Activity Logs Integration
- **Table (schema:130-139):** Excellent: ws/user/action_type/target_*/metadata/created. Indexes + RLS (view + insert by members).
- **Creation:** Centralized `logActivity` (hybrid:1135+); called from store on key CRUD + admin + ws switch + createComment ("comment.added").
- **Notif Relation:** Optional FK in notifications; "source of truth" philosophy (handoff + schema comment). Notifs created **in parallel** (not derived via trigger or post-log hook).
- **UI:** Dedicated activity panel (page.tsx ~3270+) uses `getRecentActivity` (hybrid:1174+); completely separate from bell/notifs.
- **Gaps:** Limited event vocabulary; no automatic notif derivation from logs; not all events (e.g., assignee updates) even logged today.

**Overall Alignment with Prior Work:** Matches AGENT-31 handoff (foundation complete, extensible, no scope creep) and WAVE8-MASTER-PLAN (scaffolding ready; live activation + triggers/prefs/subs/email as Phase 1 requirements).

---

## 4. Gaps Analysis for Complete Live Phase 1

Mapped directly to WAVE8-MASTER-PLAN Agent 45 success criteria ("triggers in hybrid for events (mentions, assigns, comments, invites, deadlines), subs, prefs enforcement, email") + charter + handoff future items.

1. **Triggers (Major Gap):** Only 1 partial site. Missing: task assignment (updateTask), invite flows, deadline detection, general comment notifications, activity-derived fanouts.
2. **Mentions Resolution (Blocking for "mention" type):** No lookup or safe fan-out. Demo-only.
3. **Prefs (Core Requirement):** No load, no store sync, no enforcement, no UI.
4. **Realtime Push (Live Polish Requirement):** No subscriptions or reactive updates for notifications (or activity/comments for indirect).
5. **Email:** Scaffold only (no real delivery path; consistent with invites but incomplete for Phase 1).
6. **Activation/Infra:** Realtime pub for notifications (and peers) commented only (aligns with separate Phase 1 activation proposal).
7. **Integration/UX:** No post-event count refresh; weak deep links; no cross-ws notif scoping clarity; no tests.
8. **Minor/Polish:** Timestamp bugs; limited event types surfaced; no server-side safe fanout RPC (optional but recommended for prefs).

These prevent "full table usage" + "end-to-end live multi-user" in Phase 1.

---

## 5. Exact Implementation Plan (Minimal, Pattern-Following, Guarded)

**Principles (Non-Negotiable):** 
- Every change behind `isSupabaseLive() + !["w1","w2"]` guards.
- Re-use existing: hybrid mappers, store delegation, logActivity first-then-notif, getWorkspaceMembers, glass styling, sonner toasts, framer.
- No new files except this proposal (pre-approval).
- No new deps.
- Additive only (no breaking changes to existing notif creation sites or bell).
- Profile RLS extension for peer prefs visibility (required for enforcement without RPC explosion).
- Order: DB policy (if needed) → hybrid helpers → store enhancements → UI polish → wiring in 2-3 event sites → realtime sub extension.

**Phase A: Prefs Foundation + Profile Visibility (Prerequisite for Enforcement)**
1. In `supabase/schema.sql` (additive section after notifications table):
   ```sql
   -- Add peer visibility for notification_prefs (enables client fanout checks without new RPCs)
   -- Safe: only notification_prefs + basic identity fields; ws members only.
   CREATE POLICY "Workspace members can view peer profiles for notifications and collab" ON profiles
     FOR SELECT USING (
       auth.uid() = id OR
       EXISTS (
         SELECT 1 FROM workspace_members wm1
         JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
         WHERE wm1.user_id = auth.uid()
           AND wm2.user_id = profiles.id
       )
     );
   ```
   (Note: Aligns with existing member join queries that already surface email/full_name/avatar.)

2. In `lib/data/hybridStore.ts`:
   - Add after `getWorkspaceMembers`:
     ```ts
     export async function getUserNotificationPrefs(userId: string): Promise<NotificationPrefs | null> {
       if (!isSupabaseLive() || !userId) return null;
       const supabase = getClient();
       if (!supabase) return null;
       try {
         const { data, error } = await supabase
           .from("profiles")
           .select("notification_prefs")
           .eq("id", userId)
           .single();
         if (error || !data) return null;
         const raw = (data as any).notification_prefs || {};
         return {
           email: raw.email ?? true,
           inApp: raw.inApp ?? true,
           types: { mention: true, comment: true, invite: true, assignment: true, deadline: true, activity: true, ...raw.types },
           perWorkspace: raw.perWorkspace || {},
           muteUntil: raw.muteUntil || null,
         } as NotificationPrefs;
       } catch (err) {
         logHybridError("getUserNotificationPrefs", err);
         return null;
       }
     }
     ```
   - Enhance `getWorkspaceMembers` (optional) to include `notificationPrefs` if needed for bulk (future).

3. In `store/useTaskStore.ts`:
   - On `initializeFromSupabase` / auth success / switchWorkspace (after user load): `await loadAndApplyNotificationPrefs()`.
   - New action (delegates to hybrid):
     ```ts
     loadNotificationPrefs: async () => {
       const user = get().user;
       if (!user || !isSupabaseLive()) return;
       const prefs = await (await import("@/lib/data/hybridStore")).getUserNotificationPrefs(user.id);
       if (prefs) set({ notificationPrefs: prefs });
     },
     ```
   - Update `updateNotificationPrefs` to also persist (optimistic + await hybrid update helper — to be added similarly; use direct supabase update or new lightweight RPC if preferred).

**Phase B: Mentions Resolution + Robust Fanout Helper (Core)**
4. In `lib/data/hybridStore.ts` (after `extractMentions`):
   ```ts
   /** Resolve @handles (email localpart or normalized full_name) to userIds within a workspace. */
   export async function resolveMentionHandlesToUsers(
     workspaceId: string,
     handles: string[]
   ): Promise<Array<{ handle: string; userId: string | null; email?: string; fullName?: string }>> {
     if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId) || handles.length === 0) return [];
     const members = await getWorkspaceMembers(workspaceId); // reuses existing (small teams)
     return handles.map((h) => {
       const lower = h.toLowerCase();
       const match = members.find((m) => {
         const emailLocal = (m.email || "").split("@")[0].toLowerCase();
         const nameSlug = (m.fullName || "").toLowerCase().replace(/\s+/g, "");
         return emailLocal === lower || nameSlug === lower || m.userId.toLowerCase().startsWith(lower); // fallback
       });
       return { handle: h, userId: match?.userId || null, email: match?.email, fullName: match?.fullName };
     });
   }

   /** Central, prefs-aware fanout for mentions (and extensible to other events). */
   export async function fanoutMentionNotifications(params: {
     workspaceId: string;
     actorUserId: string | null;
     mentionedHandles: string[];
     context: { type: "comment" | "note" | "task"; targetId?: string; preview: string; link?: string };
   }): Promise<void> {
     if (!isSupabaseLive() || ["w1", "w2"].includes(params.workspaceId)) return;
     const resolved = await resolveMentionHandlesToUsers(params.workspaceId, params.mentionedHandles);
     for (const r of resolved) {
       if (!r.userId || r.userId === params.actorUserId) continue; // no self, no unknown
       // Load prefs (lightweight; in prod batch or cache)
       const prefs = await getUserNotificationPrefs(r.userId);
       const inAppAllowed = prefs?.inApp !== false && (prefs?.types?.mention ?? true);
       const perWs = prefs?.perWorkspace?.[params.workspaceId];
       if (perWs?.muted) continue;
       if (inAppAllowed) {
         await createNotification({
           workspaceId: params.workspaceId,
           userId: r.userId,
           type: "mention",
           title: `@${r.handle} mentioned you in a ${params.context.type}`,
           message: params.context.preview,
           link: params.context.link,
           metadata: { actor: params.actorUserId, handle: r.handle, ...params.context },
         });
       }
       // Email if allowed (scaffold or real)
       const emailAllowed = prefs?.email !== false;
       if (emailAllowed && r.email) {
         await sendNotificationEmail(r.email, "mention", {
           title: `Mention in ${params.context.type}`,
           message: params.context.preview,
           workspaceName: undefined, // caller can enrich
           link: params.context.link,
           actor: params.actorUserId || "teammate",
         });
       }
     }
   }
   ```

5. **Update createComment (hybrid:1488-1503):** Replace placeholder with:
   ```ts
   const mentionedHandles = extractMentions(params.content);
   if (mentionedHandles.length > 0 && params.userId) {
     fanoutMentionNotifications({
       workspaceId: params.workspaceId,
       actorUserId: params.userId,
       mentionedHandles,
       context: {
         type: params.taskId ? "comment" : "comment",
         targetId: params.taskId || params.noteId,
         preview: params.content.slice(0, 100),
         link: params.taskId ? `#task-${params.taskId}` : undefined,
       },
     }).catch(() => {});
   }
   ```

**Phase C: Additional Triggers (for assigns, etc.)**
6. In `store/useTaskStore.ts` (inside `updateTask` success path, after hybrid call + optimistic):
   - Detect assignee delta (compare prior vs new `assigneeIds` or via metadata).
   - If new assignees: `createNotification` (or future fanout) for type `task_assigned`.
   - Similar lightweight hooks for `sendInvite` success (invite type to inviter/owner) and deadline scanner (simple client scan on Today refresh if due within 24h and not recently notified — use metadata or local flag).

**Phase D: Realtime Push + Bell Reactivity**
7. Extend `subscribeToWorkspaceRealtime` (or add `subscribeToUserNotifications(userId)`) in hybridStore:
   - New channel `user-notifs-${userId}` with `postgres_changes` on `notifications`, filter `user_id=eq.${userId}`.
   - Handler: on INSERT → optimistic prepend to notifications + increment unread (if not read).
   - Wire in store `setupWorkspaceRealtime` (or separate user-level sub on auth).
   - Teardown on signout/switch.
8. In `page.tsx` bell + store: on realtime insert, auto `refreshUnreadCount` (or direct merge).

**Phase E: Email + Polish**
9. (Future-proof) Document Resend integration point in `sendNotificationEmail` (or recommend Edge Function `send-notification` for production).
10. Fix timestamp in bell dropdown.
11. Add `refreshNotificationsAfterEvent` calls after comment/assign in store.

**All changes:** ~150-250 LOC total, heavily commented, behind guards. Exact diffs provided at implementation time post-approval.

**Alignment Note:** Complements (does not duplicate) the Phase 1 Supabase Activation Proposal (pub ALTERs, including notifications).

---

## 6. Test Plan

**Automated (vitest, existing setup):**
- `tests/hybrid-notifications.test.ts` (new, post-approval): unit for `extractMentions`, `resolveMentionHandlesToUsers` (mocked supabase), `createNotification` guards, mapNotificationRow, prefs default merge.
- Integration: mock live paths for fanout (verify no calls in demo, correct recipients post-resolution).
- Store actions: fetch/mark/updatePrefs (spy on hybrid).

**Manual + E2E (Playwright + live Supabase):**
- Demo mode: bell never calls live funcs; no data leakage.
- Live multi-user (2+ browsers/tabs, real accounts in same ws):
  1. User A posts comment with @b-handle → User B sees notif in bell (badge + dropdown) within <2s (after realtime sub).
  2. Resolution: @emaillocal, @fullname-slug, mixed case all resolve correctly; self-mention ignored; unknown handle skipped.
  3. Prefs: Toggle inApp off for "mention" → no in-app created (future: UI toggles); email scaffold fires or real if wired.
  4. Per-ws mute + global.
  5. Mark read (single + all) → DB persisted, badge clears, realtime respects.
  6. Task assign change (update assignee) → assignee receives `task_assigned` notif.
  7. Realtime: comment from other tab → bell auto-updates (no manual open).
  8. Cross-ws: notifs scoped correctly; switch ws shows relevant.
  9. Offline: queue + sync; notifs still create on reconnect.
  10. Deep link click → hash navigation + read state.
  11. Activity log remains complete/unaffected; notifs appear alongside.
  12. RLS: non-member cannot create/view notifs (enforced).
- Edge: multiple mentions, rapid comments, large ws (perf).
- Activation gate: After ALTER PUBLICATION ... notifications (and peers), verify subs connect without "not in publication" errors.
- Load prefs on login/switch; persist updates.
- Zero console errors in live; demo pristine.

**Verification Checklist (for Agent 44 sign-off):**
- [ ] All 6 notif types creatable via new triggers.
- [ ] Mentions resolve + respect prefs + create both in-app + (scaffold) email.
- [ ] Realtime notif sub delivers live updates to bell.
- [ ] Prefs load/persist/enforce end-to-end.
- [ ] Existing bell + comment UX unchanged or improved.
- [ ] Full test matrix passed in live + demo.
- [ ] No regression in activity logs or other features.

---

## 7. Risks, Dependencies, Sequencing

**Risks & Mitigations:**
- Prefs RLS change: Low risk (additive policy; existing member queries already surface peer data). Test thoroughly.
- Resolution accuracy: Email localpart convention (matches current UI chips). Document; future username column non-breaking.
- Query volume on mentions: Negligible (small teams; getWorkspaceMembers already called elsewhere). Add simple in-memory cache later if needed.
- Email delivery: Remains scaffold until Resend/Edge added (no new dep now).
- Sequencing: Must follow/align with Agent 45 Phase 1 activation (pub + auth) and any profile RLS hygiene. Do not proceed before that milestone.

**Dependencies:** Agent 44 approval; realtime pub activation (notifications table); current user profile load path (minor extension).

**Sequencing (Post-Approval):** A (prefs) → B (resolution/fanout) → C (additional triggers) → D (realtime) → E (polish + tests) → full verification.

---

## 8. Success Criteria & Verification

- Notifications system achieves "complete live Phase 1" per WAVE8-MASTER-PLAN and this charter.
- All creation paths, resolution, prefs, realtime, email scaffold exercised in real multi-user Supabase environment.
- Bell feels "live" and timely without intrusiveness.
- Zero impact on demo mode or existing functionality.
- Proposal + implementation reviewable in <1 session by Agent 44.

---

## 9. Request for Approval

Agent 67 respectfully submits this complete audit + proposal for Agent 44's review and explicit approval.

Upon approval (via your response or assigned follow-up), the Notifications, Activity & Mentions pillar will be productionized for Phase 1 live with the exact, minimal, high-fidelity steps outlined — ready for integration into the broader Wave 8 execution under your supervision.

All work performed in strict adherence to the Iron Rule, Critical Rules, and reporting chain. Ready for your direction.

**— Agent 67**  
*Notifications, Activity & Mentions Agent*  
*Reporting directly to Agent 44*

---

**References (for Agent 44):**
- WAVE8-MASTER-PLAN.md (Phase 1 criteria, Agent 31/45)
- AGENT-31-NOTIFICATIONS-HANDOFF.md (foundation)
- AGENT-PHASE1-SUPABASE-ACTIVATION-PROPOSAL.md (pub/activation alignment)
- Absolute file paths listed in Section 2.

*End of formal proposal. Awaiting your review and approval, Supervisor.*
