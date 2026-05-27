# AGENT-66-AUTH-TEAMS-PROPOSAL — Auth, Workspaces & Teams E2E Audit for Phase 1 Live Supabase

**Agent**: 66 (Auth, Workspaces & Teams E2E Agent)  
**Reporting To**: Agent 44 (Architect & Primary Supervisor) — Wave 8 supervised governance model ONLY  
**Date**: 2026-05-25 (PT)  
**Wave**: 8  
**Charter Alignment**: Full audit of auth flows, workspace creation/switching/renaming (incl. recent RPC), invite system, member roles, and multi-user scenarios in code + schema. Identify gaps for reliable live multi-user Phase 1. Detailed proposal + verification matrix.  
**Iron Rule Compliance**: Supports Phase 1 Live Supabase milestone exclusively. **No structural changes, no SQL edits, no code modifications, no Supabase activation, no demo/live behavior impact whatsoever.** Formal proposal document only. Zero implementation until explicit Agent 44 authorization. All recommendations gated behind Supervisor review/approval/sequencing per established model (see WAVE8-MASTER-PLAN.md and session 019e5d41.md).  

**Status**: **SUBMITTED FOR APPROVAL** — Audit complete. Proposal delivered. Awaiting explicit Supervisor direction before any follow-on work (including further docs or any edits).

---

## 1. Executive Summary

Under direct reporting to Agent 44 and Wave 8 governance, Agent 66 performed a comprehensive, non-destructive E2E audit of authentication, workspace lifecycle (create/switch/rename), invite/collaboration flows, member roles/permissions, and multi-user readiness across the full codebase and Supabase schema.

**Strengths Identified**:
- World-class hybrid data layer (lib/data/hybridStore.ts + store/useTaskStore.ts) with strict `isSupabaseLive()` / demo-ID guards, optimistic updates, LWW, offline queue, and zero demo pollution into live sessions (strengthened init/ensure/sign-in wipes).
- Solid schema foundations (supabase/schema.sql): workspaces, workspace_members (owner/admin/user), profiles, workspace_invites + secure SECURITY DEFINER RPCs (create_workspace_for_user, create/accept_workspace_invite, delete_workspace_for_owner), comprehensive RLS (workspace-scoped via member checks + owner-only for mutations), triggers, indexes.
- Robust auth bootstrap: initializeAuth + onAuthStateChange + ensureUserHasWorkspace (auto personal workspace via RPC on first login) + fetchUserWorkspaces (members join) + strong live guards in page.tsx / store.
- Workspace management: create/switch (RPC + refresh), rename/settings + delete (owner-only modal + RPC/direct fallback + last-owner safety in some paths), role badges everywhere, app-wide `canManage` / `myRole` centralization in page.tsx.
- Invite system: link-based (UUID token) + optional email, RPC-enforced creator role (owner/admin), accept via URL or manual, UI copy/revoke/resend (resend = fresh + revoke old), pending list gated.
- Role enforcement: UI gating (invite/manage/delete/settings only for owner/admin), store-side guards + last-owner protection (change/remove), RLS policies, self-action blocks.
- Realtime foundations + presence (wired on switch/init for tasks/notes; Teams presence UI).
- Multi-user prep: activity_logs + notifications scaffolding, profile joins for enrichment, ON CONFLICT safety in accept, owner_id in workspaces.
- Demo always pristine; live paths blocked on "w1"/"w2".

