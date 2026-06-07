# M3 Path Starter Pack 2026-06

**Status**: READY FOR INSTANT ACTIVATION.  
**Exact User Trigger Phrase (verbatim)**: `"M2 done — begin user-led refinement/M3"`  
**Prepared**: Post-C4 wave (after hygiene baseline auditor task `019e74de-faf0-7861-8cff-0b3354c955d0` and full decision tooling refresh).  
**Purpose**: Lightweight, zero-ramp-up package. The moment the trigger phrase is received, copy the two prompts below verbatim into parallel sub-agents (M3-1 + M3-2). No additional instructions required.

This pack synthesizes the highest-signal content from:
- [M3-KICKOFF-IF-M2-DONE-2026-05-31.md](./M3-KICKOFF-IF-M2-DONE-2026-05-31.md)
- [M3-READY-EXECUTION-PROMPTS-2026-06.md](./M3-READY-EXECUTION-PROMPTS-2026-06.md)
- [M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md](./M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md) (post-C4 corrections + hygiene baseline)
- Supporting C4 artifacts and M2 crown jewels.

All content is copy-clean with only minor currency updates (test filename `.tsx` correction, explicit post-C4 hygiene references, C4 interaction notes).

---

## Recommended Launch Order & Protocol

1. User pastes full smoke/hygiene evidence + exactly: `"M2 done — begin user-led refinement/M3"`
2. **Immediately spawn M3-1 and M3-2 in parallel** (highest-priority first wave; Gap 3 & 5 bridges).
3. (Optional but recommended) Spawn M3-3 (Deeper AI Integration in Editor) in the same wave if parallel capacity exists.
4. Each agent **must**:
   - Start with internal `todo_write` (plan / research / implement / verify).
   - Perform exhaustive initial `read_file` (full + targeted) + path-restricted `grep` on all Primary Files.
   - After **every** edit: full + targeted `read_file` + `grep` verification before next step.
   - Preserve 100% demo/live/hybrid invariants (`isSupabaseLive()` + w1/w2 guards at VERY TOP of every hybridStore path).
   - Zero new console errors, zero TS delta beyond baseline.
5. After first wave completion: main thread consolidates evidence, updates living docs (WAVE8-MASTER-PLAN.md, MILESTONE-2-PROGRESS-2026-05-28.md, M2-SIGNOFF-CHECKLIST-2026-05-31.md §5), and prepares any follow-on M3 slices.
6. Re-run full hygiene chain + relevant M2 smoke slices + manual verification (including C4 surfaces) after M3 changes.

**Non-Negotiable Governance (embed in every M3 agent prompt)**:
- Narrow charters only. Zero scope creep.
- Every agent **must** use internal `todo_write` (minimum 4 steps: plan, research, implement, verify).
- **Mandatory** post-edit `read_file` (full file + targeted offsets) + path-restricted `grep` on every file touched before marking step complete.
- 100% preservation of demo/live/hybrid invariants, zero new console errors, feature-folder architecture.
- All work folded only after main-thread verification.
- Update living handoff docs (MILESTONE-2-PROGRESS, WAVE8-MASTER-PLAN M2/M3 status, SIGNOFF-CHECKLIST §5) with evidence.

---

## Prompt 1 — M3-1: DatabaseBlock Server Query / RPC Engine Slice (Gap 3 — Highest Priority)

