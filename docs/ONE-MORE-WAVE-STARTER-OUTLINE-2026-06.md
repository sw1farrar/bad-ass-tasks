# One More Wave Starter Outline 2026-06

**Status**: Lightweight, actionable starter outline. **Conditional only** — becomes relevant exclusively if the user selects the exact decision phrase `"one more wave on the 7 gaps (with specific priorities)"` (or verbatim equivalent) after running M2 smoke + hygiene per the post-C4 artifacts.

**Prepared**: Post-C4 wave (after hygiene baseline auditor `019e74de-faf0-7861-8cff-0b3354c955d0` + full decision tooling refresh). Balanced counterpart to [M3-PATH-STARTER-PACK-2026-06.md](./M3-PATH-STARTER-PACK-2026-06.md).

**Core Sources (read these first for full charters)**:
- [M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md](./M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md) (detailed 7-gap analysis + original 5-agent charters)
- [M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md) (spawn-ready copy-paste prompts)
- [M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md](./M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md) (current hygiene baseline, corrected smoke commands, C4 verification requirements)
- [M2-DECISION-READINESS-PACK-2026-06.md](./M2-DECISION-READINESS-PACK-2026-06.md) + [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) (exact gap definitions + invariants)
- WAVE8-MASTER-PLAN.md (current M2 status synthesis) + MILESTONE-2-PROGRESS-2026-05-28.md

**Post-C4 Context (critical for any activation)**:
- C4 delivered invites/realtime symmetry (P0), rich presence, and Home Global Workspace Hub MVP Phase A with **zero new debt**.
- Shared core touched: `lib/data/hybridStore.ts` (new guarded globals at VERY TOP `isSupabaseLive()` pattern), `store/useTaskStore.ts`, `app/page.tsx` (thin `renderHomeView` + noteOps wiring block containing pre-existing M2 TS residuals).
- **Hygiene baseline** (reference): Exactly 22 TS errors (pre-existing M2 extraction residuals only; 0 delta from C4). Lint warnings + build impact pre-existing. Core `npm run test` has known pre-existing noise; e2e green. Full chain must be re-run before/after any wave work.
- **Smoke file**: `tests/notes-m2-smoke.test.tsx` (`.tsx` — corrected post-C4; all legacy docs had `.ts` error).
- M2 Notes crown jewels untouched by C4. Manual verification **must now explicitly exercise** C4 surfaces (Home Hub, multi-tab invites symmetry, presence indicators across sidebar/Teams/Notes/Home) alongside Notes flows.
- Test harness friction point: hybridStore mocks incomplete for C4 additions (additive only; no M2 flow breakage).

**Latest Gate Polish Context (additive, 2026-06 Continue. wave)**: The CUMULATIVE-SUMMARY [2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md](./2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md) is the best current one-screen overview of the newest polish layer. WAVE8-MASTER-PLAN.md canonical section ends with "**Latest Polish Wave (this Continue.)**" note (after `## 2026-06 Post-C4 + Zustand Hygiene Fix + Exhaustive Decision Package Ready (This Continue Wave)`); high-traffic launch docs carry matching "**Latest Polish (this Continue. wave)**" notes. All point to it as single source of truth. (Governance: read for current gate state.)

This outline provides a quick starting point so the team can activate with minimal delay on either decision path.

---

## Recommended Agent Split / Focus Areas

**5-Agent minimal parallel structure** (proven from Proposal + Kickoff; intelligent grouping of server/editor concerns while preserving narrow charters):

| Agent | Gaps Covered | High-Level Charter Focus                          | Notes (Post-C4) |
|-------|--------------|---------------------------------------------------|-----------------|
| P-1   | 1            | SortOrder normalization hardening                 | Highest-leverage data hygiene; read C4 guard patterns in hybridStore |
| P-2   | 2            | Backlinks single-source centralization            | Pure unification; minimal shared-file risk |
| P-3   | 3 + 4        | DatabaseBlock completeness + History depth        | Explicit M2→M3 bridges (align with M3-1 starter); heavy hybridStore/page.tsx reads required |
| P-4   | 5            | SyncedBlock bidirectional production edges        | Explicit M2→M3 bridge (align with M3-2 starter); preserve presence/cursors in TipTapEditor |
| P-5   | 6 + 7        | Narrow slimming + test execution + a11y/AI        | Test `.tsx` one-liner + harness polish; C4 surfaces in manual; a11y on DB/Synced/History + note tree |