**Critical Gaps for Reliable Live Multi-User Phase 1** (prioritized; full details in §4):
- **Missing `update_workspace_details` RPC** (the "recent RPC" for renaming/settings): Fully implemented + called in hybridStore.ts:1783 (and store/page handlers), referenced in WAVE8-MASTER-PLAN + prior handoffs (Agent 11+), but **absent from supabase/schema.sql and types/supabase.ts Functions**. Live Supabase will hit RPC not found / PGRST errors on rename/update. (Schema has owner UPDATE policy + delete RPC only.)
- **Profiles table incomplete in types + visibility issues**: Schema has full profiles (with RLS own-only + notification_prefs). Not present in types/supabase.ts (unlike members/invites/notifs). Joins in hybrid (getWorkspaceMembers, getComments, etc.) for teammate names/emails may return nulls or fail under strict RLS for non-own profiles in true multi-user.
- **No profile creation on pure signup**: Only inside create_workspace_for_user RPC. New users signing up without immediate ws bootstrap lack profiles.
- **Invite email delivery is scaffold only**: sendInviteEmail logs intent + link (good TODOs for Resend/Edge Function). No real delivery — multi-user onboarding relies solely on manual link sharing.
- **Auth UI incomplete vs backend capability**: AuthModal supports only email+password (signin/signup with redirect). Magic links, OAuth providers (Google etc.), password reset, and profile post-signup flows not wired in UI (though Supabase client ready; plan notes "magic + OAuth ready").
- **Realtime publication instructions not applied in schema**: Comments + explicit ALTER for workspace_members, invites, activity_logs, notifications (and tasks/notes) are in comments only. Live instance requires manual run or full re-apply for reliable postgres_changes / presence / notifs.
- **Client-side only safety for critical ops**: Last-owner protections, role changes, removes in store/useTaskStore (good but bypassable via direct DB/RLS or other clients). Recommend server RPC hardening (like invites).
- **No get_user_role RPC** (referenced in some plans/memory): Relies on client role from ws list or direct queries. Fine for UI but less ideal for future server actions.
- **Types drift & missing tables**: profiles absent; Notification/NotificationPrefs shapes have optionality/Json vs domain differences between types/index.ts, supabase.ts, and hybrid payloads. RPC signatures incomplete in types.
- **Limited multi-user E2E coverage + edge cases**: Strong guards, but no dedicated tests for concurrent invites/accepts, profile visibility across users, slug collision on create, post-rename refetch consistency, cross-device auth + ws switch, last-owner under load, or full invite lifecycle in live (email + accept as new user).
- **Other**: No ownership transfer; middleware permissive (demo-friendly, prod redirect commented); activity/notif fanout incomplete for all collab events (role change, invite accepted, rename); no dedicated profile settings UI.

**Overall Assessment**: The foundation is production-grade and hybrid-brilliant for Phase 1 activation. Auth + workspaces + teams are the strongest parts of the app. With targeted gap closure (primarily schema/types + RPC definition + profile RLS adjustments + email scaffold completion + test expansion), live multi-user will be reliable, secure, and delightful. No fundamental redesign needed. All aligns with Iron Rule: Phase 1 first.

**Recommendation**: Approve this proposal. Prioritize gap remediation in small, reviewable increments (Group 1: schema/types/RPC completeness; Group 2: profile + auth polish; Group 3: testing + email + hardening). Verification matrix below provides exact E2E flows for sign-off. All work reports exclusively to you. Demo remains untouched.

---

## 2. Audit Scope & Methodology

**Charter Executed**:
- Auth flows (client/server, sessions, login/signup, onAuthStateChange, guards, middleware, SupabaseSetupBanner).
- Workspace lifecycle: creation (ensure + manual via RPC), switching (sync + realtime teardown/reinit), renaming (settings modal + recent RPC), listing (fetch via members join), permissions.
- Invite system: create (RPC + UI dialog), accept (URL param + manual + store), revoke/resend, email scaffold, member addition.
- Member roles (owner/admin/user enum): definitions in schema/enum, enforcement (RLS, UI canManage, store guards + last-owner, role badges in switcher/sidebar/Teams).
- Multi-user scenarios: cross-user visibility (members list with profile enrichment), concurrent flows, RLS isolation, invite acceptance by new/existing users, presence, activity/notifs.