```
You are M3-1: DatabaseBlock Full Production + Hybrid Server Query/RPC Engine Agent (Gaps 3 focus).

**Narrow Charter (verbatim from approved M3 Starting Kit + post-C4 diagnostic)**: Build directly on the delivered M2 MVP (interactive Board/kanban with intra+inter drag, full queryConfig auto-persist, named saved views MVP). Implement the first production slice of the hybrid query execution engine + RPC hook foundations using the polished "M2→M3 SERVER QUERY ENGINE STUBS / RPC FOUNDATION" scaffolding in `database-block.ts` and `database-block-node-view.tsx`. Deliver stable result shapes, RLS/hybrid-aware queries (demo guards non-negotiable), minimal working server query path (or fully documented RPC stubs per AGENT-64). Leave all existing M2 UI, drag, filters, views, and persistence untouched. Add explicit next-M3 markers.

**Success Criteria**:
- Named views save/load/apply/persist correctly in both demo and live Supabase.
- At least one end-to-end server-backed query (filtered/aggregated) executes via new RPC foundation without errors or invariant violations.
- All M2 Board/kanban behaviors, drag, queryConfig persistence 100% unchanged and green.
- Expanded smoke/manual coverage for the new query paths.
- Scaffolds remain crystal-clear for subsequent M3 slices.

**Non-Negotiable Governance**:
- Narrow charters only. Zero scope creep.
- Every agent must use internal `todo_write` (minimum 4 steps: plan, research, implement, verify).
- Mandatory post-edit `read_file` (full file + targeted offsets) + path-restricted `grep` on every file touched before marking step complete.
- 100% preservation of demo/live/hybrid invariants, zero new console errors, feature-folder architecture.
- All work folded only after main-thread verification.
- Update living handoff docs (MILESTONE-2-PROGRESS, WAVE8-MASTER-PLAN M2/M3 status, SIGNOFF-CHECKLIST §5) with evidence.

**Primary Files (read 100% first, multiple targeted reads required; post-C4 hygiene baseline applies)**:
- features/notes/editor/extensions/database-block.ts (primary home for getDatabaseBlockData stub, DatabaseBlockQueryInput/Result types, full "WHERE THE REAL SERVER QUERY ENGINE WILL GO" + 7-step M3 plan, isSupabaseLive guard, HANDOFF comments)
- features/notes/editor/extensions/database-block-node-view.tsx (M2 interactive MVP + cross-ref M3 scaffold comment at ~884-893; "M3 Preview" badge + queryConfig usage)
- lib/data/hybridStore.ts (query patterns, isSupabaseLive guards at top of every export per line 623-625, onPersistSnapshot as exact template for retry/logging/fallback + sanitizeId/w1/w2 hygiene; note C4 additions: getGlobalRecentActivity + fetchGlobalHomeAggregates at bottom — follow identical VERY TOP guard pattern exactly)
- supabase/schema.sql (read-only reference for RPC patterns, notes/tasks tables, existing SECURITY DEFINER RPCs per AGENT-64)
- tests/notes-m2-smoke.test.tsx (for expansion coverage — NOTE: must use .tsx extension)
- docs/M2-SIGNOFF-CHECKLIST-2026-05-31.md §5, docs/M3-KICKOFF-IF-M2-DONE-2026-05-31.md, docs/M2-READINESS-REPORT-2026-05-31.md, docs/MILESTONE-2-PROGRESS-2026-05-28.md (M3 Bridge Scaffolding + follow-up wave details), AGENT-64-SCHEMA-RPC-PROPOSAL.md, AGENT-72-PHASE2-NOTES-PROPOSAL.md, plus post-C4 references: M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md and C4-WAVE-COMPLETION-2026-06.md

**Prioritized Narrow First Slice Recommendation (post-C4 synthesis)**: 
1. Implement minimal `getDatabaseBlockData` body inside the isSupabaseLive() branch (or thin re-export to new/hybridStore helper) for one narrow filter (e.g., status or priority on tasks only) using direct guarded .from() or new SECURITY DEFINER RPC modeled on existing workspace/invite RPCs.
2. Add stable result shape + meta.source = "server".
3. Wire a single call site (e.g., optional hook or NotesView path for DB blocks only).
4. Preserve 100% client-side rendering + queryConfig paths.
5. Add 2-3 smoke cases + manual verification of guard + live toggle.
Explicitly document next M3 slice (full RPC + richer saved views server backing).

Execute with perfect fidelity:
1. Begin with todo_write (plan/research/implement/verify).
2. Perform exhaustive initial read_file + grep on all Primary Files.
3. Implement only within charter.
4. After every edit: immediate full + targeted read_file + grep verification.
5. Preserve all invariants. Zero console errors.
6. Upon completion: concise evidence summary + propose updates to MILESTONE-2-PROGRESS and WAVE8-MASTER-PLAN.

Report status only through structured updates. No assumptions.
Post-C4 note: Full hygiene chain (typecheck/lint/build/test/e2e) + relevant M2 smoke slices required before first edit and after completion. Baseline = exactly 22 pre-existing TS errors (M2 residuals only; 0 delta introduced by C4).
```

