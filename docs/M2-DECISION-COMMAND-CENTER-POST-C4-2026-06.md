# M2 Decision Command Center — Post-C4 — 2026-06

**One ultimate, low-friction document. Open this. Execute the smoke. Decide.**

**Status**: Post-C4 execution + consolidation complete. M2 Decision Readiness at maximum (corrected commands, explicit C4 surfaces, hygiene baseline, pre-drafted blocks). 

**Context**: This "continue" wave delivered full C4 (Invites + Realtime Symmetry P0 + Rich Presence + UI Surfaces + Home Global Workspace Hub MVP Phase A) under strict governance + refreshed all decision tooling. See [CURRENT-WAVE-STATUS-2026-06.md](./CURRENT-WAVE-STATUS-2026-06.md) for the high-signal synthesis.

**Critical**: The instant you paste M2 smoke results + screenshots + **exactly one** of the two decision phrases below, the main thread (or you) can close M2 cleanly using this document + the companion [M2-DECISION-READINESS-PACK-2026-06.md](./M2-DECISION-READINESS-PACK-2026-06.md). All prior M2 crown jewels remain fully valid.

**Post-Continue 2026-06 Update**: C4 surfaces (realtime invites symmetry, rich presence, Home Hub MVP Phase A) baseline on active branch. Zustand `safeLocalStorage` (`store/useTaskStore.ts`) eliminated persist "storage unavailable" warnings (console clean on hydration/SSR). References to `*-post-C4-20260529-105351.log` (hygiene auditor task `019e74de-faf0-7861-8cff-0b3354c955d0`, exit 0) + C4-WAVE-COMPLETION verification/hygiene report are current. Exact decision phrases, .tsx smoke commands (Windows/PowerShell), and cross-refs to M3/One-More-Wave starters + C4-WAVE-COMPLETION fully accurate. Zero ramp-up for instant activation on phrase.

**Latest Polish (this Continue. wave)**: Recommended first file: the dedicated [2026-06-DECISION-DAY-OPEN-THIS-FIRST.md](./2026-06-DECISION-DAY-OPEN-THIS-FIRST.md) ("OPEN THIS FIRST" one-pager). Follow with the retrospective [2026-06-LATEST-CONTINUE-WAVE-DELIVERED.md](./2026-06-LATEST-CONTINUE-WAVE-DELIVERED.md). Both call out the canonical WAVE8-MASTER-PLAN.md section "## 2026-06 Post-C4 + Zustand Hygiene Fix + Exhaustive Decision Package Ready (This Continue Wave)" as the authoritative record, plus GREEN hygiene + C4 surfaces + exact commands/phrases. Purely additive friction reduction at the gate.

---

## 1. Prerequisites & Project Root

```powershell
cd "C:\Build\Bad Ass Tasks"
git status   # Expect clean or note any uncommitted C4/M2 changes on the active branch
# npm install   # Only if package-lock changed
```

**Canonical Project Root** (quote exactly as shown; Windows is case-insensitive):  
`C:\Build\Bad Ass Tasks`

---

## 2. Full Hygiene Regression (MANDATORY Before Every Smoke)

**Post-C4 note**: C4 surgically touched shared core (`lib/data/hybridStore.ts`, `store/useTaskStore.ts`, `app/page.tsx` realtime/Home/invites wiring). A fresh full chain is now explicitly required before your M2 smoke for a trustworthy baseline.

**Recommended one-liner** (quick gate):
```powershell
npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e
```

**For rich timestamped logging** (matching the background post-C4 auditor run):
```powershell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"; `
npm run typecheck 2>&1 | Tee-Object -FilePath "typecheck-post-smoke-$timestamp.log"; `
npm run lint 2>&1 | Tee-Object -FilePath "lint-post-smoke-$timestamp.log"; `
npm run build 2>&1 | Tee-Object -FilePath "build-post-smoke-$timestamp.log"; `
npm run test 2>&1 | Tee-Object -FilePath "test-post-smoke-$timestamp.log"; `
npm run test:e2e 2>&1 | Tee-Object -FilePath "e2e-post-smoke-$timestamp.log"; `
Write-Host "Hygiene chain complete. Logs saved with timestamp $timestamp"
```

**Capture**: The **entire** terminal block (stdout + any stderr). Save to a dated file (e.g. `M2-hygiene-2026-06-XX.log`) if desired.

**Post-C4 Hygiene Baseline Reference**: See Section 3 below. Expect the documented pre-existing M2 residuals only. Zero delta from C4 work.

---

## 3. M2 Smoke Suite — Corrected Commands (Critical .tsx Fix)

