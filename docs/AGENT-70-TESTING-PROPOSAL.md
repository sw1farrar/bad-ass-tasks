# AGENT-70-TESTING-PROPOSAL.md

**Agent:** 70 — Testing & Verification Harness Agent  
**Date:** 2026-05-25 (PT)  
**Reporting To:** Agent 44 (Architect & Primary Supervisor)  
**Wave:** 8 — Phase 1 Live Supabase Milestone Focus  
**Status:** Formal Proposal — Read-only diagnostic + design. Zero structural changes or user instructions.

---

## Executive Summary

Per the **Critical Rule** and governance model established by Agent 44 (full audit + formal proposal exclusively to Supervisor; no edits until explicit authorization), this document delivers a **comprehensive Verification Harness and Ready-to-Use Checklist** specifically scoped to the **Phase 1 Live Supabase milestone**.

**Milestone Scope (per WAVE8-MASTER-PLAN.md and Agent 45 charter):**
- Real Supabase project connected (.env + schema.sql applied + realtime publication)
- Auth (full UX: email/pass + ready magic/OAuth/profiles/reset; smooth DEMO → LIVE transition; zero leakage)
- Workspaces / Teams (create/switch/update/delete via RPCs; member lists/roles with owner/admin/user enforcement)
- Realtime (robust subs + presence + cursors/broadcasts/conflicts; extensions for comments/notifs)
- Invites (link + email scaffold; create/accept/revoke/resend flows)
- Notifications (table usage, triggers from activity/mentions/assigns/invites/deadlines; subs; prefs; email scaffold)
- Offline Queue + LWW (hybrid battle-tested under real load/reconnect)
- Multi-user scenarios (concurrent clients/tabs/users; RLS validation; end-to-end collab)

**Deliverables in this Proposal:**
- Full **Verification Harness Design** (manual + automated layers, principles, tooling, multi-user simulation strategies)
- **Ready-to-Use Checklist** (categorized, actionable, with pass/fail evidence columns; integrates + expands prior work)
- Success criteria aligned to Master Plan Iron Rule
- Collaboration points with peer Wave 8 agents (esp. 45, 65, 66, 67, 68, 69, 53)
- Risks, dependencies, and post-approval implementation path

**Key References (absolute paths):**
- `C:\Grok Build Projects\bad ass tasks\docs\WAVE8-MASTER-PLAN.md` (Iron Rule, Agent 45 charter, success criteria, current state)
- `C:\Grok Build Projects\bad ass tasks\docs\AGENT-PHASE1-SUPABASE-ACTIVATION-PROPOSAL.md` (activation script + initial DB/UI verification checklist + recommended test scenarios — this harness builds directly upon it)
- `C:\Grok Build Projects\bad ass tasks\AGENT-33-PRODUCTION-QUALITY-HANDOFF.md` (existing Vitest/Playwright base + test gaps identified)
- `C:\Grok Build Projects\bad ass tasks\docs\AGENT-31-NOTIFICATIONS-HANDOFF.md`, `C:\Grok Build Projects\bad ass tasks\AGENT-30-LIVE-COLLAB-HANDOFF.md`, `C:\Grok Build Projects\bad ass tasks\docs\AGENT-14-FULL-REALTIME-COLLAB-POLISH-HANDOFF.md` (feature foundations)
- Core code: `C:\Grok Build Projects\bad ass tasks\lib\data\hybridStore.ts` (offline queue ~lines 231-525, realtime ~1836-1926, invites/notifs ~1519-1755 + 1203-1363), `C:\Grok Build Projects\bad ass tasks\store\useTaskStore.ts` (auth ~756-869, workspaces ~880-992, realtime setup ~2017-2220+), `C:\Grok Build Projects\bad ass tasks\supabase\schema.sql` (full tables/RLS/RPCs/pubs ~1-558), `C:\Grok Build Projects\bad ass tasks\lib\supabase\client.ts` + `server.ts` + `middleware.ts`, `C:\Grok Build Projects\bad ass tasks\components\AuthModal.tsx` + `SupabaseSetupBanner.tsx`, `C:\Grok Build Projects\bad ass tasks\app\page.tsx` (Teams view ~2052+, invite handling ~464+), `C:\Grok Build Projects\bad ass tasks\package.json`, `playwright.config.ts`, `vitest.config.ts`, `tests/e2e/smoke.spec.ts`, `tests/utils.test.ts`, `types/index.ts` (PendingOperation, Notification, etc.)