---

## Prompt 2 — M3-2: SyncedBlock Full Content Bidirectional + Richer Edges (Gap 5 — Highest Priority)

```
You are M3-2: SyncedBlock Full Bidirectional Content Sync + Production Edges Agent (Gap 5 focus).

**Narrow Charter (verbatim from approved M3 Starting Kit + post-C4 diagnostic)**: Advance the title-only bidirectional MVP to full content bidirectional live sync. Implement using the polished "M2→M3 FULL CONTENT BIDIRECTIONAL SYNC SCAFFOLDING", "CONTENT_WRITE STUB", cycle handling, and edge comments in `synced-block.ts` and `synced-block-node-view.tsx`. Production-grade handling for missing/deleted targets, cycles, deep hierarchies, permissions, live auto-updates on source change. Strengthen any remaining scaffolding. Preserve picker, navigation, title-sync, and all M2 behaviors perfectly.

**Success Criteria**:
- Full note content syncs bidirectionally and live (source change triggers target update and vice-versa) in demo + live.
- All edge cases from the M2→M3 scaffolding (deleted/missing, cycles, hierarchies) handled gracefully with no data loss or crashes.
- Title sync, picker, and navigation continue to work identically (zero regression).
- Smoke + manual verification exercises full sync + edges.
- Remaining content sync work clearly marked for any follow-on M3.

**Non-Negotiable Governance**:
- Narrow charters only. Zero scope creep.
- Every agent must use internal `todo_write` (minimum 4 steps: plan, research, implement, verify).
- Mandatory post-edit `read_file` (full file + targeted offsets) + path-restricted `grep` on every file touched before marking step complete.
- 100% preservation of demo/live/hybrid invariants, zero new console errors, feature-folder architecture.
- All work folded only after main-thread verification.
- Update living handoff docs (MILESTONE-2-PROGRESS, WAVE8-MASTER-PLAN M2/M3 status, SIGNOFF-CHECKLIST §5) with evidence.

**Primary Files (read 100% first; post-C4 hygiene baseline applies)**:
- features/notes/editor/extensions/synced-block.ts (options.onUpdateNote typed for content, addNodeView forwarding, massive M2→M3 header docs + HANDOFF comments)
- features/notes/editor/extensions/synced-block-node-view.tsx (CONTENT_WRITE STUB at ~217-232, major "M2→M3 FULL CONTENT BIDIRECTIONAL SYNC SCAFFOLDING" block ~182-215 with phases/production reqs/serializer points, "M2→M3 LIVE" badge + read-only footer at ~596/625, handleTitleCommit + cycle prevention + auto-effect + HANDOFF comments throughout, extractPlainTextFromTipTap marked as M3 point)
- features/notes/editor/TipTapEditor.tsx (minimal onUpdateNote prop drill + SyncedBlock.configure wiring)
- lib/data/hybridStore.ts (query/update patterns + guards; C4 global additions follow same VERY TOP guard discipline)
- tests/notes-m2-smoke.test.tsx (for expansion coverage — NOTE: must use .tsx extension)
- docs/M2-SIGNOFF-CHECKLIST-2026-05-31.md §5, docs/M3-KICKOFF-IF-M2-DONE-2026-05-31.md, docs/M2-READINESS-REPORT-2026-05-31.md, docs/MILESTONE-2-PROGRESS-2026-05-28.md (M3 Bridge Scaffolding Enhancer + SyncedBlock sub-agent details on edges + scaffolding), AGENT-72-PHASE2-NOTES-PROPOSAL.md, plus post-C4 references: M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md and C4-WAVE-COMPLETION-2026-06.md

**Prioritized Narrow First Slice Recommendation (post-C4 synthesis)**: 
1. Uncomment/implement plain-text CONTENT_WRITE path (controlled textarea in preview area, handleContentCommit using onUpdateNote({content: plain})).
2. Add optional contentSerializer prop at extension configure time.
3. Strengthen one richer edge (e.g., ancestry cycle scaffold via currentNoteId attr if low-risk).
4. Full live roundtrip verification (edit source → auto-update in SyncedBlock + reverse).
5. Zero regression on title MVP + all production edges.
Explicitly mark serializer + block-granularity + OT/conflict work for next M3 slice.

Execute with perfect fidelity:
1. Begin with todo_write (plan/research/implement/verify).
2. Perform exhaustive initial read_file + grep on all Primary Files.
3. Implement only within charter.
4. After every edit: immediate full + targeted read_file + grep verification.
5. Preserve all invariants. Zero console errors.
6. Upon completion: concise evidence summary + propose updates to MILESTONE-2-PROGRESS and WAVE8-MASTER-PLAN.

Report status only through structured updates. No assumptions.
Post-C4 note: Full hygiene chain (typecheck/lint/build/test/e2e) + relevant M2 smoke slices required before first edit and after completion. Baseline = exactly 22 pre-existing TS errors (M2 residuals only; 0 delta introduced by C4).
```