**Tools & Process** (exhaustive, reproducible, non-destructive; todos tracked with exactly one in_progress at a time per discipline):
- `list_dir` (root + supabase/ + lib/supabase/ + lib/data/ + store/ + types/ + docs/ + app/ + components/ + tests/ + lib/).
- `memory_search` + `memory_get` (Wave 8 governance, Agent 44, Phase 1 Live Supabase, auth/workspaces/teams/RPC decisions, prior sessions/MEMORY.md).
- `read_file` (full + offset/limit chunks on long files): supabase/schema.sql (full 558 lines), lib/supabase/{client,server}.ts, types/{supabase,index}.ts, lib/data/hybridStore.ts (multiple chunks covering RPCs, maps, guards, collab ~1400-1850+, realtime), store/useTaskStore.ts (auth ~750+, bootstrap ~880-1077, collab ~1597-2015+), app/page.tsx (auth init, invite handling, renderTeamsView ~2052-2350+, workspace switcher/settings ~2730-2818 + 3452-3515, handlers), components/AuthModal.tsx (full), middleware.ts, SupabaseSetupBanner.tsx, docs/WAVE8-MASTER-PLAN.md (full relevant sections), AGENT-11-COLLAB-HANDOFF.md, AGENT-14-..., other AGENT-*.md + README.
- `grep` (multiple targeted + broad, path/glob limited to project source, -B/-A context, head_limit): "workspace|createWorkspace|switchWorkspace|ensureUserHasWorkspace|fetchUserWorkspaces|updateWorkspace|deleteWorkspace|rename|update_workspace_details", "invite|create_workspace_invite|accept_workspace_invite|workspace_invites", "role|owner|admin|user|canManage|myRole|get_user_role|last owner", "initializeAuth|AuthModal|supabase\.auth|onAuthStateChange", "\.rpc\(", "profiles|RLS|is_workspace_member", "realtime|subscribeToWorkspaceRealtime|ALTER PUBLICATION", "isSupabaseLive|isSupabaseConfigured", specific files/paths.
- Cross-reference with package.json (Supabase ssr + js deps), tsconfig, playwright/vitest configs, root AGENT-*.md handoffs, task-persistence diffs (for recent context), prior memory (e.g., workspace_invites RPCs, PGRST schema cache resolution via SQL apply).
- No `write`, `search_replace`, image/video/gen, terminal exec beyond tool reads, or any app modification. Pure exploration + synthesis.

**Files of Primary Relevance** (absolute paths):
- C:\Grok Build Projects\bad ass tasks\supabase\schema.sql
- C:\Grok Build Projects\bad ass tasks\lib\data\hybridStore.ts
- C:\Grok Build Projects\bad ass tasks\store\useTaskStore.ts
- C:\Grok Build Projects\bad ass tasks\app\page.tsx
- C:\Grok Build Projects\bad ass tasks\components\AuthModal.tsx
- C:\Grok Build Projects\bad ass tasks\lib\supabase\{client,server}.ts
- C:\Grok Build Projects\bad ass tasks\types\{supabase.ts,index.ts}
- C:\Grok Build Projects\bad ass tasks\middleware.ts
- C:\Grok Build Projects\bad ass tasks\docs\WAVE8-MASTER-PLAN.md + AGENT-11-COLLAB-HANDOFF.md + AGENT-14-FULL-REALTIME-COLLAB-POLISH-HANDOFF.md (and related)
- Supporting: tests/e2e/smoke.spec.ts, tests/utils.test.ts, components/SupabaseSetupBanner.tsx, lib/logger.ts, lib/utils.ts (spot), app/layout.tsx.

**Governance Adherence**: Every step respected "report ONLY to Agent 44", "formal proposal only", "Iron Rule — support Phase 1 Live Supabase", "full audit + formal proposal... zero structural changes until explicit approval", parallel subagent coordination model. This document is the sole output.

---

## 3. Detailed Audit Findings

### 3.1 Schema & Database Layer (supabase/schema.sql + types/supabase.ts)
- **Tables**: workspaces (slug UNIQUE, owner_id), workspace_members (composite PK, role enum 'owner'/'admin'/'user'), profiles (notification_prefs JSONB, last_active), workspace_invites (email optional, expires 14d, accepted_at), full activity_logs, notifications, tasks/notes/comments (all ws-scoped FK + RLS).
- **Enums + RPCs present**: user_role; create_workspace_for_user (ws + owner member + profile upsert), create_workspace_invite (role check), accept_workspace_invite (atomic member insert + mark), delete_workspace_for_owner (owner check + cascade delete). Owner UPDATE/DELETE policies on workspaces.
- **RLS**: Excellent — member visibility (non-recursive via EXISTS or is_workspace_member helper), owner-only for ws mutations/invites manage, self for profiles/notifs, ws-member for tasks/notes/comments/activity insert/select. Comments CHECK XOR task/note.
- **Realtime notes**: Explicit instructions for ALTER PUBLICATION (tasks, notes, workspace_members, workspace_invites, activity_logs, notifications, comments implied).
- **Gaps**:
  - `update_workspace_details` (p_workspace_id, p_name, p_slug) — called everywhere for rename — **completely absent** from SQL and types Functions (only 3 RPCs typed: create_ws_for_user + 2 invites). This is the "recent RPC".
  - profiles table **missing entirely** from types/supabase.ts (while others added for Phase 2).
  - No get_user_role RPC (helper is_workspace_member exists but limited use).
  - Pub not auto-applied; comments/notifs/members/invites require manual step on live instance.