**🚨 CRITICAL CORRECTION (post-C4 / legacy doc audit)**: Every prior M2 artifact (DECISION-DAY-*, SIGNOFF, WAVE8, EVIDENCE-PACK, TEST-RUN-INSTRUCTIONS, COMMAND-CENTER, M3 docs, etc.) incorrectly references `tests/notes-m2-smoke.test.ts`.  

**The actual file on disk is `tests/notes-m2-smoke.test.tsx`** (confirmed via directory listings, file reads, and prior execution logs). Using `.ts` will fail to locate the test. **This Command Center and the M2 Decision Readiness Pack are the corrected sources of truth going forward.**

**Primary one-liner (recommended — copy/paste exactly)**:
```powershell
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose
```

**Alternative (no directory change — good for scripts / CI)**:
```powershell
npx vitest run --root "C:\Build\Bad Ass Tasks" "tests/notes-m2-smoke.test.tsx" --no-watch --reporter=verbose
```

**Recommended high-signal variants** (for debugging or focused evidence):
```powershell
# Highest-leverage areas (Gap 1 sortOrder + recent renorm cases — historically highest signal)
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose -t "sortOrder|renormaliz|Gap Closers|Hierarchy drag|load-time|cross-parent|defensive guards|integer guarantees"

# General M2 surfaces
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose -t "M2|Gap Closers|sortOrder|DatabaseBlock|SyncedBlock|backlink|kanban|history|synced"

# Re-run single failing case (replace with exact it() title substring from stack)
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose -t "exact failing it title here"
```

**Via npm (alternative)**:
```powershell
npm test -- tests/notes-m2-smoke.test.tsx -- --reporter=verbose
```

**Expected (per post-C4 baseline)**: ~30–40 high-signal cases green (M2 Core Flows + M2 Gap Closers describe blocks + Server snapshot round-trip contract). ~23–36 core assertions on hierarchy/sortOrder, bidirectional, TaskEmbed, DatabaseBlock (Board + named views MVP), SyncedBlock, history contract, backlinks centralization, guards.

**If red**: Immediately open and use [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) — map the exact failing `it('title')` from the stack trace to the owning Gap (1–7) + charter.

**Keep these open while running**:
- [M2-SMOKE-RUN-COMPANION-2026-05-31.md](./M2-SMOKE-RUN-COMPANION-2026-05-31.md) (exact variants, full manual checklist, capture standards, troubleshooting).
- [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) (instant red → gap mapping).

---

## 4. Post-C4 Hygiene Baseline Summary

**Source**: Post-C4 Hygiene & Baseline Auditor (subagent, task ID `019e74de-faf0-7861-8cff-0b3354c955d0`). Full detailed report inserted in [C4-WAVE-COMPLETION-2026-06.md](./C4-WAVE-COMPLETION-2026-06.md) ("Post-C4 Hygiene Baseline Report" section). Supporting dated logs in repo root: `*-post-C4-20260529-105351.log` (typecheck, lint, build, test, e2e).