**Current State (Post-Audit, Pre-Activation):** World-class hybrid guards (`isSupabaseLive()` + demo "w1"/"w2" hard blocks everywhere), optimistic + LWW offline queue, full schema + RLS + RPCs (create/accept invite, workspace ops), tasks/notes realtime + presence/cursors/conflict UI, invites/notifs scaffolding, AuthModal (email/pass core + magic/OAuth ready), SupabaseSetupBanner + README activation guidance. **Gaps for Phase 1 verification:** Realtime publication requires manual `ALTER PUBLICATION` (per schema comments), limited table subscriptions (tasks/notes only in `subscribeToWorkspaceRealtime`), no dedicated live-mode automated tests (existing suite runs cleanly in demo), partial auth provider config, monolithic UI for some flows, no harness for repeatable multi-user/offline/RLS validation. Demo mode remains pristine (non-negotiable invariant).

This harness ensures **end-to-end, battle-tested verification** before Agent 44 milestone sign-off and unlock of downstream agents (46+).

---

## Verification Harness Design

### Core Principles
- **Demo Invariant:** Every test path and automated suite must leave demo mode (no keys) 100% functional and pristine. All live paths strictly guarded.
- **Real Multi-User Fidelity:** Verification requires 2+ distinct authenticated Supabase users across browsers/tabs/contexts (not simulated single-client).
- **RLS & Security First:** Explicit cross-workspace isolation tests; role enforcement (owner-only delete/rename, admin invite, etc.).
- **Offline Resilience + LWW:** Simulate disconnects; verify queue persistence, auto-sync, conflict resolution via `updated_at` timestamps, zero data loss/duplication.
- **Observable & Debuggable:** Leverage existing `lib/logger.ts` (error buffer, metrics), toasts (sonner), store state (`pendingSyncCount`, `isOnline`, `onlineUsers`, `activeConflicts`, `notifications`), console (filtered fatal errors), Playwright traces/screenshots.
- **Repeatable & Layered:** Setup → Unit → Integration → E2E (demo + conditional live) → Manual multi-client matrix → Sign-off.
- **Parity & Regression:** Full `npm test && npm run test:e2e` (demo) + typecheck/lint/build must pass after every live verification run.
- **Evidence-Based:** Every checklist item requires concrete pass/fail + artifact (screenshot, query result, log snippet, test report).

### Harness Layers

