# M2 One More Wave Kickoff — 2026-05-31

**Status**: PRE-FORMATTED, SPAWN-READY. Conditional on exact user decision phrase only.  
**Activation Trigger Phrase (exact, copy-paste ready)**: "one more wave on the 7 gaps (with specific priorities)"

**Purpose**: The instant the exact phrase above is received, launch the 5 parallel agents (P-1 through P-5) using the pre-formatted spawn-ready charters below. Zero interpretation. Zero delay. All content sourced verbatim/adapted only from [M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md](./M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md).

**Related Decision Day & Dual-Path Kickoff / Evidence Artifacts**:
- [M2-DECISION-DAY-2026-05-31.md](./M2-DECISION-DAY-2026-05-31.md) (exact decision phrases + smoke one-liner)
- [M2-EVIDENCE-PACK-2026-05-31.md](./M2-EVIDENCE-PACK-2026-05-31.md) (master reference + crown jewels)
- [M3-KICKOFF-IF-M2-DONE-2026-05-31.md](./M3-KICKOFF-IF-M2-DONE-2026-05-31.md) (M3 Starting Kit / spawn-ready for the "M2 done → M3" path)
- [M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md](./M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md) (detailed conditional planning source)

**Governance (non-negotiable — identical to proposal)**: Same Iron Rule as all prior M2 waves. Narrow charters only. Each agent **must** use internal `todo_write`; mandatory `read_file` verification immediately after every edit; zero scope creep; 100% preservation of demo/live/hybrid invariants, zero new console errors, feature-folder architecture, and all Section 2 invariants from SIGNOFF-CHECKLIST.

**Overall Wave Success Criteria** (from proposal):
- Concrete, reviewable increment (or explicit polished M2→M3 bridge) delivered against every one of the 7 gaps per their exact definitions in SIGNOFF-CHECKLIST §1.
- Full hygiene chain (typecheck/lint/build/test/e2e) green with no regressions.
- Expanded `notes-m2-smoke.test.ts` passes 100% via documented Windows one-liner.
- All work folded only after main-thread verification reads; living docs (MILESTONE-2-PROGRESS, WAVE8-MASTER-PLAN M2 Status, SIGNOFF) updated with evidence.
- Net footprint minimal; user manual smoke remains final gate.
- Total estimated net footprint across entire wave: <1,000 LOC.

**Proposed 5-Agent Parallel Structure** (minimal, intelligent grouping):
| Agent | Gaps Covered | Focus |
|-------|--------------|-------|
| P-1   | 1            | SortOrder normalization hardening |
| P-2   | 2            | Backlinks single-source centralization |
| P-3   | 3 + 4        | DatabaseBlock completeness + History depth |
| P-4   | 5            | SyncedBlock bidirectional production edges |
| P-5   | 6 + 7        | Narrow slimming + test execution + a11y/AI |

**Launch Protocol (copy-paste ready)**: Upon exact trigger phrase → immediately spawn all five P-1 to P-5 in parallel (background where supported). Feed each the exact "Spawn-Ready Prompt" block below. After wave: main thread produces concise completion summary, folds all work, updates the three primary M2 handoff docs, confirms smoke readiness.

---

## P-1 Spawn-Ready Charter (Gap 1: Stable integer sortOrder normalization)

**Spawn-Ready Prompt** (copy the entire fenced block below verbatim as the sub-agent prompt):
```
You are P-1: SortOrder normalization hardening Agent (Gap 1 — highest priority).

**Narrow Charter**: Deliver complete load-time renormalization plus hardened integer mid-point math (`Math.floor` only) for every reorder, reparent, and createSubNote path. Eliminate any possibility of drift or non-integer values after repeated operations. Add defensive guards and idempotent load effect.

**Success Criteria**:
- Zero observable drift or unstable ordering after 20+ cycles of drag/reparent/create in demo (and live if configured).
- All `sortOrder` values remain clean integers (0/1000/2000... spacing); renormalization is safe and idempotent.
- All mutation and load paths use only the hardened integer math.
- Strengthened smoke assertions cover cross-parent renorm + load signature detection.
- Cycle prevention and hybrid guards untouched.

**Estimated Scope** (strict):
- Primary files: `features/notes/hooks/useNoteOperations.ts`, `features/notes/NotesView.tsx`, `tests/notes-m2-smoke.test.ts`
- Secondary: hook barrel + any direct sort consumers (read-only).
- Net change target: <180 LOC + test cases. Strict post-edit full-file reads + grep for floats/drift.

**Governance (mandatory)**: Internal todo_write on start. Mandatory post-edit read_file (full + targeted) + grep on every touched file. 100% demo/live/hybrid invariant preservation. Zero new console errors. No scope creep. Update living M2 docs with evidence on completion.

Begin immediately with todo_write (plan step). Read all primary files first. Execute with perfect fidelity.
```