**Executive Baseline for Your Smoke Run**:
- **TypeScript (`npm run typecheck`)**: Exactly **22 errors** — *zero new* introduced by C4. Identical to pre-existing M2 extraction residuals documented across M2 crown jewels and C4 artifacts.
- **Lint**: Numerous warnings (unused imports/vars, primarily in `app/page.tsx` from monolith + extraction churn) + **Errors** for `@typescript-eslint/no-explicit-any` (widespread pre-existing across page, lib/*, etc.). C4 paths follow existing patterns; no new lint debt.
- **Build (`npm run build`)**: Fails to compile (due to lint `any` Errors treated strictly in config). Pre-existing (evidenced in prior logs); C4 changes did not alter the outcome.
- **Test (`npm run test`)**: 5/7 files fail, **30 failed / 120 total** + 6 unhandled errors. Includes M2 smoke fragility + harness issues (pre-dates C4).
- **E2E (`npm run test:e2e`)**: Completed successfully in the reference run (port fallback 3000→3001 noted in some executions).
- **Delta vs C4 Charter Claims**: 0. All "pre-existing ~22 M2 NotesView + test noise only; 0 introduced" validated with full reads/greps. This baseline is now the required reference for M2 decision.

**Categorized Residuals (All Pre-Existing M2 Debt — Zero New Debt from C4)**:
1. **M2 Extraction Contract Mismatches** (TypeScript, 3 errors in `app/page.tsx` ~1477,1498,1502): `addTask` / `openTask` / `onCreateSubNote` signatures incompatible with `useNoteOperations` hook interface. Context: M2 architectural cleanup wiring block.
2. **M2 Notes Surfaces Delegation / Polish Debt** (TypeScript, ~8 errors in `features/notes/***`): `NotesView.tsx`, `TipTapEditor.tsx` (implicit any, label/union), `useNoteOperations.ts` (Note vs ID, cycle logic any). Context: M2 extraction + polish areas.
3. **M2 Test File + Harness Issues** (TS + Runtime, ~11 TS + bulk of 30 fails): `notes-m2-smoke.test.tsx` (`baseProps` scope, advMockNotes any); missing `onPersistSnapshot` export in hybridStore mocks; jsdom limitations on native drag (DB kanban); SupabaseSetupBanner matcher; utils recurring engine; CommandPalette partials; hierarchy/sortOrder/kanban/sync edge assertions (M2 gap residuals).

**Lint/Build/Test Cross-Cutting**: Any casts (hundreds, defensive in data paths); unused symbols in page (realtime/auth vars post-extractions/C4 wiring); hook deps. All pre-C4 baseline.

**C4 Integration Risks Explicitly Audited (Low Risk)**:
- `lib/data/hybridStore.ts` (C4-Exec-3 + read-only Exec-1): New guarded `getGlobalRecentActivity(userId, limit)` (~2890–2955) — member-scoped via workspace_members join + IN filter on activity_logs; VERY TOP `isSupabaseLive()` + w1/w2 purge; bounded; light map to ActivityLog contract. Test mocks now incomplete for new surface (but additive/unguarded impact on M2 per-ws flows).
- `store/useTaskStore.ts` (C4-Exec-3): New interface `fetchGlobalHomeAggregates`, impl (~1270–1334) with separate `globalTodayFocus` / `globalRecentActivity` slices (never pollute per-ws `tasks`/`notes`). Selector exposure in page.
- `app/page.tsx` (heavy C4 wiring): `renderHomeView` delegator (~1440–1464), noteOps wiring block (~1466–1520), sidebar presence counts/editingItem. The 3 TS errors sit directly inside the pre-existing M2 noteOps block. C4 symbols appear in unused lint warnings.
- **Overall**: 100% demo/live/hybrid guards preserved (no bypasses). No new realtime channels/RPCs/tables. Home globals separate. M2 notes surfaces (hierarchy, DB blocks, history, backlinks) delegation intact. Test harness (esp. hybridStore mocks) is the highest friction point for post-C4 M2 smoke. Positive: C4 enables richer Home + presence without touching M2 core logic.

**Auditor Recommendation for Smoke**: After this hygiene baseline, run your M2 smoke per this Command Center / Readiness Pack. Explicitly exercise: Home hub (Pulse → switch → Notes), invites/realtime in parallel tabs, Notes M2 flows (drag, DB kanban, snapshots). Capture console (zero *new* errors), full hygiene re-run, screenshots. Any red → use Failure Mapper.

**Overall**: C4 invariants + governance pristine. Baseline transparent and documented. Ready for smoke + M2 decision. **No new debt introduced.**

---

## 5. Recommended Manual Verification Steps (Multi-Tab Live Supabase — Gold Standard)

Use **2+ incognito windows + real accounts** where possible. After `npm run dev`, hard refresh ×2 (Ctrl+Shift+R), open DevTools → Console (clear; filter Errors/Warnings; "Preserve log" enabled).

### Standard M2 Notes Crown Jewels (Full Details in SIGNOFF-CHECKLIST §3 + SMOKE-RUN-COMPANION)
1. **Hierarchy + Drag**: Create top-level + sub-notes. Drag reparent + intra-parent reorder. Verify no cycles, optimistic UI, stable order + expand state after hard refresh.
2. **Bidirectional Linking (core M2)**: Use header Linked Tasks dropdown, /link or /note-link picker, @mentions (auto link creation). Remove via panels or deletion. Verify full symmetry (task↔note + note↔note), backlink badges (← N), refresh persistence.
3. **Rich TaskEmbeds**: /task slash → live editable cards. Inline edit title/due/priority/status/assignee. Unlink + deleted state (red strikethrough). Click opens TaskModal; data stays live.
4. **Version History**: Header History + toolbar. Manual + title-change snapshots. Structured + JSON diff viewer. Restore (safety "Before restore" snapshot + confirm). Export JSON/TXT.
5. **DatabaseBlock (M2 interactive MVP)**: /db-block. Table ↔ Board switch. Filters + intra/inter-column drag. Edit View form (title/types/filters) → "Save current view" + Load dropdown (named views MVP). Persistence across reload.
6. **SyncedBlock**: /synced-block + picker. Re-sync, clickable source header nav, graceful missing state, live title sync (bidir MVP).

### NEW: Explicitly Exercise C4 Surfaces (Home Hub, Invites, Presence, Realtime Symmetry)
7. **Home Global Workspace Hub MVP — Phase A (C4-Exec-3)**:
   - Navigate to Home (default route or sidebar).
   - **Workspace Pulse**: Grid of cards (name + role badge) → instant `switchWorkspace` on click. Observe "live pulse" framing.
   - **Today's Focus**: Grouped actionable list (workspace pill + title + priority) → switch + tasks view.
   - **Recent Movement**: Scrollable light cross-ws activity feed (workspace prefix + action + title + time).
   - **AI Summary**: Prominent card with dynamic count-based cross-ws briefing stub + "coming soon" teaser.
   - Hard refresh on Home → aggregates repopulate cleanly.
   - Toggle .env (Supabase keys on/off) → graceful demo synthesis vs live member-scoped pulls (no breakage).
   - Confirm separate global slices (no pollution of per-ws state).

8. **Invites + Membership Lifecycle + Realtime Symmetry — P0 (C4-Exec-1)**:
   - Owner in Tab A: Send invite to recipient email.
   - Recipient in Tab B: Instant banner/bell notification (no refresh required).
   - Recipient accepts → instant switch + member list update in owner Tab A.
   - Owner: Revoke or recipient declines → instant clear on both sides.
   - Hard refresh all tabs mid-flow → zero orphans (init fetches + realtime resume + RPC truth via `cleanupInviteEverywhere`).
   - Self "Leave team" (non-owner in live workspace) → instant access loss for actor + clean list for others.
   - Remove member (owner) → survivor lists clean; removed user loses access on next action.
   - Concurrent: Two owners removing/editing members → symmetric state.
   - Exercise last-owner protection and self-exit paths.
   - (Live Supabase): Confirm notifications refetch on `onInviteChange`/`onMemberChange`.

9. **Rich Presence + UI Surfaces (C4-Exec-2)**:
   - Open Notes + Teams + Home across different tabs/sessions.
   - **Sidebar** (in `app/page.tsx`): Per-view live counts (👁N) + ✎ editing indicators on nav items.
   - **TeamsView**: Rich editingItem "editing X" badges on pills + full online list with status (view + editingItem). Zap icon + pulsing elements.
   - **Home**: Workspace Pulse cards framed with "live pulse" context (via aggregates wiring).
   - **Notes**: Remote cursors visible to other users in TipTap overlay (pre-existing, reconfirmed no regression).
   - Switch workspaces or views → presence meta updates cleanly via `updatePresenceMeta` on `presence-${wsId}` (no leaks; reuse of AGENT-14/30 primitives only — no new channels).
   - Observe `onlineUsers` with view/editingItem across surfaces.

10. **Cross-Cutting Guards & Realtime Symmetry**:
    - Guard toggle test: Remove Supabase keys from .env → pure demo (synthesized Home aggregates + no invites/presence leaks or errors).
    - Zero console errors across **all** flows (Notes crown jewels + C4 surfaces).
    - Hard refresh ×2 + offline reconnect mid-flow on every surface → state (hierarchy, links, DB views, history snaps, membership, aggregates, presence) survives perfectly.
    - (Live Supabase): Supabase dashboard — confirm realtime publications + REPLICA IDENTITY FULL on `workspace_invites` / `workspace_members` (pre-existing M1). Watch postgres_changes channels.
    - Workspace switch via new Home hub preserves Notes state / presence cleanly.

**Post-Verification Hygiene**: Re-run the full hygiene chain above. Confirm no regressions introduced by exercising Home switching, invites, or presence alongside M2 Notes flows.

**Evidence to Capture**: Screenshots of multi-tab states, Supabase Realtime inspector/logs, console clean, full hygiene + smoke output. Full steps also in C4-WAVE-COMPLETION verification section + C4 charter §6.

---

## 6. What to Capture Checklist (Non-Negotiable Standard for Decision)

**Minimum for confident decision** (paste or attach in your reply):

**Terminal Output**:
- Complete hygiene chain run (full stdout + any stderr).
- M2 smoke one-liner run (full stdout; use `--reporter=verbose` if any failures or for rich evidence).
- Any focused re-runs (with `-t` filters or single titles).

**Screenshots** (2–8 high-signal, timestamped filenames recommended; include C4 surfaces):
1. Sidebar + editor note hierarchy tree (show drag in progress or stable post-reparent + backlink badges ← N).
2. DatabaseBlock Board view (drag between columns + Edit View form open showing "Save current view" button + named views Load dropdown populated).
3. Version History panel (diff viewer side-by-side with highlights + Restore button / confirm dialog).
4. SyncedBlock or TaskEmbed live card (inline edit + bidirectional panel symmetry visible).
5. **Home Hub surfaces**: Workspace Pulse cards (with "live pulse" framing) + Today's Focus grouped list + Recent Movement feed + AI summary stub.
6. **Presence surfaces**: TeamsView rich editing badges + online list + sidebar 👁 counts / ✎ dots.
7. **Invites realtime symmetry**: Multi-tab view (owner send + recipient instant banner + post-accept state).
8. DevTools Console tab (after hard refresh ×2 on Notes + Home + Teams; filter Errors; ideally "Preserve log"; show completely clean or only expected non-errors).

**Console / Runtime Statements** (explicit):
- "Zero *new* console errors on Notes surfaces + C4 surfaces (Home hub, invites flows, rich presence) post hard refresh ×2 (demo and live if tested)."
- Any warnings that are pre-existing / defensive only (note them explicitly).

**Other Strong Signals** (optional but high value):
- `git status` + short `git diff --stat` (or full diff if changes present).
- Browser network tab or Supabase dashboard (if live) showing no errors during key flows.
- Dated log files committed or pasted (e.g. `M2-smoke-evidence-2026-06-XX.txt` or the Tee logs from hygiene).
- Reference to [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) — note pass/fail per invariant and per gap area mentally or in text.

**Failure protocol**: Any red smoke → open [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) immediately. Do not declare M2 done.

---

## 7. Exact Decision Phrases (Reply with Precisely One)

- `"M2 done — begin user-led refinement/M3"`
- `"one more wave on the 7 gaps (with specific priorities)"` (include your additional priorities if choosing this path)

**Non-negotiable for both paths**:
- The user's smoke results + screenshots + console confirmation pasted.
- Reply using the **exact phrase** (no paraphrasing).
- Re-run of hygiene + M2 smoke + manual (including C4 surfaces) after any code changes in the chosen path.

---

## 8. Pre-Drafted Sections for WAVE8-MASTER-PLAN.md

Copy the appropriate block **verbatim** (or lightly adapt with your date + evidence links) and insert it **immediately after the existing "M2 Status as of 2026-05-28 / 05-31 Closeout" synthesis section** (around the end of the long M2 block that ends with the 11-invariant table and "Next User Actions"; after the marker "(End of inserted M2 Status as of 2026-05-28 / 05-31 Closeout section)" — see WAVE8 or CURRENT-WAVE-STATUS-2026-06.md for precise context).

### Option A — If user replies exactly: "M2 done — begin user-led refinement/M3"

```markdown
## M2 Decision: COMPLETE — "M2 done — begin user-led refinement/M3" (2026-06-XX)

**User Decision Phrase (exact)**: "M2 done — begin user-led refinement/M3"  
**Decision Date**: 2026-06-XX (PT)  
**Evidence Pack**: See attached/pasted M2 smoke results + screenshots + this Readiness Pack (docs/M2-DECISION-READINESS-PACK-2026-06.md) + Post-C4 Command Center (docs/M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md). Full hygiene + `notes-m2-smoke.test.tsx` passed 100%. Manual Notes smoke (hierarchy, bidirectional, TaskEmbeds, History, DatabaseBlock named views, SyncedBlock) + C4 surfaces (Home hub aggregates + instant switch, invites + membership realtime symmetry zero-orphan, rich presence across Teams/Sidebar/Home/Notes) passed with zero new console errors and perfect refresh persistence in demo (and live when tested). Post-C4 hygiene baseline (22 TS pre-existing M2 debt only; 0 delta) confirmed.

**7 Gaps Status at Sign-Off**:
- 1. Stable integer sortOrder normalization — Closed (production-grade load-time + post-mutation renorm, integer Math.floor midpoint math, defensive guards).
- 2. Backlinks centralization — Closed (`useBacklinks` single source of truth).
- 3. DatabaseBlock production completeness — Strong MVP + named saved views delivered; explicit M2→M3 bridge for full server query/RPC + custom NodeView (see M3-1 charter).
- 4. Version History depth — Closed (structured/JSON diff + complete `onPersistSnapshot` round-trip contract).
- 5. SyncedBlock bidirectional + polish — Strong MVP (live title sync + heavy scaffolding); explicit M2→M3 bridge for full content sync (see M3-2 charter).
- 6. Monolith slimming (narrow) + test execution — Closed (multiple extractions; `renderNotesView` thin; expanded smoke suite + Windows-executable instructions delivered and passing).
- 7. Mobile/keyboard a11y depth + AI wiring — Addressed on new surfaces (44px+ targets, ARIA); AI slash stubs with explicit "WHERE THE xAI/Grok CALL WILL GO" markers present (deeper integration = M3-3).

**Invariants**: All 11 verified (8 GREEN production-grade in static + prior audits; 3 YELLOW purely user-executable hygiene/smoke/manual — now GREEN per user's run). Demo/live/hybrid separation pristine. Zero new console errors across the entire Notes surface + all C4 collaboration surfaces. Post-C4 hygiene baseline (22 TS pre-existing only) confirmed 0 delta from wave.

**C4 Surfaces Delivered & Verified (2026-06)**: Invites + membership lifecycle (every terminating action = symmetric zero-orphan realtime via postgres_changes + RPC cleanups + fetch fallbacks; multi-tab/hard-refresh/concurrent/offline reconnect); Rich Presence (lightweight pulse indicators reused from AGENT-14/30 primitives across Teams rich pills + online list, Sidebar counts/✎, Home "live pulse", Notes cursors — no new channels); Home Global Workspace Hub MVP Phase A (real aggregates via guarded hybrid helpers + separate global slices; Workspace Pulse instant switch, Today's Focus, Recent Movement, AI stub; 100% hybrid/demo/live).

**Overall M2 State**: Production-grade "love child of Notion + Obsidian + Linear" Notes platform delivered for M2 scope. Notes + deep bidirectional Task integration is addictive, hierarchical, versioned, embeddable, and ready for user-led refinement or M3 acceleration. C4 realtime collaboration foundations (invites + presence + Home hub) now live on top without regression.

**Next**: Immediately activate M3 per [M3-KICKOFF-IF-M2-DONE-2026-05-31.md](./M3-KICKOFF-IF-M2-DONE-2026-05-31.md) and [M3-READY-EXECUTION-PROMPTS-2026-06.md](./M3-READY-EXECUTION-PROMPTS-2026-06.md). Launch M3-1 (DatabaseBlock server query/RPC), M3-2 (SyncedBlock full bidirectional content sync), M3-3 (AI editor integration) **in parallel**. Update this Master Plan with M3 status blocks. 48-hour post-decision playbook in [M2-POST-DECISION-48HOUR-PLAYBOOK-2026-05-31.md](./M2-POST-DECISION-48HOUR-PLAYBOOK-2026-05-31.md) applies for user refinement window. Fold C4 work to main + additive updates to README "Current Status", WAVE8, and MILESTONE-2-PROGRESS with cross-refs to C4-WAVE-COMPLETION-2026-06.md and this Command Center.

**Prepared by**: User decision + M2 Decision Command Center Post-C4 (2026-06) + Readiness Pack. All prior waves (10-agent + closeout + C4) maintained obsessive governance.
```

### Option B — If user replies exactly: "one more wave on the 7 gaps (with specific priorities)"

```markdown
## One More Wave Authorized on the 7 Gaps — "one more wave on the 7 gaps (with specific priorities)" (2026-06-XX)

**User Decision Phrase (exact)**: "one more wave on the 7 gaps (with specific priorities)"  
**Decision Date**: 2026-06-XX (PT)  
**User-Specified Priorities**: [PASTE USER'S ADDITIONAL PRIORITIES HERE — e.g. "focus P-3 on server stubs for DB + richer History diff first; tighten Home presence indicators per card"]  
**Evidence Pack**: See attached/pasted M2 smoke results + screenshots + this Readiness Pack (docs/M2-DECISION-READINESS-PACK-2026-06.md) + Post-C4 Command Center. Hygiene + smoke executed; any red signatures mapped via Failure Mapper and addressed in this wave. C4 surfaces (Home hub, invites realtime symmetry, rich presence) exercised with zero new console errors and perfect persistence.

**Rationale for Additional Wave**: User review of smoke/manual results + 7 gaps identified remaining edges (explicit M2→M3 bridges or polish items) that benefit from one final narrow, high-governance targeted execution before declaring M2 complete. C4 foundations now provide richer realtime context for any final Notes polish.

**Wave Scope (per [M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md](./M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md) + [M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md))**:
- P-1: Gap 1 final sortOrder edges (if any)
- P-2: Gap 2 backlink consumers (if any)
- P-3: Gaps 3+4 (DatabaseBlock server query stubs/RPC + History server snapshot depth)
- P-4: Gap 5 (SyncedBlock full bidirectional content + edge cases)
- P-5: Gaps 6+7 (final slimming + test expansion + a11y/AI wiring polish)

**Governance for This Wave**: Identical strict rules (todo_write, read_file + grep after every edit, invariant preservation, zero new console errors). All work folded only after main-thread verification. Re-run full hygiene + M2 smoke + manual smoke (including explicit C4 surfaces: Home, invites, presence) at wave close. Update this Master Plan + MILESTONE-2-PROGRESS + SIGNOFF with fresh evidence. No scope creep into C4 follow-ons (e.g. Home Phase B, test expansion for invites) unless explicitly de-scoped from the 7 gaps + user's stated priorities.

**Post-Wave Expectation**: One final user smoke gate (full hygiene + `notes-m2-smoke.test.tsx` + manual including C4 surfaces). Then re-present for the M2 done decision (or further narrow de-scope). No scope creep beyond the 7 gaps + user's stated priorities.

**Next**: Launch P-1 through P-5 sub-agents in parallel using the exact spawn-ready prompts in [M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md). Track in living docs. After completion + user re-verification smoke, return to Decision Day with updated evidence. C4 work remains available for fold post-final M2 sign-off.

**Prepared by**: User decision + M2 Decision Command Center Post-C4 (2026-06) + Readiness Pack. All prior waves maintained obsessive governance.
```

**Insertion Tip**: After pasting the chosen block, also consider a one-line update at the very top "M2 Status" summary table if present, and ensure the "Next User Actions" list is superseded by the decision text. Cross-reference the Post-C4 Command Center, C4-WAVE-COMPLETION-2026-06.md, and CURRENT-WAVE-STATUS-2026-06.md.

---

## 9. What Happens Next — Decision Matrix (Short Reference)

Full matrix + activation details in [M2-DECISION-READINESS-PACK-2026-06.md](./M2-DECISION-READINESS-PACK-2026-06.md) §4.

| Exact Decision Phrase                              | Immediate User / Main-Thread Actions                          | Primary Activation Documents to Use Immediately                                                                 | Sub-Agent / Wave Launch                                                                 | WAVE8-MASTER-PLAN + Living Docs Updates                  | Post-Decision Focus & Timeline Notes |
|----------------------------------------------------|---------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|----------------------------------------------------------|--------------------------------------|
| **"M2 done — begin user-led refinement/M3"**      | User begins personal debugging/refinement on Notes surfaces. Main thread shifts to M3 orchestration + user support. Full refinement window opens (48h playbook recommended). | [M3-KICKOFF-IF-M2-DONE-2026-05-31.md](./M3-KICKOFF-IF-M2-DONE-2026-05-31.md)<br>[M3-READY-EXECUTION-PROMPTS-2026-06.md](./M3-READY-EXECUTION-PROMPTS-2026-06.md)<br>This Command Center + Readiness Pack | **Launch in parallel**: M3-1 (DBBlock server query/RPC + NodeView), M3-2 (SyncedBlock full content sync), M3-3 (AI editor xAI/Grok integration). Use verbatim spawn templates in kickoff. | Insert Option A block above. Add M3 status sections. Mark Agent 46 M2 charter complete. Update 7 gaps to "Closed / Bridged". Add C4 record. Fold + README cross-refs. | M3 Phase 3+ acceleration (AI + Graph, advanced views, realtime for new surfaces). User owns Notes polish. Demo remains pristine. C4 foundations live. |
| **"one more wave on the 7 gaps (with specific priorities)"** | User provides any additional priorities. One final narrow targeted wave executes under full governance. Re-present smoke results for final decision at end. | [M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md](./M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md)<br>[M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md)<br>This Command Center + Readiness Pack + Failure Mapper (if any prior reds) | **Launch in parallel**: P-1 to P-5 per user's priorities (Gap 1 sortOrder, Gap 2 backlinks, Gaps 3+4 DB+History, Gap 5 Synced, Gaps 6+7 slim+tests+a11y). Strict narrow charters. | Insert Option B block above. After wave: re-run smoke (incl. C4 surfaces), update M2 Status with wave outcome + final evidence. | Short, high-signal wave (days). Zero scope creep. Final user smoke gate required before M2 can be declared done. Then matrix row 1 applies. C4 remains for post-M2 fold. |

**Both paths require**:
- The user's smoke results + screenshots + console confirmation pasted.
- Reply using the **exact phrase** (no paraphrasing).
- Re-run of hygiene + M2 smoke (and manual C4 surfaces) after any code changes in the chosen path.

---

## 10. Direct Links to All Supporting Artifacts

**Core Post-C4 Decision Package (Open These First)**:
- This document: `docs/M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md` (ultimate practical runner)
- [M2-DECISION-READINESS-PACK-2026-06.md](./M2-DECISION-READINESS-PACK-2026-06.md) — The complete companion (corrected commands source, evidence standards, full decision matrix, pre-drafted blocks, references)
- [CURRENT-WAVE-STATUS-2026-06.md](./CURRENT-WAVE-STATUS-2026-06.md) — "Continue" wave summary, hygiene baseline, paste-ready next-step commands
- [C4-WAVE-COMPLETION-2026-06.md](./C4-WAVE-COMPLETION-2026-06.md) — Executive summary of shipped C4, per-Exec evidence, **full Auditor post-C4 hygiene baseline report**, multi-tab verification matrix, open edges (pre-existing M2 debt only)
- [C4-INVITES-REALTIME-HANDOFF.md](./C4-INVITES-REALTIME-HANDOFF.md) — Exec-1 detailed handoff + verification
- [C4-READY-EXECUTION-CHARTER-2026-06.md](./C4-READY-EXECUTION-CHARTER-2026-06.md) — Original narrow charters + Exec-2 completion note

**Living Master Plan & Supporting Design**:
- [WAVE8-MASTER-PLAN.md](./WAVE8-MASTER-PLAN.md) — Insert Option A or B blocks here (post-Closeout section); already contains C4-Exec-1 + Consolidator records (~976+)
- [FEATURE-GLOBAL-WORKSPACE-HUB.md](./FEATURE-GLOBAL-WORKSPACE-HUB.md) — Home Global Hub design (Phase A MVP matches §8 exactly)
- [IMPROVEMENTS-INVITE-MEMBERSHIP-LIFECYCLE.md](./IMPROVEMENTS-INVITE-MEMBERSHIP-LIFECYCLE.md)

**M2 Crown Jewels (Still Fully Canonical & Unchanged by C4)**:
- [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) — 7 gaps definitions + 11 invariants + manual checklist + "What Good Looks Like"
- [M2-READINESS-REPORT-2026-05-31.md](./M2-READINESS-REPORT-2026-05-31.md)
- [10-AGENT-WAVE-COMPLETION-2026-05-31.md](./10-AGENT-WAVE-COMPLETION-2026-05-31.md)
- [M2-EVIDENCE-PACK-2026-05-31.md](./M2-EVIDENCE-PACK-2026-05-31.md) — Single master aggregation
- [M2-SMOKE-RUN-COMPANION-2026-05-31.md](./M2-SMOKE-RUN-COMPANION-2026-05-31.md) — **Primary live helper — keep open during smoke**
- [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) — **Primary red-smoke tool — open immediately on any failure**
- [M2-DECISION-DAY-COMMAND-CENTER-2026-05-31.md](./M2-DECISION-DAY-COMMAND-CENTER-2026-05-31.md) + [M2-DECISION-DAY-2026-05-31.md](./M2-DECISION-DAY-2026-05-31.md) — Prior Decision Day artifacts (commands now superseded by corrected versions here)
- [M2-POST-DECISION-48HOUR-PLAYBOOK-2026-05-31.md](./M2-POST-DECISION-48HOUR-PLAYBOOK-2026-05-31.md) — Especially relevant for "M2 done" path

**Dual-Path Activation (Use the Instant Exact Phrase Arrives)**:
- **If "M2 done..."**: [M3-KICKOFF-IF-M2-DONE-2026-05-31.md](./M3-KICKOFF-IF-M2-DONE-2026-05-31.md) + [M3-READY-EXECUTION-PROMPTS-2026-06.md](./M3-READY-EXECUTION-PROMPTS-2026-06.md) — Spawn-ready prompts for parallel M3-1 / M3-2 / M3-3
- **If "one more wave..."**: [M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md](./M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md) + [M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md) — P-1 through P-5 spawn-ready charters

**Hygiene, Ops & Historical**:
- Post-C4 hygiene logs (repo root): `typecheck-post-C4-20260529-105351.log`, `lint-post-C4-20260529-105351.log`, `build-post-C4-20260529-105351.log`, `test-post-C4-20260529-105351.log`, `e2e-post-C4-20260529-105351.log`
- [M0-HYGIENE-RUNBOOK.md](./M0-HYGIENE-RUNBOOK.md) — Command reference patterns
- [M2-TEST-RUN-INSTRUCTIONS.md](./M2-TEST-RUN-INSTRUCTIONS.md)
- [MILESTONE-2-PROGRESS-2026-05-28.md](./MILESTONE-2-PROGRESS-2026-05-28.md)
- README.md (additive "Current Status" / Wave 8 cross-refs appropriate post-decision + fold)

All paths require identical obsessive governance: narrow charters, internal `todo_write`, mandatory post-edit `read_file` + path-restricted `grep`, 100% demo/live/hybrid invariant preservation (`isSupabaseLive()` + w1/w2 blocks at every entry), zero new console errors.

---

**Ready. Execute in this order**:
1. Hygiene chain (capture full output)
2. M2 smoke one-liner (Companion + Mapper open; verbose recommended)
3. Manual verification (M2 crown jewels + **explicit C4 surfaces**: Home hub, invites symmetry, presence, realtime)
4. Capture evidence per checklist above
5. Reply with full evidence + **exactly one** decision phrase

The entire package (this Command Center + Readiness Pack + C4 Completion + Current Wave Status + all crown jewels) is mature, corrected, practical, and frictionless. Governance preserved end-to-end across the "continue" wave. Let's close M2 cleanly and make the next phase legendary.

*Pure synthesis from on-disk artifacts only under strict internal todo_write + verification discipline. No invention. Low noise. Immediately actionable.*

**End of M2 Decision Command Center — Post-C4 — 2026-06**
