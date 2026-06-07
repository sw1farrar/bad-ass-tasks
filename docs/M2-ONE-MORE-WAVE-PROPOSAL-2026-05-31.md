# DRAFT — ONLY IF USER CHOOSES 'one more wave on the 7 gaps'

**Status**: CONDITIONAL DRAFT PROPOSAL ONLY.  
This document is pre-authored reference material. It becomes actionable **exclusively** if the user explicitly selects the decision language "one more wave on the 7 gaps (with specific priorities)" (or verbatim equivalent) from [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) §4 or related artifacts.  

**No assumptions. No activation.** Existence of this file implies zero authorization to spawn agents, edit code, or alter state. It is strictly a planning artifact for one possible user-chosen path.

**Exact 7 Prioritized Gaps Source (verbatim synthesis point)**:  
- [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) (Section 1, lines 18-37)  
- [WAVE8-MASTER-PLAN.md](./WAVE8-MASTER-PLAN.md) (M2 Status block, lines 106-112)  
- [MILESTONE-2-PROGRESS-2026-05-28.md](./MILESTONE-2-PROGRESS-2026-05-28.md) (closeout section, lines 1880-1886)

**Companion Kickoff & Decision Artifacts** (use alongside this proposal):
- [M2-DECISION-DAY-2026-05-31.md](./M2-DECISION-DAY-2026-05-31.md) (exact decision phrases + Windows smoke one-liner)
- [M2-EVIDENCE-PACK-2026-05-31.md](./M2-EVIDENCE-PACK-2026-05-31.md) (master aggregation + crown jewels)
- [M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md) (spawn-ready activation version of this proposal)
- [M3-KICKOFF-IF-M2-DONE-2026-05-31.md](./M3-KICKOFF-IF-M2-DONE-2026-05-31.md) (M3 Starting Kit for the alternate "M2 done" path)

---

## Conditional Wave Proposal: Minimal 5-Agent Parallel Execution

**Governance (non-negotiable)**: Same Iron Rule as all prior M2 waves — narrow charters only; each agent uses internal `todo_write`; mandatory `read_file` verification immediately after every edit; zero scope creep; 100% preservation of demo/live/hybrid invariants, zero new console errors, feature-folder architecture, and all Section 2 invariants from SIGNOFF-CHECKLIST.

**Overall Wave Success Criteria**:
- Concrete, reviewable increment (or explicit polished M2→M3 bridge) delivered against every one of the 7 gaps per their exact definitions.
- Full hygiene chain (typecheck/lint/build/test/e2e) green with no regressions.
- Expanded `notes-m2-smoke.test.ts` passes 100% via documented Windows one-liner.
- All work folded only after main-thread verification reads; living docs (MILESTONE-2-PROGRESS, WAVE8-MASTER-PLAN M2 Status, SIGNOFF) updated with evidence.
- Net footprint minimal; user manual smoke remains final gate.

**Proposed 5-Agent Structure** (minimal count; intelligent grouping of related server/editor concerns while preserving narrow charters):

| Agent | Gaps Covered     | High-Level Charter Focus                     |
|-------|------------------|----------------------------------------------|
| P-1   | 1                | SortOrder normalization hardening            |
| P-2   | 2                | Backlinks single-source centralization       |
| P-3   | 3 + 4            | DatabaseBlock completeness + History depth   |
| P-4   | 5                | SyncedBlock bidirectional production edges   |
| P-5   | 6 + 7            | Narrow slimming + test execution + a11y/AI   |

---

## Gap Area 1: Stable integer sortOrder normalization (highest-leverage data hygiene)

**Assigned Agent**: P-1 (dedicated, highest priority)

**Narrow Charter**: Deliver complete load-time renormalization plus hardened integer mid-point math (`Math.floor` only) for every reorder, reparent, and createSubNote path. Eliminate any possibility of drift or non-integer values after repeated operations. Add defensive guards and idempotent load effect.

**Success Criteria**:
- Zero observable drift or unstable ordering after 20+ cycles of drag/reparent/create in demo (and live if configured).
- All `sortOrder` values remain clean integers (0/1000/2000... spacing); renormalization is safe and idempotent.
- All mutation and load paths use only the hardened integer math.
- Strengthened smoke assertions cover cross-parent renorm + load signature detection.
- Cycle prevention and hybrid guards untouched.