**Launch Protocol (when activated)**: Main thread immediately spawns all five in parallel using the exact spawn-ready prompts from the Kickoff doc (updated with post-C4 file names + baseline references). Each agent begins with `todo_write`.

---

## Suggested Narrow Scopes for the 7 Prioritized M2 Gaps

Scopes drawn directly from SIGNOFF-CHECKLIST §1 + Proposal detailed charters. **Post-C4 adjustments**: Always perform initial full + targeted `read_file` + grep on `hybridStore.ts`, `app/page.tsx`, and relevant C4 handoffs first. Follow exact guard discipline. Include C4 surfaces in verification. Test commands use `.tsx`. Net footprint target remains <1,000 LOC total across wave (favor deletions/unification).

### Gap 1: Stable integer sortOrder normalization (highest-leverage data hygiene)
**Narrow Charter**: Complete load-time renormalization + hardened integer mid-point math (`Math.floor` only) for every reorder, reparent, and createSubNote path. Eliminate drift/non-integers after repeated ops. Defensive guards + idempotent load effect.
**Primary Files**: `features/notes/hooks/useNoteOperations.ts`, `features/notes/NotesView.tsx`, `tests/notes-m2-smoke.test.tsx`; secondary consumers (read-only).
**Success Criteria**: Zero drift after 20+ cycles (demo + live); clean integers only; all paths use hardened math; strengthened smoke for cross-parent renorm; cycle/hybrid guards untouched.
**Est. Scope**: <180 LOC + tests. ~0.5–0.75 day (P-1 dedicated).

### Gap 2: Backlinks centralization
**Narrow Charter**: Make `useBacklinks` (plus pure `getBacklinkNotes` / `getBacklinkCount` selectors) the single source of truth. Unify every badge (← N), count, editor panel, LinkedTasksPanel, and consumer. Remove all inline/divergent logic.
**Primary Files** (strict ~5-file limit): `features/notes/hooks/useBacklinks.ts`, `features/notes/NotesView.tsx`, `features/notes/components/NoteHeader.tsx`, `features/notes/components/LinkedTasksPanel.tsx`, `features/notes/editor/TipTapEditor.tsx`.
**Success Criteria**: All UI derives exclusively from centralized selectors; zero duplication outside hook; counts/jumps accurate; prior behaviors preserved; smoke coverage added.
**Est. Scope**: <120 LOC (mostly unification/deletion). ~0.5 day (P-2).

### Gap 3: DatabaseBlock production completeness
**Narrow Charter**: Advance named saved views to full narrow production (on delivered MVP) + implement explicit server query engine stubs / RPC hook foundations ("WHERE THE REAL ENGINE GOES" + numbered M3 steps). Stable result shapes, RLS/hybrid/demo guards. Existing Board + filters untouched.
**Primary Files**: `features/notes/editor/extensions/database-block.ts`, `features/notes/editor/extensions/database-block-node-view.tsx`, `tests/notes-m2-smoke.test.tsx`, `lib/data/hybridStore.ts`, `supabase/schema.sql` (ref).
**Success Criteria**: Named views save/load/apply/persist in demo + live; server stubs + clear M3 scaffolding; no regression to M2 interactive MVP; smoke + manual cover view lifecycle.
**Est. Scope**: <250 LOC (stubs + wiring + markers). Shared with Gap 4 (P-3). Align first slice with M3 Path Starter Pack M3-1 recommendation.

### Gap 4: Version History depth
**Narrow Charter**: Richer structured/JSON diff viewer (toggleable modes + visual stats). Complete `onPersistSnapshot` live round-trip (real server writes when Supabase active; server-preferred load). Preserve all prior safety (Before restore, exports, title autosnap).
**Primary Files**: `features/notes/hooks/useNoteHistory.ts`, `features/notes/editor/TipTapEditor.tsx`, `lib/data/hybridStore.ts`.
**Success Criteria**: Structured + raw JSON modes with indicators; live snapshots persist/restore correctly (demo pristine); safety flows intact; smoke exercises persistence contract.
**Est. Scope**: <200 LOC. Explicit live/demo branching. Shared (P-3).