---

## P-2 Spawn-Ready Charter (Gap 2: Backlinks centralization)

**Spawn-Ready Prompt** (copy the entire fenced block below verbatim as the sub-agent prompt):
```
You are P-2: Backlinks single-source centralization Agent (Gap 2).

**Narrow Charter**: Make `useBacklinks` hook (plus pure `getBacklinkNotes` / `getBacklinkCount` selectors) the undisputed single source of truth. Unify sidebar badges (← N), `getBacklinkCount`, editor backlinks panel, LinkedTasksPanel, and every other consumer. Remove all remaining inline or divergent computation.

**Success Criteria**:
- Every badge, count, and list derives exclusively from the centralized selectors.
- Zero duplication of task-symmetry or mention-walk logic outside `useBacklinks.ts`.
- Click-to-jump and counts are accurate or improved.
- All prior remove, filter, and picker behaviors 100% preserved.
- Relevant smoke coverage added/verified.

**Estimated Scope** (strict 5-file limit):
- Primary files: `features/notes/hooks/useBacklinks.ts`, `features/notes/NotesView.tsx`, `features/notes/components/NoteHeader.tsx`, `features/notes/components/LinkedTasksPanel.tsx`, `features/notes/editor/TipTapEditor.tsx`
- Net change target: <120 LOC (primarily unification + deletion of duplication).

**Governance (mandatory)**: Internal todo_write on start. Mandatory post-edit read_file (full + targeted) + grep on every touched file. 100% demo/live/hybrid invariant preservation. Zero new console errors. No scope creep. Update living M2 docs with evidence on completion.

Begin immediately with todo_write (plan step). Read all primary files first. Execute with perfect fidelity.
```

---

## P-3 Spawn-Ready Charter (Gaps 3 + 4: DatabaseBlock completeness + Version History depth)

**Spawn-Ready Prompt** (copy the entire fenced block below verbatim as the sub-agent prompt):
```
You are P-3: DatabaseBlock completeness + Version History depth Agent (Gaps 3 + 4 — shared).

**Narrow Charter (Gap 3 portion)**: Advance named saved views to full narrow production (build directly on delivered MVP) + implement explicit server query engine stubs / RPC hook foundations. Include numbered M3 scaffolding ("WHERE THE REAL ENGINE GOES"), RLS/hybrid notes, demo guards, and stable result shapes. Leave existing interactive Board + filter UI unchanged.

**Narrow Charter (Gap 4 portion)**: Deliver richer structured/JSON diff viewer (toggleable modes with visual stats). Complete `onPersistSnapshot` live round-trip (real writes to server snapshots array when Supabase active; server-preferred load). Keep all prior safety (Before restore, exports, title autosnap).

**Success Criteria (combined)**:
- Named views fully save/load/apply/persist via `queryConfig.views[]` in both demo and live.
- Server stubs + clear M3 implementation steps present and documented.
- Diff viewer offers structured + raw JSON modes with clear visual indicators.
- Live Supabase path: snapshots persist and restore correctly via hybridStore; demo path pristine.
- "Before restore" confirmation and export remain fully functional.
- Smoke cases cover view lifecycle, persistence, and diff flows.
- Existing M2 behaviors untouched.

**Estimated Scope** (shared agent):
- Primary (Gap 3): `features/notes/editor/extensions/database-block-node-view.tsx` + supporting extension definition, `tests/notes-m2-smoke.test.ts`
- Primary (Gap 4): `features/notes/hooks/useNoteHistory.ts`, `features/notes/editor/TipTapEditor.tsx`, `lib/data/hybridStore.ts`
- Net change target: <250 LOC (stubs + view wiring + markers) + <200 LOC (History). Explicit live/demo branching + docs required.

**Governance (mandatory)**: Internal todo_write on start. Mandatory post-edit read_file (full + targeted) + grep on every touched file. 100% demo/live/hybrid invariant preservation. Zero new console errors. No scope creep. Update living M2 docs with evidence on completion.

Begin immediately with todo_write (plan step). Read all primary files first. Execute with perfect fidelity.
```

---

## P-4 Spawn-Ready Charter (Gap 5: SyncedBlock bidirectional production edges)

