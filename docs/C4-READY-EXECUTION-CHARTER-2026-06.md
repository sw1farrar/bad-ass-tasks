# C4 Ready-to-Execute Charter & Agent Prompts — 2026-06

**Source**: C4-Prep Diagnostic & Proposal Agent (subagent 019e7477-906c-7c21-beca-4912492a599e)  
**Date delivered**: On "continue" wave after approved continuation plan  
**Status**: Ready for immediate use the moment A1 (TS Hygiene) reports green.

This package contains the precise narrow execution charter, recommended sub-agent split, ready-to-paste prompts, risk matrix, and high-leverage observations for the active branch work (feat/agent-6-realtime-collaboration-invites + Home global workspace hub).

---

## 1. Precise Narrow Execution Charter (C4)

**C4 Mission** (exact match to Master Plan item 4 + current branch + FEATURE-GLOBAL-WORKSPACE-HUB.md + IMPROVEMENTS-INVITE-MEMBERSHIP-LIFECYCLE.md + AGENT-30/14/31/66/67 continuity):

Complete production-grade realtime collaboration + full symmetric invites/membership lifecycle + Home global workspace hub MVP. Bridge from prior Agent foundations to reliable multi-user live (demo pristine).

**Implement FIRST (narrow, guard-audited)**:
- **Invites + Membership Realtime Completion**: Every terminating action (create/accept/revoke/decline/exit/remove via existing RPCs + `cleanupInviteEverywhere`) must produce instant symmetric zero-orphan state across clients. Leverage/extend `subscribeToWorkspaceRealtime` + `onInviteChange`/`onMemberChange` + REPLICA FULL + fetch refresh.
- **Rich Presence + UI**: Extend existing onlineUsers + remoteCursors (presence-${wsId} + updatePresenceMeta) to Teams surfaces, sidebar, and Home (lightweight pulse indicators). No new channels.
- **Home Global Workspace Hub MVP (Phase A)**: Workspace Pulse, Today's Focus aggregates, Recent Movement (light activity), AI summary stub. Add minimal cross-ws hybrid helpers (member-scoped). Wire the already-extracted `features/home/HomeView.tsx`.

**Explicit De-Scope (this wave)**: Full Yjs/CRDT on notes, real email, advanced AI/calendar aggregates, ownership transfer, new tables/RPCs, heavy mobile changes.

**Success Criteria**:
- All invite/membership flows = symmetric zero-orphan + instant via realtime + RPCs (multi-tab, hard-refresh, concurrent live users, offline reconnect).
- Presence live in Teams + Notes + Home without regression or guard bypass.
- Home renders real (user-scoped) aggregates in demo + live; click = instant ws switch.
- 0 new TS errors (post-A1); 100% hybrid/demo/live guards preserved; full hygiene green.
- Thin extraction pattern honored.
- Demo invariant pristine.

**Governance (non-negotiable)**: Narrow charters. Internal `todo_write`. Mandatory full + targeted `read_file` + path-restricted `grep` after every edit. 100% demo/live/hybrid invariant preservation (isSupabaseLive + w1/w2 blocks at every entry) + zero new console errors. Fold only after main-thread verification.

---

## 2. Recommended Sub-Agent Split (Launch in Parallel Post-A1 Green)

**C4-Exec-1 (Invites Lifecycle + Realtime — P0, launch first)**  
Primary files: `lib/data/hybridStore.ts`, `store/useTaskStore.ts`, `app/page.tsx`  
Focus: Symmetric realtime + zero-orphan membership state.

**C4-Exec-2 (Rich Presence + UI)**  
Primary files: `app/page.tsx`, `features/teams/*`, `features/notes/editor/TipTapEditor.tsx`, `store/useTaskStore.ts`  
Focus: Extend presence/cursors into Home + Teams surfaces.

**C4-Exec-3 (Home Global Hub Aggregates)**  
Primary files: `lib/data/hybridStore.ts` (new lightweight helpers), `store/useTaskStore.ts`, `app/page.tsx`, `features/home/*`  
Focus: Phase A MVP wiring (the quick win — HomeView is already extracted but not wired).

**Coordination**: C4-Exec-1 acts as guard-consistency lead across the three.

---