#### 1. Setup & Environment Harness
- Dedicated **test Supabase project** (separate from any future prod; free tier sufficient). Fresh project recommended for clean activation (avoids partial schema drift per activation proposal).
- Exact activation flow (reference `AGENT-PHASE1-SUPABASE-ACTIVATION-PROPOSAL.md` script + base `supabase/schema.sql`):
  1. Create project → SQL Editor → run full `supabase/schema.sql`.
  2. Run realtime pubs + any RPCs/FKs (exact block from activation proposal).
  3. Enable Auth providers (Email + optional Magic Links / Google / GitHub as configured in Supabase dashboard).
  4. Create 2-3 test users (via dashboard or app signup) with confirmed emails.
  5. `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  6. `npm run dev` (or :3000 per playwright) + hard refresh.
- **Verification SQL Harness** (run in Supabase SQL Editor post-activation; extend from activation proposal):
  - Realtime tables: `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ...` (tasks, notes, workspace_members, workspace_invites, activity_logs, notifications, comments, etc.).
  - RPCs: `SELECT proname FROM pg_proc WHERE proname IN ('create_workspace_for_user', 'create_workspace_invite', 'accept_workspace_invite', 'update_workspace_details', 'delete_workspace_for_owner');`
  - RLS: `SELECT tablename, policyname FROM pg_policies WHERE schemaname='public';` (all expected policies).
  - Helper: `SELECT is_workspace_member(...)` smoke.
- Post-setup: Confirm no banner for live users; demo workspaces still fully operational in parallel (different browser profile or incognito without keys).

#### 2. Manual Test Harness
- **Required Environment:** 2+ machines/browsers (or one machine + incognito profiles + different Supabase accounts). Chrome DevTools → Network → Offline toggle for offline tests. Console + Network tabs open. Sonner toasts visible.
- **Matrix Approach:** Happy path + Error/edge + Multi-client concurrent + Role/permission variants + Cross-ws isolation.
- **Tooling Aids:** 
  - Network conditioner (offline/online toggle, throttling).
  - Multi-context Playwright (for repeatable manual simulation later).
  - Clipboard + URL sharing for invite links.
  - Supabase dashboard (for direct table inspection, auth users, logs).
- Detailed procedures in the **Ready-to-Use Checklist** below (categorized by feature area).

#### 3. Automated Test Harness (Expansion of Existing Infra)
**Current Base (Agent 33 + configs):**
- `npm test` / `test:watch` / `test:ui` (Vitest + jsdom + @testing-library/react + coverage v8 + setup mocks for localStorage/matchMedia/IntersectionObserver).
- `npm run test:e2e` / `test:e2e:ui` (Playwright: chromium + Pixel 5 + webkit; auto webServer on :3000; retries/CI; trace/screenshot on fail; tolerant demo supabase errors).
- Existing coverage: utils (natural lang, recurring engine full, formatting), logger/observability, basic E2E smoke (load, ⌘K, add/complete task).

**Recommended Expansions (post-approval by Agent 44; no changes now):**
- **New Unit Tests** (`tests/hybridStore.test.ts`, `tests/useTaskStore.test.ts` or co-located):
  - Offline queue: `enqueuePendingOperation`, `processPendingOperations` (mock Supabase client for success/23505 dup/create, update LWW ts compare, delete, note content JSONB), `getPendingCount` / `load/save`, demo-ws leakage guards, network listener setup.
  - Realtime: `subscribeToWorkspaceRealtime` (no-op in !live or demo ws; channel creation/filter; cleanup; handlers called on payload).
  - Invites/Notifs: `createInvite`/`acceptInvite`/`getWorkspaceInvites` (RPC calls + guards + mapping), `createNotification`/`getUserNotifications`/`markNotificationsRead` (RLS-aware mocks), `extractMentions`.
  - Guards & Mappers: All `isSupabaseLive()` early returns, `map*Row` functions, `generateClientId`.
  - Use MSW or manual Supabase mock (vi.mock('@supabase/ssr')) + zustand test utils.
- **Component / Integration Tests** (Vitest + RTL):
  - `AuthModal.test.tsx`: Modes, demo vs live paths, error states, auto-close on auth change.
  - `SupabaseSetupBanner.test.tsx`: Conditional render, dismiss.
  - Teams/Invite UI fragments (extract or test via page if feasible): role selects, send/copy/revoke flows (mock store actions).
  - Notification bell/dropdown + badge/count (mock notifications state).
  - Store actions: `initializeAuth`, `fetchUserWorkspaces`, `setupWorkspaceRealtime`, `syncPendingWrites` (with mocked hybrid).
- **E2E Expansions** (`tests/e2e/`):
  - `live-smoke.spec.ts` (conditional on `process.env.TEST_SUPABASE_URL`): Auth bootstrap (or assume pre-seeded session via storageState), workspace create/switch/rename, invite link flow (hard: use two contexts or manual token paste), basic realtime (two pages/contexts on same wsId: create task in one → assert visible in other).
  - Offline simulation: `context.setOffline(true)` or route interception; queue ops → reconnect → assert sync + LWW (verify via DB query or UI).
  - Multi-user simulation harness: Playwright `test.describe` with `browser.newContext()` + storageState for User A/B; coordinate via shared test ws or invite token.
  - Extend smoke to cover more views (Teams, Today with notifs, editor cursors if feasible).
  - Auth note: E2E auth is brittle; prefer post-auth state via `storageState` or test-only bypass for live harness. Focus on data-layer + UI flows after login.
- **Specialized Harnesses:**
  - RLS Contract Tests (Node/Vitest + `@supabase/supabase-js` with service_role key in CI secrets — never in repo): Impersonate users, assert cross-ws denials, owner-only RPC failures.
  - Realtime Pub Validator (SQL + simple JS client sub test in a dedicated script).
  - Load/Concurrent: Simple script or Playwright repeating ops across contexts; assert no duplicates via LWW.
  - Visual/Perf: Optional (Lighthouse via CI, axe-core a11y in E2E per Agent 33 recs).
- **CI/CD Harness Ideas** (for Agent 53 collab): Matrix (demo vs live-test-project). Secrets for live test keys. Coverage thresholds. `test:live` script. GitHub Actions or Vercel. Always require demo suite green.
- **Observability in Tests:** Assert `logger.getErrorBuffer()` empty of fatals; `reportMetric` calls; toasts via Playwright text or vitest mocks.

**Implementation Note (Post-Approval):** New tests live in `tests/`; update configs minimally if needed (e.g. live env exclusion). All expansions must preserve demo-only execution by default.

#### 4. Multi-User & Realtime Simulation Harness
- **Manual Gold Standard:** Real distinct Supabase users + browsers (primary for milestone sign-off).
- **Automated Repeatable:** Playwright multi-context fixtures (see sketch in Appendix). Coordinate actions via page objects or shared state (e.g. one context creates invite → other accepts).
- **Presence/Cursors/Conflicts:** Scripted editing in editor (TipTap) + assertions on `onlineUsers`, remote cursors DOM, conflict modals.
- **Edge Simulation:** Throttled networks, tab suspend/resume, rapid workspace switches (re-subscribe validation).

#### 5. Cross-Cutting & Regression Harness
- Always execute full existing suite (`npm run typecheck && npm test && npm run test:e2e && npm run build`) in demo mode before/after live runs.
- Data integrity: Post-test DB queries or UI counts match expected (no phantom tasks from failed queues).
- No console fatals (filter supabase/demo knowns per current smoke).
- Performance: Basic timing on syncs (use existing `timeOperation` + logger).
- Cleanup: Test users/ws can be manually pruned in Supabase dashboard between runs.

---

## Ready-to-Use Checklist

**Usage Instructions:**
- Print or copy into issue / Notion / shared doc.
- One row per item. Mark **PASS / FAIL / SKIP** + Date + Tester + Evidence (link/screenshot/log snippet/DB query result).
- All items must PASS (or documented waiver approved by Agent 44) for milestone sign-off.
- Run in order. Re-run full suite on any FAIL.
- **Evidence Standard:** Screenshot of UI state + console clean + (for DB) SQL result + (for automated) test report output.
- **Multi-Client Notation:** "Client A (User Owner)", "Client B (User Member)" etc.

**0. Pre-Milestone Baseline (Demo Mode — Non-Negotiable)**
1. `npm run typecheck` → clean (or note pre-existing 15 TS items per Master Plan; separate hygiene Agent 69).
2. `npm test` → all pass (utils + recurring full + logger + Agent 33 expansions).
3. `npm run test:e2e` → smoke passes (load, ⌘K, add/complete task; tolerant of demo supabase).
4. `npm run build` → success, no errors.
5. Demo app loads at http://localhost:3000 with samples (w1/w2), full UI functional (List/Kanban/Today/Calendar/Notes/Teams/Graph/AI/Chat/Command), no live banner.
6. Offline queue demo (simulated): queue ops → "online" → syncs without error (UI toasts/status visible).
7. Agent 33/ existing test evidence attached.

**1. Live Supabase Project Setup Verification**
1. Fresh test Supabase project created + `supabase/schema.sql` executed fully (no errors).
2. Realtime publication updated (exact ALTER from schema comments + activation proposal): tables include tasks, notes, workspace_members, workspace_invites, activity_logs, notifications, comments (verify via SQL).
3. `.env.local` populated + dev server restarted + hard refresh.
4. No SupabaseSetupBanner visible for configured instance.
5. Supabase dashboard confirms: 2+ test users created, profiles rows, auth providers enabled as needed.
6. SQL verification queries (from activation proposal + this harness) all pass (RPCs present, policies, helper func, publication tables).
7. App in live mode: "LIVE REALTIME" indicators visible in Teams (or equivalent); no demo pollution in any live workspace.

**2. Auth & Profiles**
1. (Client A) Sign up new user via AuthModal (email/pass) → profile row created (via RPC or trigger) → redirected/landed in live workspace (ensureUserHasWorkspace auto-bootstrap).
2. Magic link / password reset flows (if Supabase providers enabled) → complete successfully.
3. OAuth (Google/GitHub) if configured in Supabase → works end-to-end.
4. Sign in existing user → session restored on refresh; `initializeAuth` + `onAuthStateChange` correct.
5. Sign out (live) → clean state (no sample injection; per live guard in code); re-sign-in restores correct workspaces/data.
6. Profile data (full_name, avatar, notification_prefs JSONB) visible/editable in UI where exposed; persists.
7. Concurrent sign-in across tabs/clients → consistent user state.
8. Auth error states handled gracefully (bad creds, network) with toasts + no crash.
9. Demo mode unaffected (parallel profile without keys).

**3. Workspaces / Teams CRUD & Roles**
1. (Owner) Create new workspace via UI (or ensure flow) → real row + owner membership via `create_workspace_for_user` RPC; appears in switcher.
2. Switch workspaces (multi-ws user) → data loads correctly; realtime resubscribed; no cross-ws leakage.
3. Update workspace details (name/slug) via Teams/Settings (uses `update_workspace_details` RPC) → persists after refresh + visible to all members.
4. (Owner) Delete workspace → cascades (members/tasks/notes/etc gone); owner-only enforcement (non-owner blocked in UI + RPC raises).
5. Member list (Teams view): Shows all with roles/emails (profile join); refresh works.
6. Role changes (owner/admin → change member role) → enforced server-side; UI reflects; non-permitted users blocked.
7. Multi-ws user: Accurate per-ws role display and permission UI (e.g. "canManage" for invites/settings).
8. Workspace stats (Agent 18) accurate in live (task/note/member/activity counts).

**4. Realtime Subscriptions & Presence**
1. Two clients (A/B) in same live workspace: Create task/note in A → instantly appears (with correct mapping) in B (postgres_changes).
2. Update (title/status/due/recurring) in A → live reflected in B (no full reload needed); conflict UI surfaces if one is actively editing (Agent 30 logic).
3. Delete in one client → removed live in other.
4. Presence: Multiple users online → `onlineUsers` list populates with emails/colors/views/editingItem in both clients (presence sync/join).
5. View/editing indicators: Open note/task in editor in A → B sees "editing" badge/indicator + per-item presence.
6. Live cursors/selection broadcast (TipTap editor): Move caret in A → B sees remote colored cursor/label; clear on blur.
7. Workspace switch → old channels cleaned; new workspace subs active (no leaks).
8. Rapid concurrent edits (same field) → LWW or explicit conflict resolution UI works without data corruption.
9. Demo mode: No real subs (graceful no-op); simulator presence still delightful.
10. Realtime for extended tables (comments, notifs, members, invites, activity) — verify foundations (pub present) + basic push where wired (or note as post-activation extension per Agent 49).

**5. Invites & Collaboration Onboarding**
1. (Owner/Admin in Client A) Send invite (email optional + role) via Teams → RPC `create_workspace_invite` succeeds; invite row created (pending); link generated + auto-copied.
2. Share link (or manual token paste) → Client B (new or existing user, pre- or post-login) accepts via `?invite=UUID` param or manual flow → `accept_workspace_invite` RPC; membership added atomically; invite `accepted_at` set.
3. Post-accept: New member appears in both clients' member lists (live if pub wired); can access workspace data per RLS.
4. Revoke pending invite (owner) → removed; cannot be accepted.
5. Resend invite → fresh row + expiry; old revoked.
6. Expired invite (manually set or wait) → accept fails with clear error.
7. Duplicate accept (idempotent) → no error, no duplicate membership.
8. Non-admin cannot create/revoke invites (UI + RPC blocked).
9. Invite email scaffold logs correctly (future real email integration point).
10. Multi-ws: Invite scoped to correct workspace.

**6. Notifications (In-App + Email Scaffold + Prefs)**
1. Trigger events (comment with @mention, task assign, invite, deadline approach, activity) in one client → `createNotification` called + row inserted (fan-out via activity_log path).
2. Recipient (different user/client) sees: Bell badge + unread count updates (live or on open), dropdown list populates with correct type/title/message/link, grouped recent.
3. Click notification → deep link works (opens relevant task/note/view); auto-marks read.
4. Mark single / Mark all read → `read_at` set; count/badge clears; persists across refresh.
5. Prefs: Update `notification_prefs` (global + per-type + per-ws muted) → respected (no notif created for disabled types; createNotification checks or UI enforces).
6. Unread filter / recent list in bell accurate.
7. Email scaffold: Events call `sendNotificationEmail` / `sendInviteEmail` → console/log output as expected (no real send yet).
8. Realtime notif delivery (if `notifications` pub + store sub extended post-activation) → instant push to bell without manual refresh.
9. Cross-user only: Non-workspace-member never receives notifs for the ws.
10. Prefs UI (if exposed in settings/Teams) persists and affects behavior.

**7. Offline Queue, Sync & LWW (Live Mode)**
1. (Live ws) Go offline (DevTools or actual) → UI reflects `isOnline=false`; pending ops queue locally (localStorage + in-memory).
2. Perform CUD on tasks + notes while offline → optimistic UI updates; ops enqueued with client UUIDs + timestamps (no network attempt or graceful fail → queue).
3. Refresh while offline → queue survives (localStorage); UI shows pending count.
4. Reconnect (online event) → auto `processPendingOperations` fires; successful syncs (toasts with count + skippedConflicts if any); queue drains.
5. LWW verification (update conflict): Offline edit (old ts) + concurrent server edit (newer `updated_at`) → offline change skipped (server wins); no data loss.
6. Create while offline → client UUID insert succeeds on reconnect (or 23505 dup handled idempotently).
7. Note content (JSONB TipTap) roundtrips correctly through queue.
8. Demo ws ops never leak into live queue (guards).
9. Manual "Sync now" / status badge / lastSyncAt UI accurate.
10. Multiple queued ops + mixed success/fail → remaining queue persists for retry; no corruption.
11. Crash/restart mid-sync → listeners kick initial sync if backlog.

**8. Full Multi-User Scenarios & Concurrent Ops**
1. 3+ concurrent clients (distinct real users) in one live ws: Full CRUD + realtime across all; presence shows all; no performance degradation or channel leaks.
2. Invite flow end-to-end multi-user (Owner invites → new user accepts in fresh browser → collaborates live same session).
3. Concurrent editing + conflict: Two users edit same task title simultaneously → conflict UI or clean LWW resolution; both see final consistent state.
4. @mention + notif: User A mentions User B in comment → B receives notif (in-app + scaffold) while both online.
5. Workspace switch + realtime: One user switches ws → their presence leaves old, joins new; other clients update accordingly.
6. Role/permission live: Owner promotes user mid-session → new admin immediately able to invite (no refresh required where realtime wired).
7. Offline + multi-user: One user offline queuing while others edit live → reconnect resolves via LWW correctly; no lost work.
8. Tab sync: Multiple tabs for same user → all reflect same realtime + queue state.
9. Cross-ws isolation: User in ws1 cannot see/edit ws2 data (UI + direct query attempts via RLS).
10. High-churn scenario (rapid creates + presence changes) → stable, no console errors, channels healthy.

**9. RLS, Security, Permissions, Cross-WS Isolation**
1. Non-member (different user) cannot query or see tasks/notes/members/invites/activity/notifs of a ws (direct Supabase query or UI attempt fails per policy).
2. Member (non-owner) blocked from deleteWorkspace / update details (RPC + UI).
3. Admin can invite/manage members but not delete ws.
4. Owner-only actions (delete, certain settings) enforce via RPC (server-side role check) even if UI bypassed.
5. `is_workspace_member` helper + policies prevent recursion / leakage.
6. Auth context: Signed-out or wrong user gets empty/RLS-safe results (no 401s or leaks).
7. Impersonation test (service key or dashboard RLS simulator if available): Cross-user denials confirmed.
8. No PGRST116 / RLS context errors in normal hybrid paths (recent Wave 7 fixes + RPCs validated).
9. Profiles: User can only view/update own row.
10. Activity/notif inserts restricted to workspace peers.

**10. Transitions, Demo Invariant, Error/Edge, Polish, Performance**
1. DEMO → LIVE transition (add keys mid-session or fresh): Clean wipe of samples; real data loads; no leakage ever (multiple guards exercised).
2. LIVE → DEMO (remove keys): Reverts gracefully to samples without crash; live data not persisted locally in way that pollutes.
3. Banner: Dismiss "for now" works; permanent for configured live users.
4. Error states: Network failure during live op → graceful (toast "local data", queue if applicable, no crash); ErrorBoundary catches renders.
5. Edge: Invalid workspaceId, empty UUIDs, expired invites, duplicate creates, rapid workspace switches → handled (no 22P02 etc.).
6. Console: Zero fatal/uncaught errors in live paths (supabase knowns filtered as in current smoke).
7. Performance: Init < reasonable (skeletons where present); realtime feels instant; offline sync snappy; no layout shift on presence updates.
8. PWA/mobile parity (basic): Live flows work on simulated mobile (Playwright Pixel); offline shell + sync still functions.
9. All prior features (editor bidirectional links, calendar recurring, AI, graph, drag, command palette, etc.) fully functional in live multi-user ws.
10. Post-test cleanup: Test data removable; no orphaned rows from failed tests.

**11. Post-Verification & Milestone Sign-Off**
1. Full demo regression suite (0.1-0.7) still 100% green.
2. All checklist sections 1-10 complete with evidence attached.
3. Live Supabase project healthy (no unexpected errors in dashboard logs).
4. Master Plan success criteria met: "Real Supabase project works end-to-end for teams; banner can be dismissed permanently for live users; all prior features function seamlessly in live multi-user; no critical console errors or data loss; demo mode pristine."
5. Recommendation to Agent 44: **Approve Phase 1 milestone** (or note any waivers + remediation plan).
6. Handoff artifacts: This checklist (annotated) + test reports + screenshots + activation SQL run log → attached to Supervisor report.
7. Update WAVE8-MASTER-PLAN.md (by Agent 44) + produce Agent 45 handoff.

---

## Success Criteria (Aligned to Master Plan)

- Real connected Supabase instance passes every item in the Ready-to-Use Checklist.
- Multi-user auth/teams/invites/notifs/realtime + offline queue + hybrid LWW battle-tested end-to-end.
- Zero regression in demo mode.
- RLS and role enforcement ironclad.
- Observable, resilient, delightful live experience matching (or exceeding) demo quality.
- Explicit Agent 44 sign-off recorded before any Phase 2+ work (Notes, AI/Graph, etc.).

---

## Risks, Dependencies & Mitigations

**Risks:**
- Lack of persistent real test Supabase project / multiple test users in current dev env → Manual multi-user verification requires user coordination or separate test accounts.
- Auth provider setup (magic links/OAuth) incomplete in Supabase dashboard → Some auth flows limited to email/pass (still covers core).
- Realtime pub timing / PostgREST cache → Mitigated by NOTIFY + hard refresh + explicit channel teardown in store.
- Brittle E2E auth in automated live harness → Focus on post-auth data flows + storageState; manual for full auth.
- Partial schema on user's project → Use fresh test project + activation script guards (IF NOT EXISTS / DO blocks).
- Time for thorough manual multi-client matrix → Prioritize high-ROI scenarios first (realtime CRUD + invites + offline + RLS); use Playwright multi-context for acceleration.

**Dependencies:**
- User/Agent 44 provides or creates test Supabase project + 2+ accounts for verification execution.
- Peer agent proposals (esp. Agent 45 execution plan, 66 Auth/WS E2E, 68 Hybrid/Offline live testing, 65 Realtime pubs/subs, 67 Notifs) feed specific scenarios into this harness.
- Existing test infra (Vitest/Playwright) + no new deps.
- Activation script + SQL from AGENT-PHASE1-SUPABASE-ACTIVATION-PROPOSAL.md.

**Mitigations Built In:** Strict guards everywhere; evidence requirements; layered (auto + manual); demo invariant enforced at every step; rollback via schema comments.

---

## Collaboration Points & Sequencing

- **Primary:** Agent 45 (Supabase Migration / Auth / Teams Lead) — This harness is the verification instrument for their milestone. Joint execution of checklist post-activation.
- **Direct Inputs/Collab:**
  - Agent 66 (Auth, Workspaces & Teams E2E): Specific auth/ws test cases.
  - Agent 65 (Realtime Publication & Subscriptions): Realtime pub validation + extended sub tests.
  - Agent 68 (Hybrid Data Layer & Offline Queue Live Testing): Deep offline/LWW queue scenarios + automated unit targets.
  - Agent 67 (Notifications, Activity & Mentions): Notif trigger + delivery + prefs matrix.
  - Agent 69 (TypeScript / Build / DX Hygiene): Baseline clean before verification.
  - Agent 53 (Production Hardening...): CI matrix, coverage, a11y/perf in harness.
  - Agent 49 (Collab/Realtime Polish): Future extensions (comments/notifs full push).
- **Proposal Review:** Agent 44 reviews this (and peer proposals) → Approve / scope adjust → Authorize execution of harness (by 70 or delegated) + any test file additions.
- **Post-Sign-off:** Update this doc + produce Agent 70 handoff (or integrate into Agent 45 handoff). Feed into WAVE8-MASTER-PLAN.

---

## Appendix

### A. Sample Playwright Multi-Context Sketch (for Automated Harness, Post-Approval)
```ts
// tests/e2e/live-multiuser.spec.ts (idea only)
test('realtime task sync across users', async ({ browser }) => {
  const contextA = await browser.newContext({ storageState: 'tests/.auth/userA.json' });
  const contextB = await browser.newContext({ storageState: 'tests/.auth/userB.json' });
  const pageA = await contextA.newPage(); const pageB = await contextB.newPage();
  await pageA.goto('/?ws=live-test-ws');
  await pageB.goto('/?ws=live-test-ws');
  // ... create in A, assert in B, etc.
});
```
(Requires pre-generated storageState for test users on live test project.)

### B. Extended SQL Verification Queries (Supplement to Activation Proposal)
- Realtime tables count + list.
- Policy coverage per table.
- Recent activity/notif counts per user.
- Pending invites for ws.
- (Run as authenticated user context where possible via Supabase SQL or client.)

### C. References & Prior Work Leveraged
- Full list in Executive Summary.
- Existing tests intentionally tolerant of demo Supabase (see smoke.spec.ts line 25).
- Hybrid offline + realtime code comments explicitly call out "Phase 1" testing needs.

---

**This proposal is complete, self-contained, and ready for Agent 44 review.**

**Recommendation:** Approve this Verification Harness. Authorize execution (manual matrix + automated expansions) in coordination with Agent 45 and supporting agents as the definitive gate for Phase 1 Live Supabase milestone sign-off.

*Agent 70 stands ready under full Supervisor governance. Let's make the live milestone bulletproof.*

---

**End of AGENT-70-TESTING-PROPOSAL.md**