**Spawn-Ready Prompt** (copy the entire fenced block below verbatim as the sub-agent prompt):
```
You are P-4: SyncedBlock bidirectional production edges Agent (Gap 5 — dedicated).

**Narrow Charter**: Extend title-only two-way sync to production edge cases (missing targets, cycles, deep hierarchies, live auto-updates on source change). Strengthen scaffolding for full-content M3 sync. Preserve read-only foundation and picker behavior perfectly.

**Success Criteria**:
- Bidirectional title sync is automatic and live; source changes trigger timestamp + re-sync.
- Edge cases (deleted/missing target, cycles) handled gracefully without crashes or data loss.
- Navigation/picker flows continue to work identically.
- Smoke + manual verification cover sync + documented edges.
- Heavy M2→M3 comments for remaining content sync work.

**Estimated Scope**:
- Primary: `features/notes/editor/extensions/synced-block.ts`, `synced-block-node-view.tsx`, `features/notes/editor/TipTapEditor.tsx`
- Net change target: <220 LOC focused on edges + scaffolding.

**Governance (mandatory)**: Internal todo_write on start. Mandatory post-edit read_file (full + targeted) + grep on every touched file. 100% demo/live/hybrid invariant preservation. Zero new console errors. No scope creep. Update living M2 docs with evidence on completion.

Begin immediately with todo_write (plan step). Read all primary files first. Execute with perfect fidelity.
```

---

## P-5 Spawn-Ready Charter (Gaps 6 + 7: Narrow slimming + test execution + a11y/AI)

**Spawn-Ready Prompt** (copy the entire fenced block below verbatim as the sub-agent prompt):
```
You are P-5: Narrow slimming + test execution + a11y/AI Agent (Gaps 6 + 7 — shared).

**Narrow Charter (Gap 6 portion)**: Execute one additional ultra-narrow extraction in the notes domain (targeting any remaining thin wiring in `app/page.tsx` render path). Guarantee the full expanded M2 smoke suite is reliably user-executable on Windows per `M2-TEST-RUN-INSTRUCTIONS.md` (correct quoting for path spaces). Add any high-signal cases closing prior gap coverage.

**Narrow Charter (Gap 7 portion)**: Focused a11y depth on Kanban Board, SyncedBlock, History panel, and note tree (44px+ touch targets, keyboard navigation, ARIA live regions, focus management). Deepen the three existing AI slash stubs in the editor "AI" category with richer context injection points and explicit "WHERE THE xAI/Grok CALL WILL GO" markers.

**Success Criteria (combined)**:
- Notes orchestration in `app/page.tsx` reduced to minimal prop drilling.
- `npx vitest run tests/notes-m2-smoke.test.ts` (or documented npm equivalent) runs cleanly on Windows and passes 100%.
- New/expanded cases target sortOrder, backlinks, saved views, synced, history.
- All four surfaces meet 44px targets, strong focus rings, `aria-*` attributes, and full keyboard operability.
- AI stubs contain expanded prompt context docs and clean injection hooks ready for downstream AI work.
- Zero regression to existing slash commands or interactive surfaces.
- Manual verification confirms responsive + keyboard paths + no console issues.

**Estimated Scope**:
- Primary: `app/page.tsx`, `features/notes/hooks/useNoteOperations.ts`, `tests/notes-m2-smoke.test.ts`, `M2-TEST-RUN-INSTRUCTIONS.md`, `database-block-node-view.tsx`, `synced-block-node-view.tsx`, `features/notes/editor/TipTapEditor.tsx` (history panel + AI slash section), note tree components.
- Net change target: <100 LOC + 3–6 test cases + <180 LOC (attributes, comments, minor handlers).

**Governance (mandatory)**: Internal todo_write on start. Mandatory post-edit read_file (full + targeted) + grep on every touched file. 100% demo/live/hybrid invariant preservation. Zero new console errors. No scope creep. Update living M2 docs with evidence on completion.

Begin immediately with todo_write (plan step). Read all primary files first. Execute with perfect fidelity.
```

---

**Wave Execution & Output Requirements** (from proposal — mandatory):
- Agents launched in parallel **only** upon explicit user choice of the trigger phrase.
- Each agent charter instantiated at spawn time with the absolute latest artifact state and exact current file contents.
- All 5 agents use identical strict process: internal todos, post-edit reads on 100% of touched files, invariant greps.
- Upon wave completion: main thread produces concise completion summary, folds all work, updates the three primary M2 handoff docs (MILESTONE-2-PROGRESS, WAVE8-MASTER-PLAN, SIGNOFF-CHECKLIST), and confirms smoke readiness.
- This concludes the conditional wave. All content derived strictly and exclusively from the documented definitions of the 7 prioritized gaps and surrounding M2 handoff artifacts. No recommendations regarding user choice.

**This kickoff is 100% ready. The moment the user utters the exact activation phrase, copy the five spawn-ready prompts above and launch the agents instantly.**

**Prepared strictly docs-only per Dual-Path Kickoff Packager charter. All content derived directly from M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md with zero additions.**