---

## Success Criteria Summary (Condensed for Quick Reference)

**M3-1 (DatabaseBlock Server/RPC)**:
- Named views fully functional (save/load/apply/persist) in demo + live.
- ≥1 server-backed filtered/aggregated query executes cleanly via new foundation/RPC (no invariant violations).
- 100% M2 Board/kanban/drag/persistence behaviors unchanged (verified via smoke + manual).
- Expanded test/manual coverage + crystal-clear next-slice markers.

**M3-2 (SyncedBlock Full Bidirectional)**:
- True live bidirectional full content sync (source ↔ target) in demo + live.
- All documented edge cases (deleted/missing targets, cycles, deep hierarchies, permissions) handled gracefully with zero data loss/crashes.
- Zero regression on title sync, picker, navigation, or any M2 behaviors.
- Full smoke/manual roundtrips + clear markers for remaining serializer/granular work.

**Cross-Cutting (both agents)**:
- Post-edit verification discipline observed on every change.
- Full hygiene re-run + targeted M2 smoke (DatabaseBlock/SyncedBlock cases) + manual (incl. C4 surfaces) at wave close.
- Living docs updated with concise evidence + handoff for follow-on M3.

---

## Quick Notes: How Recent C4 Changes (Home, Invites, Presence) Interact with Early M3 Work

C4 (Invites + Realtime Symmetry P0 + Rich Presence + Home Global Workspace Hub MVP Phase A) was delivered under identical strict governance on the same branch. It touched shared core but left Notes M2 crown jewels (including DatabaseBlock and SyncedBlock) untouched.

**Low direct overlap — high guard discipline required**:
- **hybridStore.ts (primary shared surface)**: C4 added `getGlobalRecentActivity` (~2906) and supporting globals for Home aggregates + invite/membership RPC wrappers. Every export (old and new) follows the **non-negotiable VERY TOP guard**: `if (!isSupabaseLive() || ["w1","w2"].includes(...)) return safe-empty;`. M3-1 (new DB query paths) and any hybridStore work **must** replicate this pattern exactly. No bypasses.
- **Workspace switching via Home (C4-Exec-3)**: Home now provides the primary "Workspace Pulse" instant-switch UI with real aggregates. M3 work inside Notes editor blocks must survive clean ws switches (state reloads via store, no leakage between workspaces, presence meta updates continue). Test explicitly in manual verification.
- **Invites + Membership Lifecycle + Realtime Symmetry (C4-Exec-1, P0)**: Every terminating action produces symmetric zero-orphan state via postgres_changes + RPC cleanups (`cleanupInviteEverywhere`). Shared workspaces used for Notes testing are now more robust. M3 agents must not introduce new permission/RLS paths; reuse existing member-scoped patterns from hybridStore (e.g., getWorkspaceMembers patterns).
- **Rich Presence + UI Surfaces (C4-Exec-2)**: Reused existing AGENT-14/30 primitives (`onlineUsers`, `updatePresenceMeta` on `presence-${wsId}`, remote cursors). Now visible in:
  - Sidebar (👁 counts + ✎ editing dots on Notes nav)
  - TeamsView (rich pills + online list)
  - Home (Workspace Pulse "live pulse" framing)
  - Notes (cursors in TipTap overlay — already present, reconfirmed no regression)
  M3 edits inside the editor (especially SyncedBlock/DatabaseBlock) must preserve presence update calls and not regress cursor/editing indicators.