### Gap 5: SyncedBlock bidirectional + polish (explicit M2→M3 bridge)
**Narrow Charter**: Extend title-only two-way sync to production edges (missing/deleted targets, cycles, deep hierarchies, live auto-updates on source change). Strengthen scaffolding for full-content M3 sync. Preserve read-only foundation + picker perfectly.
**Primary Files**: `features/notes/editor/extensions/synced-block.ts`, `features/notes/editor/extensions/synced-block-node-view.tsx`, `features/notes/editor/TipTapEditor.tsx`.
**Success Criteria**: Automatic live bidirectional title sync (source triggers re-sync); edges handled gracefully (no crashes/loss); navigation/picker identical; smoke + manual cover sync + edges; heavy M2→M3 comments.
**Est. Scope**: <220 LOC focused on edges + scaffolding. ~0.75 day (P-4). Align with M3 Path Starter Pack M3-2 first slice (content write stub + richer edges).

### Gap 6: Monolith slimming (narrow) + test execution
**Narrow Charter**: One additional ultra-narrow extraction in notes domain (remaining thin wiring in `app/page.tsx` render path). Guarantee full expanded M2 smoke suite is reliably user-executable on Windows (correct `.tsx` quoting per current Command Center). Add high-signal gap-closer cases.
**Primary Files**: `app/page.tsx`, `features/notes/hooks/useNoteOperations.ts`, `tests/notes-m2-smoke.test.tsx`, `M2-TEST-RUN-INSTRUCTIONS.md`.
**Success Criteria**: Notes orchestration in page.tsx reduced to minimal prop drilling; `npx vitest run tests/notes-m2-smoke.test.tsx ...` (or documented equiv) runs cleanly on Windows and passes 100%; new cases target remaining gaps; instructions accurate.
**Est. Scope**: <100 LOC + 3–6 test cases. Shared (P-5).

### Gap 7: Mobile/keyboard a11y depth + AI wiring
**Narrow Charter**: Focused a11y on Kanban Board, SyncedBlock, History panel, note tree (44px+ targets, keyboard nav, ARIA live regions, focus management). Deepen the three existing AI slash stubs ("AI" category) with richer context docs + explicit injection points / "WHERE THE xAI/Grok CALL WILL GO" markers.
**Primary Files**: `database-block-node-view.tsx`, `synced-block-node-view.tsx`, `features/notes/editor/TipTapEditor.tsx` (history + AI section), note tree components.
**Success Criteria**: All four surfaces meet 44px + strong focus/ARIA/keyboard; AI stubs expanded and ready for downstream work; zero regression to slash or interactive surfaces; manual confirms responsive + keyboard + clean console.
**Est. Scope**: <180 LOC (attributes + comments + minor handlers). Shared (P-5).

---

## Key Files and Artifacts to Start From

**Core Implementation (read 100% + targeted greps first; post-edit re-read mandatory)**:
- Notes domain: `features/notes/hooks/useNoteOperations.ts`, `useBacklinks.ts`, `useNoteHistory.ts`
- Editor extensions: `features/notes/editor/extensions/database-block.ts` + `-node-view.tsx`, `synced-block.ts` + `-node-view.tsx`
- Orchestration/UI: `features/notes/NotesView.tsx`, `features/notes/editor/TipTapEditor.tsx`, `features/notes/components/NoteHeader.tsx` + `LinkedTasksPanel.tsx`, `app/page.tsx`
- Data layer: `lib/data/hybridStore.ts` (guard patterns + C4 globals), `store/useTaskStore.ts`
- Tests: `tests/notes-m2-smoke.test.tsx` (use `.tsx` exclusively), `M2-TEST-RUN-INSTRUCTIONS.md`

**One-More-Wave & Decision Artifacts**:
- Proposal + Kickoff (charters/prompts)
- Post-C4 Command Center + Readiness Pack (baseline, commands, C4 verification matrix)
- SIGNOFF-CHECKLIST-2026-05-31.md (exact §1 gaps + §2 invariants)
- M3-PATH-STARTER-PACK-2026-06.md (for bridge alignment on Gaps 3/5)

**Living Docs (update on wave close with evidence)**:
- `docs/WAVE8-MASTER-PLAN.md` (M2 Status section)
- `docs/MILESTONE-2-PROGRESS-2026-05-28.md`
- `docs/M2-SIGNOFF-CHECKLIST-2026-05-31.md` §5 (or equivalent closeout)
- Pre-drafted blocks available in Command Center §8