**Estimated Scope**:
- Primary files: `features/notes/hooks/useNoteOperations.ts`, `features/notes/NotesView.tsx`, `tests/notes-m2-smoke.test.ts`
- Secondary: hook barrel + any direct sort consumers (read-only).
- Net change target: <180 LOC + test cases. Strict post-edit full-file reads + grep for floats/drift. One parallel agent. ~0.5–0.75 day equivalent.

---

## Gap Area 2: Backlinks centralization

**Assigned Agent**: P-2 (dedicated)

**Narrow Charter**: Make `useBacklinks` hook (plus pure `getBacklinkNotes` / `getBacklinkCount` selectors) the undisputed single source of truth. Unify sidebar badges (← N), `getBacklinkCount`, editor backlinks panel, LinkedTasksPanel, and every other consumer. Remove all remaining inline or divergent computation.

**Success Criteria**:
- Every badge, count, and list derives exclusively from the centralized selectors.
- Zero duplication of task-symmetry or mention-walk logic outside `useBacklinks.ts`.
- Click-to-jump and counts are accurate or improved.
- All prior remove, filter, and picker behaviors 100% preserved.
- Relevant smoke coverage added/verified.

**Estimated Scope**:
- Primary files (strict 5-file limit): `features/notes/hooks/useBacklinks.ts`, `features/notes/NotesView.tsx`, `features/notes/components/NoteHeader.tsx`, `features/notes/components/LinkedTasksPanel.tsx`, `features/notes/editor/TipTapEditor.tsx`
- Net change target: <120 LOC (primarily unification + deletion of duplication).
- Mandatory post-edit read on every touched file. ~0.5 day.

---

## Gap Area 3: DatabaseBlock production completeness

**Assigned Agent**: P-3 (shared with Gap 4)

**Narrow Charter**: Advance named saved views to full narrow production (build directly on delivered MVP) + implement explicit server query engine stubs / RPC hook foundations. Include numbered M3 scaffolding ("WHERE THE REAL ENGINE GOES"), RLS/hybrid notes, demo guards, and stable result shapes. Leave existing interactive Board + filter UI unchanged.

**Success Criteria**:
- Named views fully save/load/apply/persist via `queryConfig.views[]` in both demo and live.
- Server stubs + clear M3 implementation steps present and documented.
- Existing queryConfig auto-persist, Board drag, and filters untouched.
- Smoke cases cover view lifecycle + persistence.

**Estimated Scope**:
- Primary: `features/notes/editor/extensions/database-block-node-view.tsx` + supporting extension definition, `tests/notes-m2-smoke.test.ts`
- Net change target: <250 LOC (stubs + view wiring + markers). ~0.75 day (shared agent).

---

## Gap Area 4: Version History depth

**Assigned Agent**: P-3 (shared with Gap 3)

**Narrow Charter**: Deliver richer structured/JSON diff viewer (toggleable modes with visual stats). Complete `onPersistSnapshot` live round-trip (real writes to server snapshots array when Supabase active; server-preferred load). Keep all prior safety (Before restore, exports, title autosnap).

**Success Criteria**:
- Diff viewer offers structured + raw JSON modes with clear visual indicators.
- Live Supabase path: snapshots persist and restore correctly via hybridStore; demo path pristine.
- "Before restore" confirmation and export remain fully functional.
- Smoke tests exercise the persistence contract (mocks for live).

**Estimated Scope**:
- Primary: `features/notes/hooks/useNoteHistory.ts`, `features/notes/editor/TipTapEditor.tsx`, `lib/data/hybridStore.ts`
- Net change target: <200 LOC. Explicit live/demo branching + docs required. ~0.5–0.75 day (shared).

---

## Gap Area 5: SyncedBlock bidirectional + polish (explicit M2→M3 bridge)

**Assigned Agent**: P-4 (dedicated)

**Narrow Charter**: Extend title-only two-way sync to production edge cases (missing targets, cycles, deep hierarchies, live auto-updates on source change). Strengthen scaffolding for full-content M3 sync. Preserve read-only foundation and picker behavior perfectly.