- **Multi-user readiness**: Strong isolation + atomic invite accept. Owner_id + invited_by for audit.

### 3.2 Auth Flows (lib/supabase/*, store/useTaskStore.ts, components/AuthModal.tsx, middleware.ts, app/page.tsx, app/layout.tsx)
- **Clients**: Simple browser (singleton) + server (cookie-based SSR) with Database generic. isSupabaseConfigured() central.
- **Flows**: initializeAuth (getSession + wipe live demo residue + ensure if user + onAuthStateChange listener). Signin: email/pass or demo fake. Signup: creates user (Supabase) + redirect. Signout: supabase + state via listener (demo samples only on !live). Auto-close modal on auth. Strong post-signin: ensure + initFromSupabase.
- **Guards**: Massive demo pollution prevention (wipes on live auth, guards in every live path). Middleware: session refresh only when keys present; auth redirects commented (demo-friendly).
- **UI**: AuthModal (email/pass only, mode toggle, errors, loading, demo notice). SupabaseSetupBanner (setup instructions: .env + schema.sql). Top-bar status (email/avatar when live?).
- **Gaps**: No magic link / OAuth buttons (Supabase supports via providers). No password reset UI. Profile creation deferred to ws RPC. No explicit profile edit flow (name/avatar). Listener + ensure robust but signup without ws leaves partial state until first create/ensure.
- **Multi-user**: Per-user RLS + user_id in all tables. Cross-device via Supabase sessions/cookies.

### 3.3 Workspace Management (hybridStore.ts, useTaskStore.ts, app/page.tsx)
- **Creation**: ensureUserHasWorkspace (check memberships → RPC create_workspace_for_user with personal-{email} name/slug if none; always full fetch). Manual createWorkspace (demo local or RPC + slug timestamp entropy + fetch + switch + init). Both set owner role.
- **Switching**: switchWorkspace (teardown realtime, set current, initFromSupabase, fetchUserWorkspaces, fetch collab + setup realtime if live). Sidebar + CommandPalette + menu.
- **Renaming / Settings (recent RPC)**: Owner-only entry in workspace menu → modal (name + slug inputs, save via updateWorkspaceDetails → hybrid updateWorkspace → rpc('update_workspace_details')). Post-save: fetch + set fresh current. Slug note on impact.
- **Delete**: Owner-only (danger confirm exact name) → deleteCurrentWorkspace → deleteWorkspace (prefers RPC, fallback direct) + fetch + switch to remaining or empty.
- **Listing/Permissions**: fetchUserWorkspaces (members join workspaces, denorm role). Workspaces list in store with role. Badges everywhere. isLiveWorkspace guards.
- **Gaps**: RPC for update missing in schema (primary blocker for live rename). Slug collision risk (DB error only). No transfer ownership. Client-side delete safety (RLS + RPC good but last-owner not server-enforced for all paths). No ws settings history/audit beyond activity.
- **Multi-user**: Real data only for authenticated; members see shared ws.

### 3.4 Invite System (hybridStore.ts ~1602+, useTaskStore.ts ~1630+, app/page.tsx renderTeamsView + useEffects)
- **Create**: canManage only → dialog (optional email + role select) → sendInvite (role guard + createInvite RPC + fetchInvites + optional sendInviteEmail scaffold + copy link toast). Link: `${origin}/?invite=${id}`.
- **Accept**: URL useEffect (if ?invite + user + configured → acceptInviteLink → RPC → fetch + switch + fetchMembers). Manual token prompt fallback. New user: triggers auth? (post-login path).
- **Manage**: Pending list (canManage): copy, "resend" (create fresh same email/role + revoke old + refresh), revoke (confirm + RPC delete). Gated.
- **Email**: Stub only (detailed log + TODO for Resend/Edge/api + link).
- **Gaps**: Email not real. No expiry UI or bulk. Accept race/duplicate handled by ON CONFLICT. No notification on accept to inviter (partial via activity/notifs scaffolding).
- **Multi-user**: Works for existing + new users; role assigned on accept.