**Post-C4 Reference Logs** (root): `typecheck-post-C4-20260529-105351.log`, `build-post-C4-...`, etc.

---

## Governance Reminders (Iron Rule — Non-Negotiable)

- **Narrow charters only**. Zero scope creep. Work strictly inside the 7 gap definitions from SIGNOFF-CHECKLIST §1.
- Every agent **must** start with internal `todo_write` (minimum: plan / research / implement / verify).
- **Mandatory** after **every** edit: full-file + targeted `read_file` (offsets) + path-restricted `grep` verification before any further work.
- 100% preservation of demo/live/hybrid invariants (`isSupabaseLive()` + `isSupabaseConfigured()` + w1/w2 demo blocks at the **VERY TOP** of every public export and entry point in hybridStore and callers — follow C4 additions exactly).
- Zero new console errors. Feature-folder architecture. No changes to non-Notes core, Zustand, realtime foundations, or auth beyond narrow bridges.
- All work folded only after main-thread verification reads.
- Post-C4 specifics: Preserve C4 additions (Home global slices, presence meta, invite symmetry RPCs/cleanups, realtime subscriptions). Never bypass guards. When editing shared files, re-confirm C4 patterns via full reads. Include C4 surfaces (Home Hub, invites multi-tab, presence) in every manual verification pass.
- Update living handoff docs with evidence only via main thread at wave close.

---

## Rough Success Criteria

- Concrete, reviewable increment (or polished explicit M2→M3 bridge) delivered against **every** one of the 7 gaps per their exact definitions.
- Full hygiene chain (typecheck/lint/build/test/e2e) green with **zero delta** from post-C4 baseline (22 TS residuals only).
- `tests/notes-m2-smoke.test.tsx` passes 100% via documented Windows one-liner (use verbose + focused `-t` variants for Gap 1/3/5/6 evidence).
- All 11 invariants from SIGNOFF-CHECKLIST §2 hold (core + C4-augmented manual).
- Manual verification (per Command Center §5): Full Notes crown jewels (hierarchy/drag, bidirectional, TaskEmbeds, History, DatabaseBlock Board+named views, SyncedBlock) + all C4 surfaces (Home Pulse/Today's Focus/Recent/AI stub + ws switch; invites symmetry multi-tab zero-orphan; rich presence across surfaces) — zero *new* console errors, perfect hard-refresh + reconnect persistence in demo (and live when tested).
- Net footprint minimal (<1,000 LOC target); emphasis on unification/deletions.
- Living docs updated with evidence; smoke readiness confirmed.
- User manual smoke remains final gate.

---

## Verification Approach

1. **Pre-activation (main thread)**: Full timestamped hygiene (use the tee one-liner from Command Center), clean git status, M2 smoke one-liner + focused variants, capture console/screenshots per Readiness Pack §6.
2. **During wave**: Agents follow strict process (todos + post-edit reads/greps). Main thread monitors for invariant drift.
3. **Post-wave (before fold)**: Re-run full hygiene + M2 smoke + expanded manual (Notes + C4 surfaces) per Command Center. Zero new errors. Capture fresh logs + screenshots (include C4 surfaces + DevTools console clean).
4. **Evidence standard**: Full terminal output, 6–10 high-signal screenshots (add Home/Presence/Invites to the classic Notes set), explicit console statement ("Zero new console errors..."), git diff stat.
5. **Failure path**: Any red → open M2-SMOKE-FAILURE-MAPPER immediately. Do not declare progress.
6. **Closeout**: Main thread produces concise summary, folds changes, inserts pre-drafted (or lightly adapted) status block into WAVE8-MASTER-PLAN (see Command Center §8), updates PROGRESS + SIGNOFF, confirms readiness for final user smoke.

**Balance with M3 Path**: This outline + the existing Proposal/Kickoff provide the same zero-ramp-up readiness as the M3 Path Starter Pack. The two paths are symmetric: smoke results + one exact phrase triggers immediate, pre-drafted activation of the chosen direction with no delay.

---

**This concludes the starter outline.**

All content is synthesized strictly from the referenced post-C4 decision artifacts and the original 7-gap definitions. The user remains the sole decision authority. No activation or agent spawning is authorized until the exact trigger phrase is received after smoke evidence.