**Success Criteria**:
- Bidirectional title sync is automatic and live; source changes trigger timestamp + re-sync.
- Edge cases (deleted/missing target, cycles) handled gracefully without crashes or data loss.
- Navigation/picker flows continue to work identically.
- Smoke + manual verification cover sync + documented edges.
- Heavy M2→M3 comments for remaining content sync work.

**Estimated Scope**:
- Primary: `features/notes/editor/extensions/synced-block.ts`, `synced-block-node-view.tsx`, `features/notes/editor/TipTapEditor.tsx`
- Net change target: <220 LOC focused on edges + scaffolding. ~0.75 day.

---

## Gap Area 6: Monolith slimming (narrow) + test execution

**Assigned Agent**: P-5 (shared with Gap 7)

**Narrow Charter**: Execute one additional ultra-narrow extraction in the notes domain (targeting any remaining thin wiring in `app/page.tsx` render path). Guarantee the full expanded M2 smoke suite is reliably user-executable on Windows per `M2-TEST-RUN-INSTRUCTIONS.md` (correct quoting for path spaces). Add any high-signal cases closing prior gap coverage.

**Success Criteria**:
- Notes orchestration in `app/page.tsx` reduced to minimal prop drilling.
- `npx vitest run tests/notes-m2-smoke.test.ts` (or documented npm equivalent) runs cleanly on Windows and passes 100%.
- New/expanded cases target sortOrder, backlinks, saved views, synced, history.
- Test run instructions remain accurate and complete.

**Estimated Scope**:
- Primary: `app/page.tsx`, `features/notes/hooks/useNoteOperations.ts`, `tests/notes-m2-smoke.test.ts`, `M2-TEST-RUN-INSTRUCTIONS.md`
- Net change target: <100 LOC + 3–6 test cases. Agent performs no terminal execution (path-space constraints); relies on user smoke for verification. ~0.5 day.

---

## Gap Area 7: Mobile/keyboard a11y depth + AI wiring

**Assigned Agent**: P-5 (shared with Gap 6)

**Narrow Charter**: Focused a11y depth on Kanban Board, SyncedBlock, History panel, and note tree (44px+ touch targets, keyboard navigation, ARIA live regions, focus management). Deepen the three existing AI slash stubs in the editor "AI" category with richer context injection points and explicit "WHERE THE xAI/Grok CALL WILL GO" markers.

**Success Criteria**:
- All four surfaces meet 44px targets, strong focus rings, `aria-*` attributes, and full keyboard operability.
- AI stubs contain expanded prompt context docs and clean injection hooks ready for downstream AI work.
- Zero regression to existing slash commands or interactive surfaces.
- Manual verification confirms responsive + keyboard paths + no console issues.

**Estimated Scope**:
- Primary: `database-block-node-view.tsx`, `synced-block-node-view.tsx`, `features/notes/editor/TipTapEditor.tsx` (history panel + AI slash section), note tree components.
- Net change target: <180 LOC (attributes, comments, minor handlers). ~0.5 day (shared).

---

## Wave Execution & Output Requirements

- Agents launched in parallel only upon explicit user choice of the trigger phrase.
- Each agent charter will be instantiated at spawn time with the absolute latest artifact state and exact current file contents (no forward assumptions in this draft).
- All 5 agents use identical strict process: internal todos, post-edit reads on 100% of touched files, invariant greps.
- Upon wave completion: main thread produces concise completion summary, folds all work, updates the three primary M2 handoff docs, and confirms smoke readiness.
- Total estimated net footprint across entire wave: <1,000 LOC. Emphasis on deletions/unification where possible.

**This concludes the conditional draft proposal.**

All content is derived strictly and exclusively from the documented definitions of the 7 prioritized gaps and the surrounding M2 handoff artifacts (SIGNOFF-CHECKLIST, WAVE8-MASTER-PLAN, MILESTONE-2-PROGRESS, 10-AGENT-WAVE-COMPLETION, READINESS-REPORT). No recommendations regarding user choice are expressed or implied. The user remains the sole decision authority.