### 3.5 Member Roles & Permissions + Multi-User Scenarios
- **Definitions**: Enum in schema; default 'user' on invite; 'owner' on create. Denormed to Workspace.role for UI.
- **Enforcement**:
  - Schema/RLS: invites FOR ALL only owner/admin; ws mutations owner; data access via member.
  - Store: send/change/remove/revoke/resend all check currentWorkspace.role (owner/admin); last-owner count blocks (demote/remove self or last); self-blocks.
  - UI (page.tsx): central myRole/canManage/isLiveWorkspace; Teams: role dropdown + remove only for canActOnThis (manage && !self); settings/delete only owner; badges + "view" indicators + notes ("only owner/admin for manage; all see activity/RLS").
  - Sidebar/switcher/CommandPalette: roles visible; create always owner.
- **Multi-user**: Members list (fetch + profile join enrichment for name/email/avatar); presence (onlineUsers with view/editing); activity "by" visibility; realtime updates on switch. Last-owner safety prevents lockout. RLS prevents cross-ws leakage.
- **Gaps**: Profile joins may not enrich (RLS own-only on profiles for other users' data). Role changes not server-RPC hardened. No ownership transfer. Limited notif/activity on role/invite events. No finer perms (e.g. assignee edit rights beyond role).

### 3.6 Realtime, Activity, Notifications, Other
- Strong subscribe on tasks/notes + presence channels (wired in store on live ws switch/init; teardown safe).
- Activity + notifs scaffolding (log on actions; createNotification for mentions; bell UI).
- Gaps: Pub application required for full live (members/invites/comments/notifs). Fanout incomplete for some collab events. Comments/presence polish from prior agents good but depend on pub.

### 3.7 Tests & DX
- Minimal: smoke e2e + utils (no auth/teams/invite/ multi-user coverage). typecheck/build gates exist but currently blocked by unrelated hygiene (separate agent).
- Strong DX: hybrid guards, toasts, confirms, loading states.

---

## 4. Identified Gaps, Risks & Recommendations for Reliable Live Multi-User Phase 1

**P0 (Blockers for Live Activation — Must Before Any Multi-User Test)**:
1. Define + add `update_workspace_details` RPC (and update types/supabase.ts) matching hybrid payload + schema style (SECURITY DEFINER, owner role check via members, UPDATE ws). Re-apply schema or targeted block on live.
2. Add profiles table (full Row/Insert/Update) to types/supabase.ts. Consider RLS adjustment or SECURITY DEFINER view/function for safe profile enrichment in member/comment joins (so teammates see names without exposing full profiles).
3. Execute realtime publication ALTERs (or include in schema apply script) for all relevant tables.
4. Ensure profile upsert on signup (or dedicated ensureProfile RPC) independent of ws creation.

**P1 (High for Multi-User Polish & Security)**:
- Real email delivery for invites (implement sendInviteEmail using existing scaffold; e.g., Resend or Supabase Edge).
- Expand AuthModal with magic links + OAuth buttons (leverage Supabase client methods already possible).
- Harden role/member mutations via new SECURITY DEFINER RPCs (add last-owner + consistency server-side; deprecate direct table ops where possible).
- Add ownership transfer flow (RPC + UI gated to current owner).
- Complete activity/notif fanout for invite accepted, role changed, ws renamed/updated, member removed.
- Profile management UI (name/avatar/prefs sync to DB).

**P2 (Reliability / Coverage)**:
- Add dedicated E2E tests (Playwright multi-browser/user simulation for invite/accept/role/ws flows; or Vitest integration with mocked Supabase).
- Slug collision UX (pre-check or friendly error).
- Concurrency edges (simultaneous accepts, rapid role changes).
- Full cross-device / multi-tab / reconnect testing on live.
- get_user_role RPC for future-proofing.
- Middleware strict auth enforcement (opt-in for prod).

**Risks** (if unaddressed):
- Rename/settings broken on live → user frustration, support load.
- Incomplete profile visibility → poor multi-user UX ("User abc123" instead of names).
- Email missing → slower team adoption.
- Client-only safety → potential (rare) lockout or inconsistent state under direct DB access or bugs.
- Realtime silent failures → "not live" perception.
- Type drift → future maintenance pain (recommend `supabase gen types` + manual merge discipline).

**Recommendations (Gated)**:
- Grouped, small increments only. Report to Agent 44 after each. Verify against matrix below + full typecheck/build + manual live flows (multiple accounts/tabs).
- Prioritize schema/types first (unblocks everything else).
- Preserve every existing guard, optimistic path, demo fidelity, and Iron Rule sequencing.
- Update WAVE8-MASTER-PLAN with Phase 1 auth/teams status post-approval.
- Consider dedicated follow-up agent (or this one) for verification after fixes.

All gaps identified via cross-file analysis; no speculation.

---

## 5. Verification Matrix (E2E Flows for Phase 1 Sign-Off)

**Legend**: Flow | Preconditions | Steps (code paths) | Expected (Demo) | Expected (Live Multi-User) | Verification Method | Status/Gap Link

1. **New User Signup + Auto Workspace** | No account | AuthModal signup (email/pass) → onAuthStateChange → ensureUserHasWorkspace (no memberships → create_workspace_for_user RPC) → fetchUserWorkspaces → initializeFromSupabase | Demo samples or fake success (no real data) | Real "Personal" ws created (owner), profile upserted, switcher shows it with role badge, empty but usable UI. No demo pollution. | Manual + console (RPC success, ws in DB via Supabase dashboard), store state inspect | Gap: pure signup profile timing.

2. **Login (Existing) + Workspace Load** | Account + ws | AuthModal signin → getSession + ensure (has memberships) → fetchUserWorkspaces (members join) + initFrom | Samples (if !live) | Full real ws list + current (with role), tasks/notes loaded via RLS, collab (members/invites/presence) fetched if live. | Auth state, switcher populated, no errors | Strong guards verified.

3. **Workspace Create (Additional)** | Auth + live ws | Workspace menu → "Create new" → name → createWorkspace (RPC create_for_user, fetch, switch, init) | Local demo ws added + switched | Real new ws (owner), listed, switched, realtime wired, empty data. Slug unique. | DB query, UI switcher, no collision | Gap: slug UX on dupes.

4. **Workspace Switch + Realtime** | Multiple ws | Switcher click or CommandPalette → switchWorkspace (teardown, set, initFrom, fetch, collab fetch + setupRealtime) | Instant local switch | Data swaps (RLS scoped), realtime subs active for new ws (tasks/notes), presence updates, members/invites refresh. Cross-view indicators live. | Multi-tab test, presence pills, live updates from 2nd client | Pub gap if not applied.

5. **Rename / Update Workspace (Recent RPC)** | Owner + live | Menu → Settings → edit name/slug → Save → updateWorkspaceDetails → hybrid rpc('update_workspace_details') → fetch + refresh current | Local only (demo guard) | WS name/slug updated in DB (policy + RPC), reflected in switcher/Teams/header immediately, no breakage to members/invites. | Supabase table, UI everywhere, activity log? | **P0 Gap: RPC missing → will fail live.**

6. **Invite Create + Share** | Admin/owner + live | Teams → Invite → email (opt) + role → send (RPC create_workspace_invite + fetch + scaffold email log + copy link) | Info toast (demo guard) | Invite row in pending (DB), link copied (/?invite=UUID), email log if provided. RLS only manager sees. | DB invites table, UI list, link format | Good RPC enforcement.

7. **Invite Accept (Existing User)** | Recipient logged in, valid invite | Click link or manual token → acceptInviteLink (RPC accept_workspace_invite) → fetch ws + switch + fetchMembers | N/A (demo) | Added as member (role from invite), switched to ws, members list updates (enriched), activity/notif? Real-time visible to others. Duplicate safe. | DB members + invites (accepted_at), UI switch + list | Good atomicity.

8. **Invite Accept (New User)** | No account, valid invite | Link → auth trigger? → signup/signin → accept flow | N/A | Account created, ws joined (per invite role), profile, switched. | Full bootstrap + DB state | Gap: profile + seamless UX.

9. **Role Change + Last-Owner Guard** | Owner + ≥2 members | Teams → member row select new role (or remove) → changeMemberRole/remove (guard + count owners + updateMemberRole/removeMember direct or future RPC + fetch) | N/A | Role updated in DB (visible to all via fetch), UI reflects, last owner blocked with toast. Self blocked. | DB + UI + error toasts on violation | Client safety only (P1 rec).

10. **Revoke / Resend Invite** | Manager | Teams pending → revoke or resend (confirm + RPCs + fetch) | N/A | Invite deleted or replaced (new expiry), list updates. | DB state, UI | Good.

11. **Delete Workspace (Owner)** | Owner + confirm name | Settings danger → exact name + confirm → deleteCurrentWorkspace (RPC or direct) → fetch + switch remaining | Local demo delete | Full cascade delete (members/tasks/etc), switch to next or empty state, no orphan data. | DB empty for ws, UI correct | Good RPC + fallback.

12. **Multi-User Presence + Realtime** | 2+ users/tabs in same live ws | User A in Teams/Tasks/Notes; User B edits | Basic pills in Teams only (demo) | Live onlineUsers (view + editingItem), badges across sidebar/lists/detail, cursors/status, comment @mention notifs, member list updates on change. | 2+ clients/tabs, observe UI live | Depends on pub + channel.

13. **Profile Visibility in Teams** | Multi members | Teams members list | Raw IDs or self | Names/emails/avatars from profiles join for all (including others). | UI enrichment | **Gap: RLS may limit non-own profiles.**

14. **Auth State Persistence + Cross-Device** | Login on device A, refresh B | Supabase session cookies/tokens | N/A | Seamless restore, ensure/fetch on load, no re-prompt if valid. | Multiple devices/browsers | Strong.

15. **Demo vs Live Separation (All Flows)** | Toggle .env keys | All above in both modes | Full beautiful demo (samples, local ops, no real calls) | Real DB only when configured; zero leakage; banner shows only !configured. | Toggle + inspect network/DB | Excellent (core strength).

**Additional Matrix Items** (security/edges): RLS bypass attempts (fail expected), slug collision, concurrent invites, offline queue + reconnect during collab, notif prefs, activity for collab events.

**Pass Criteria for Phase 1 Milestone**: All 15+ flows succeed end-to-end on live Supabase (2+ real accounts, multiple tabs/devices) with no console errors, correct RLS isolation, realtime propagation, proper role enforcement, and pristine demo in !live. Full typecheck/build clean. Matrix signed off by Agent 44.

---

## 6. Proposed Next Steps (Gated by Agent 44 Approval)

1. Your review + explicit approval of this proposal (and any modifications).
2. (Post-approval) Persist/revise this doc if needed; assign remediation (e.g., to Agent 45 or 66) in small batches with re-audit + verification against matrix.
3. Schema/types/RPC fix first (unblocks live rename + typesafety).
4. Profile RLS + creation + types.
5. Realtime pub + email + auth UI polish.
6. Hardening + tests.
7. Full matrix execution on live instance + your final Phase 1 milestone sign-off before any Phase 2+ (Notes/AI/etc per Iron Rule).

All recommendations preserve existing architecture, guards, and delight.

---

**References** (absolute, from audit):
- WAVE8-MASTER-PLAN.md (Phase 1 charter, Iron Rule, RPC mentions including update_workspace_details).
- AGENT-11-COLLAB-HANDOFF.md (prior settings/invites/roles work).
- AGENT-14-... (realtime/comments).
- Session memory (governance, RPC additions, schema cache fixes via SQL).
- All source files listed in §2.

**Prepared exclusively for Agent 44.**  
Ready for your questions, clarifications (via ask_user_question if ambiguous), or approval to proceed under governance.

**No further action by Agent 66 until authorized.**

— Agent 66 (Auth, Workspaces & Teams E2E Agent), reporting only to you.  
End of formal proposal.