## 3. Ready-to-Paste Prompt Template (Example for C4-Exec-1)

Copy the full charter + governance from Section 1 above into each new agent prompt. Adapt the focus + primary files for Exec-2 and Exec-3.

**Core Governance Block (paste verbatim into every C4 execution prompt)**:
"Narrow charters only. Zero scope creep. Every agent must use internal `todo_write` (minimum 4 steps: plan, research, implement, verify). Mandatory post-edit `read_file` (full file + targeted offsets) + path-restricted `grep` on every file touched before marking step complete. 100% preservation of demo/live/hybrid invariants, zero new console errors, feature-folder architecture. All work folded only after main-thread verification. Update living handoff docs with evidence."

---

## 4. Key Risk Matrix (Hybrid Guard / Demo Invariant)

**Highest**:
- Invite flows + realtime push on membership changes (races, hard-refresh windows, offline queue).
- Home cross-ws queries (must use separate lightweight slices; never broad scans; replicate "guard at VERY TOP" pattern from hybridStore line 623).
- Presence broadcast during ws switch or concurrent edits.

**Mitigation**: Copy exact patterns from existing `onPersistSnapshot`, `subscribeToWorkspaceRealtime` (idempotency guard at 2442+), and `cleanupInviteEverywhere`. All new paths must start with `if (!isSupabaseLive()) return safe;`.

---

## 5. High-Leverage Quick Wins Observed (Code vs. Handoffs)

- **Biggest instant win**: `features/home/HomeView.tsx` + barrel already shipped (exact Phase A structure from FEATURE-GLOBAL-WORKSPACE-HUB.md), but `app/page.tsx` still has duplicate inline `renderHomeView` (line ~1427) and never imports/uses the feature. Wiring + prop lift = massive progress for <20 LOC.
- Invites realtime is already strong (dedicated channels, on*Change handlers, full RPC + cleanup + REPLICA FULL).
- Presence (cursors + meta + demo simulator) is premium-ready from prior agents — just surface it in Home.
- `features/teams/*` correctly thin with "Future: thin wrappers" comments — safe to pull stable UI pieces.
- No real global aggregate fns yet (FEATURE §5 recommends separate slices) — perfect for narrow MVP.

---

## 6. Verification Steps (Once Execution Begins)

**Automated**:
- Full hygiene chain post-A1 baseline.
- Expand notes-m2-smoke + new hybrid/global tests.
- Playwright multi-context (2+ users + invite + Home flows).

**Manual (multi-tab on live Supabase)**:
- Owner sends invite → recipient sees instant in banner/bell.
- Accept/revoke/decline/exit/remove = symmetric instant zero-orphan across all tabs + hard refresh.
- Presence live across Notes/Teams/Home.
- Home aggregates real + click switches ws cleanly.
- Guard toggle test (.env on/off).

**Evidence**: Logs, Supabase dashboard state, screenshots, zero console errors, guard matrix grep.

**C4-Exec-2 (Rich Presence + UI) — completed thin wave**:
- Reused AGENT-14/30: onlineUsers (view/editingItem), remoteCursors, presence-${wsId} via updatePresenceMeta (no new channels).
- Surfaced lightweight pulse: Home Workspace Pulse cards (current-ws online + editing dot), Teams (rich editingItem badge on pills), sidebar (view + ✎ editing indicators).
- Notes cursors already live in TipTap overlay.
- 3 edits only (TeamsView + page.tsx); each followed by full+targeted read + path-restricted grep.
- Hygiene: 22 TS errors (unchanged M2 baseline); tsc confirmed. 100% demo/live/hybrid guards preserved (no new paths; data reuse only).
- No scope creep. Presence (view/editing + cursors) now live across Teams/Notes/Home + sidebar without regression.

---

**C4-Prep Agent ID (for reference)**: 019e7477-906c-7c21-beca-4912492a599e  
**Full diagnostic report**: Available via `get_command_or_subagent_output` on that ID.

This package enables true "instant activation" for the active realtime collab / invites / Home work the moment hygiene clears and the next "continue" is given.

---

*Prepared during autonomous "continue" wave under the approved Master Plan Progress Evaluation & Continuation Plan. All work stayed strictly read-only and within governance.*