- **Overall risk profile**: M3-1/M3-2 charters are deeply internal to Notes editor extensions (TipTap NodeViews + hybrid query patterns). C4 is the collaboration/meta layer on top. Primary interaction vectors are (1) hybridStore guard hygiene and (2) post-ws-switch / multi-tab persistence of editor blocks. No new realtime channels or tables were added by C4 that would directly conflict with block sync work.
- **Verification mandate**: Any M3 wave **must** include explicit C4 surface exercise in manual steps (Home aggregates + switch, invites multi-tab symmetry, presence indicators) alongside Notes M2 flows. Re-run full hygiene post-changes.

**Post-C4 Hygiene Baseline (authoritative reference)**:
- TypeScript: Exactly **22 errors** — all pre-existing M2 extraction/test residuals (e.g., `notes-m2-smoke.test.tsx` mocks, NotesView delegation, implicit any in editor paths). **0 new from C4**.
- Lint/Build: Pre-existing warnings + strict `any` errors (treated as build failures). C4 followed existing patterns.
- Test: ~30 failures / 120 total (mostly harness + M2 gap-edge noise pre-dating C4).
- E2E: Passed in reference run.
- **Rule for M3**: Any work must not increase the TS error count on `npm run typecheck`. Full timestamped hygiene chain required before first edit and at close. See dated logs in repo root (`*-post-C4-20260529-105351.log`) and full auditor synthesis in C4-WAVE-COMPLETION-2026-06.md.

**Latest Gate Polish Context (additive, 2026-06 Continue. wave)**: The CUMULATIVE-SUMMARY [2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md](./2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md) is the best current one-screen overview of the newest polish layer. WAVE8-MASTER-PLAN.md canonical section ends with "**Latest Polish Wave (this Continue.)**" note (after `## 2026-06 Post-C4 + Zustand Hygiene Fix + Exhaustive Decision Package Ready (This Continue Wave)`); high-traffic launch docs carry matching "**Latest Polish (this Continue. wave)**" notes. All point to it as single source of truth. (Governance: read for current gate state.)

---

## Ready-to-Launch Framing

This document + the polished scaffolds already present in `features/notes/editor/extensions/database-block.ts`, `synced-block*.tsx`, `lib/data/hybridStore.ts`, and `TipTapEditor.tsx` (plus the M3-KICKOFF and M3-READY-EXECUTION-PROMPTS sources) constitute a complete, battle-tested activation kit.

**The instant the user says `"M2 done — begin user-led refinement/M3"` (with their smoke evidence), paste the two prompts above into parallel agents and execute with perfect fidelity. Zero ramp-up time. Zero ambiguity.**

All prior M2 governance, invariants, and decision tooling remain fully valid. C4 foundations (Home + invites symmetry + presence) are now live on top without regression and provide richer context for M3 acceleration.

**Next after first M3 wave**: Update WAVE8-MASTER-PLAN.md with Option A block from the Post-C4 Command Center, fold evidence, prepare follow-on slices (full RPCs, serializer/OT work, deeper AI + graph per AGENT-73, etc.), and continue the user-led refinement window per the 48-hour playbook.

**Prepared strictly as lightweight prep per charter. Pure synthesis from on-disk artifacts. Immediately actionable. No invention.**

---

**End of M3 Path Starter Pack 2026-06**  
Cross-reference: M2 Decision Command Center (Post-C4), M3-KICKOFF-IF-M2-DONE-2026-05-31.md, M3-READY-EXECUTION-PROMPTS-2026-06.md, C4-WAVE-COMPLETION-2026-06.md, WAVE8-MASTER-PLAN.md
