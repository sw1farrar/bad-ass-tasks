# M2 Evidence Pack — 2026-05-31

**Ultra-narrow aggregation** (docs-only, no new analysis, no code changes). **Single master reference document**. Cleanly merges the M2-DECISION-DAY-2026-05-31.md one-pager, the M3 Starting Kit for Gaps 3 & 5, and full references to M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md. All Decision Day material now findable from this one document. Bundles all decision-critical artifacts from the 3-agent M2 Verification & Closeout Polish Wave plus prior 10-agent wave outputs.

---

## 🗺️ Smoke Failure Mapper — Primary Quick Link for Smoke Runners

**For anyone executing the M2 smoke tests (`notes-m2-smoke.test.ts` one-liner or manual runs):**

**🚨 [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md)**

The practical failure signatures → gaps reference. Maps every exact `it('title')` from a failing stack trace directly to the owning Gap (1-7) + kickoff charter. 

- **Use immediately on any red result** while running smoke on `C:\Build\Bad Ass Tasks`.
- Keeps diagnosis instant: no hunting through long docs.
- Companion to the live Smoke Run Companion (below) and this master pack.

Keep this tab open alongside the Evidence Pack during Decision Day smoke execution.

## 🚨 LIVE SMOKE RUN COMPANION (keep open while running the smoke tests right now)

**Primary practical live-use helper for Decision Day execution (the concise companion for while you are actually running tests):**

**[M2-SMOKE-RUN-COMPANION-2026-05-31.md](./M2-SMOKE-RUN-COMPANION-2026-05-31.md)**

- Exact Windows one-liner + variants, what to capture (full terminal + 2-3 screenshots), Quick Manual Smoke Checklist (15-30 min), and failure signatures → gaps map.
- Designed as the tab you keep open in a second window during the live smoke run + manual verification flows.
- All deep evidence, "What Good Looks Like", and full context stay here in this master Evidence Pack (see Section 3).

**🚨 RED SMOKE INSTANT JUMP — dedicated failure signatures → gaps mapper (open immediately on any red test):**  
**[M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md)** — the practical failure signatures → gaps reference. Maps exact `it('title')` from stack directly to Gap + kickoff charter. Keep alongside the Companion while running smoke.

**Open the Companion + Mapper now alongside this pack. Run → capture → decide.**

---

## How to use this pack (Decision Day flow)

1. Read this document top-to-bottom for the consolidated view (everything in one place).
2. Execute the exact User Smoke Run Pack (one-liner + manual checklist) on the canonical `C:\Build\Bad Ass Tasks` tree. See integrated Decision Day Quick Reference below.
3. Review evidence tables, closeout summary, and What Good Looks Like.
4. **If choosing M2 → M3 path**: Jump directly to the integrated **M3 Starting Kit for Gaps 3 & 5** (Section 4 below) — focused activation content for the two primary M2→M3 bridges.
5. **If choosing one more wave path**: See the integrated reference + excerpts in Section 5 (Crown Jewels) to the full M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md.
6. Reply with the exact decision language from SIGNOFF-CHECKLIST §4: "M2 done — begin user-led refinement/M3" **or** "one more wave on the 7 gaps (with specific priorities)".

All content below is direct aggregation / verbatim excerpts organized cleanly. No interpretation added. This pack is now the single master — separate one-pagers and kits are superseded for daily Decision Day use.

---

## Decision Day Quick Reference (integrated verbatim from M2-DECISION-DAY-2026-05-31.md)

**Exact Windows Smoke One-Liner** (copy-paste into PowerShell; quotes required):
```
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.ts --no-watch
```

**Two Exact Decision Phrases** (reply with exactly one):
- "M2 done — begin user-led refinement/M3"
- "one more wave on the 7 gaps (with specific priorities)"

### What to do on Decision Day
- Run hygiene: `npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e`
- **Run smoke (one-liner above) — keep [M2-SMOKE-RUN-COMPANION-2026-05-31.md](./M2-SMOKE-RUN-COMPANION-2026-05-31.md) open in a second tab/window for the practical live helper (variants, manual checklist, captures, failure map)**
- **If any test red: immediately jump to dedicated [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) for instant failure signatures → gaps lookup**
- Run manual smoke (hierarchy/drag, bidir linking/picker/mentions, TaskEmbeds, History restore/export, DatabaseBlock + named views, SyncedBlock)
- Capture evidence (full terminal output + 2-3 screenshots of key flows)
- Check console (zero new errors post hard-refresh ×2)
- Reply with exact decision phrase

**Direct links** (all within this pack or sibling crown jewels):
- This Evidence Pack (master)
- **🚨 Live execution: [M2-SMOKE-RUN-COMPANION-2026-05-31.md](./M2-SMOKE-RUN-COMPANION-2026-05-31.md)** (keep open while running smoke/tests right now — practical one-liner variants, checklist, captures, failure signatures)
- **🚨 Smoke Failure Mapper (red smoke instant lookup — practical failure signatures → gaps reference):** [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md)
- Crown jewels: [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) | [M2-READINESS-REPORT-2026-05-31.md](./M2-READINESS-REPORT-2026-05-31.md) | [10-AGENT-WAVE-COMPLETION-2026-05-31.md](./10-AGENT-WAVE-COMPLETION-2026-05-31.md) | [WAVE8-MASTER-PLAN.md](./WAVE8-MASTER-PLAN.md) (M2 Status)
- See integrated **M3 Starting Kit for Gaps 3 & 5** (Section 4) for M2→M3 path or **ONE-MORE-WAVE-PROPOSAL reference** (inside Section 5 Crown Jewels) for alternate path.

*Copy this and go. All per this master pack + SIGNOFF-CHECKLIST §4.*

---

## 1. M2 2026-05-31 Closeout Summary for User Decision

*(Full content from previous Consolidator / Final Handoff Doc Consolidator as referenced in MILESTONE-2-PROGRESS-2026-05-28.md + synthesized from Readiness Report Executive Summary, Recommendation, and cross-referenced wave outcomes in 10-AGENT-WAVE-COMPLETION + WAVE8-MASTER-PLAN. Verbatim excerpts aggregated for self-contained decision summary.)*

**From MILESTONE-2-PROGRESS (3-Agent M2 Verification & Closeout Polish Wave – Complete 2026-05-29):**

**Wave Charter (ultra-narrow, zero code changes, read-only + docs polish only)**: 
- Smoke Evidence Pack Builder (ID 019e7442-dd3d-7291-b1ee-3f283f81f8d1): Consolidated exact one-liner, green expectations, red→7-gap mapping table, and distilled 15-30 min manual checklist.
- Final Handoff Doc Consolidator (ID 019e7442-e70e-7152-8b5f-2ffd9144c471): Produced the self-contained "M2 2026-05-31 Closeout Summary for User Decision" (see earlier in this file + handoff artifacts) + recommended 3-bullet user message.
- M2 Invariant Evidence Collector (ID 019e7442-d45a-7700-982e-39e056abd5a2, 68 tool calls, 198s): Delivered the line-precise evidence table below for all 11 invariants (sourced only from allowed scope: features/notes/, hybridStore.ts, app/page.tsx, crown-jewel docs).

**Wave Outcome**: 3/3 success. Combined with the prior 10-agent wave + syntax fix, M2 is now fully evidence-backed for user decision. 8/11 invariants fully GREEN with production-grade implementation. The 2 YELLOW items are purely user-executable verification (hygiene + smoke on the canonical tree).

**Ready for decision**: Yes. Run the smoke (one-liner below). Then use the exact language from SIGNOFF-CHECKLIST §4.

**From M2-READINESS-REPORT-2026-05-31.md (Executive Summary + Recommendation):**

The 10-agent wave (plus documented follow-up fold-ins) has materially advanced M2. The 7 prioritized gaps have received concrete, high-governance increments:

- **Closed / Production-grade**: Stable integer sortOrder normalization (full load-time + post-mutation renorm with integer `Math.floor` midpoint math), Backlinks centralization (`useBacklinks.ts` as undisputed single source + pure selectors), Version History depth (structured/JSON diff + complete `onPersistSnapshot` server round-trip), Monolith slimming (multiple narrow extractions; `renderNotesView` now thin prop drilling), Mobile/keyboard a11y polish (44px targets + ARIA on Board/Synced/History), Test expansion (notes-m2-smoke.test.ts now ~23-36 high-signal cases + Windows-executable run instructions).

- **Strong MVPs + Explicit M2→M3 Bridges**: DatabaseBlock (interactive Board/kanban with intra+inter drag, queryConfig full auto-persist, named saved views MVP in Edit View form + Load dropdown), SyncedBlock (live bidirectional title sync MVP + heavy scaffolding for content/edges), AI wiring (3 explicit stubs with "WHERE THE xAI/Grok CALL WILL GO" markers).

All work preserved 100% demo/live/hybrid invariants and introduced zero new console errors per wave reports.

**Overall M2 State**: Very strong and reviewable. Notes surface delivers the "love child of Notion + Obsidian + Linear" vision in demo with production-grade hierarchy, bidirectional magic, live embeds, history, and interactive DB blocks. The handoff artifacts (this report + SIGNOFF-CHECKLIST + WAVE8-MASTER-PLAN M2 Status + MILESTONE-2-PROGRESS closeout + 10-AGENT-WAVE-COMPLETION) are self-contained.

**Recommendation**: **M2 ready for user review** (with the mandatory user-executable hygiene + smoke steps in Section 3 of the SIGNOFF-CHECKLIST). One more small targeted wave is **not required** for core M2 completeness; remaining items are either explicit M3 bridges (server query/RPC, full Synced content sync) or local verification steps the user must perform anyway. User can confidently enter debugging/refinement or authorize M3 after running the documented tests/hygiene + manual smoke.

**User Decision Point** (per SIGNOFF §4): After running the above, reply with "M2 done — begin user-led refinement/M3" or "one more wave on the 7 gaps (with specific priorities)".

**From 10-AGENT-WAVE-COMPLETION-2026-05-31.md (Overall M2 State After This Wave):**

The Notes + bidirectional platform is now in a **very strong, reviewable state**:
- Hierarchy is stable and drift-proof
- Bidirectional linking is centralized and consistent
- Major new surfaces (DatabaseBlock, SyncedBlock, History) have meaningful depth and polish
- Realtime and ID hygiene are hardened
- Test coverage and documentation have been materially improved
- Architecture hygiene (extraction, single sources of truth) continues to advance

The project is ready for user-led debugging, refinement, and the decision between "M2 is good enough — move to M3" vs. "one more small targeted wave on remaining edges."

**From WAVE8-MASTER-PLAN.md (M2 Status section):**

- **2026-05-29 Verification Mini-Wave (3 agents, zero code changes)**: On user "continue" after final syntax error clear, launched ultra-narrow docs-only wave (Smoke Pack Builder, Handoff Consolidator, Invariant Evidence Collector). All 3 completed successfully. Full line-precise evidence table for all 11 invariants now in MILESTONE-2-PROGRESS (8 GREEN / 2 YELLOW = user smoke only). M2 Closeout Summary for User Decision produced and ready. Package is mature and decision-ready. No further code work required for M2 completeness.

- The project remains in active autonomous execution mode per user directive. Full handoff artifacts (SIGNOFF-CHECKLIST, 10-AGENT-WAVE-COMPLETION, READINESS-REPORT, updated PROGRESS + Closeout Summary) are complete and self-contained. Ready for user review/decision at any time: run the documented smoke one-liner on `C:\Build\Bad Ass Tasks`, then reply with "M2 done — begin user-led refinement/M3" or "one more wave on the 7 gaps (with specific priorities)". Master plan continues on next user signal.

**Next User Actions** (copy-paste ready, from Readiness):
1. `cd "C:\Build\Bad Ass Tasks"`
2. Run full hygiene: `npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e`
3. Run M2 smoke: `npx vitest run tests/notes-m2-smoke.test.ts --no-watch` (or per M2-TEST-RUN-INSTRUCTIONS.md)
4. `npm run dev` + full manual Notes smoke per SIGNOFF-CHECKLIST §3 (hierarchy, bidir picker/panels/mentions, TaskEmbeds, History restore/export, DB Board + named views, Synced title sync, hard refresh ×2, console clear, live toggle if .env present).
5. Reply with decision per SIGNOFF §4.

This report + the three companion artifacts give the main thread and user everything needed for confident, zero-ambiguity decision making.

---

## 2. Complete 11-Invariant Evidence Table

*(Direct / verbatim from M2 Invariant Evidence Collector via MILESTONE-2-PROGRESS-2026-05-28.md lines 67-83. Sourced only from allowed scope: features/notes/, hybridStore.ts, app/page.tsx, crown-jewel docs.)*

| Invariant | Status | Key Evidence | Risk/Hole |
|-----------|--------|--------------|-----------|
| 1. Demo / Live / Hybrid Separation | GREEN | hybridStore.ts:623-625 (every public export has isSupabaseLive guard at VERY TOP + w1/w2 blocks); app/page.tsx:1548 (isLive prop); NotesView.tsx:539 (demo label); TipTapEditor.tsx:1436 (LIVE/DEMO mode) | None |
| 2. Zero Console Errors | YELLOW | Only defensive/purge warns visible in static inspection (hybridStore, useNoteOperations, TipTapEditor); no crash paths | User must run hygiene chain + smoke (path quoting blocks agents) |
| 3. Bidirectional Symmetry | GREEN | useBacklinks.ts:16-72 (pure single-source getBacklinkNotes + task symmetry + mention walk); TipTapEditor + synced handlers | None |
| 4. Hierarchy Safety | GREEN | useNoteOperations.ts:230-243 (wouldCreateCycle visited Set); NotesView.tsx:142-176 (load-time integer renorm + sig) | None |
| 5. TaskEmbed Liveness | GREEN | task-embed-node-view.tsx:37-46 (liveTask preference + inline edits + deleted state) | None |
| 6. Version History Safety | GREEN | hybridStore.ts:1241-1285 (onPersistSnapshot with live guard + roundtrip); TipTapEditor persist + serverSnapshots | None |
| 7. DatabaseBlock & SyncedBlock | GREEN (MVP) / YELLOW (depth) | database-block-node-view.tsx:175-193 (named views + queryConfig persist + Board drag); synced-block: title sync MVP + "M2→M3 LIVE" scaffolding | Server query / full content sync = explicit M3 bridges |
| 8. Extraction Hygiene | GREEN | app/page.tsx:1518-1558 (renderNotesView now thin delegation only) | None |
| 9. TypeScript / Lint / Build Clean | YELLOW | No new domain `as any` in M2 paths (one removal noted in DB node-view) | Full hygiene chain is user step |
| 10. Refresh + Persistence | GREEN | NotesView load renorm; hybridStore onPersist + map; TipTap serverSnapshots | None |
| 11. No Scope Creep | GREEN | All changes confined to features/notes/ + thin wiring + narrow M2 bridges only | None |

**Ready for decision**: Yes. Run the smoke (one-liner below). Then use the exact language from SIGNOFF-CHECKLIST §4.

---

## 3. User Smoke Run Pack from the Smoke Evidence Pack Builder

*(Direct aggregation / verbatim excerpts from Smoke Evidence Pack Builder outputs as referenced in MILESTONE + full content of M2-TEST-RUN-INSTRUCTIONS.md + SIGNOFF-CHECKLIST-2026-05-31.md §3 "How to Run the Smoke Tests on Windows" + manual checklist + "What Good Looks Like".)*

**Project Root**: `C:\Build\Bad Ass Tasks` (canonical tree — edits always land here).

### Exact one-liner to run the full expanded M2 smoke suite
(From M2-TEST-RUN-INSTRUCTIONS.md — the consolidated output of the Smoke Evidence Pack Builder)

Copy and paste this entire line into PowerShell (the quotes around the path are mandatory):

```
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.ts --no-watch
```

(Alternative without changing dir, for CI/scripts:)
```
npx vitest run --root "C:\Build\Bad Ass Tasks" "tests/notes-m2-smoke.test.ts" --no-watch
```

### How to interpret results and failures
- Green: all ~23-36 high-signal cases (original + the 5 new gap closers) passed. Safe to commit.
- Red failure: the stack trace includes the exact `it('...')` title + source line in notes-m2-smoke.test.ts.
  - **Use the dedicated practical mapper for instant lookup:** [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) (failure signatures → gaps reference)
  - Quick examples (see mapper for full exhaustive list + P- charters):
    - "stable sortOrder renormalization" → Gap 1 (sortOrder)
    - "kanban intra-column drag persistence" / "named saved views stub" → Gap 3 (DatabaseBlock)
    - "synced-block bidirectional contract" → Gap 5 (SyncedBlock)
    - "backlink centralization" → Gap 2
  - Common causes: component text/attr change, mock handler not wired, new required prop, sortOrder now returns different distribution.
- Use `--reporter=verbose` appended to the one-liner for per-test timing + full console.
- Filter to M2 areas only: append `-t "M2|DatabaseBlock|SyncedBlock|Hierarchy|Gap Closers|sortOrder|bidirectional"`.
- Re-run single case during debug: `-t "exact it title substring"`.

**For smoke runners: keep the [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) open as your primary red-smoke quick reference.**

Run this one-liner locally after any M2-related edit. No terminal execution from agents — user pastes directly.

### Full Hygiene Regression (MANDATORY before/after any review or change — demo-tolerant)
```powershell
npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e
```
- Captures: TypeScript (zero errors target), ESLint (no new), build, Vitest core, Playwright e2e smoke.
- Expect: Exit 0 (green) on demo paths. Capture full terminal output as evidence.

### Manual Notes-Focused Smoke (15-30 min)
(Verbatim from SIGNOFF-CHECKLIST-2026-05-31.md §3)

1. Launch dev server (keep running):
   ```powershell
   npm run dev
   ```
   Wait for localhost:3000. Hard refresh (Ctrl+Shift+R) in browser. Open DevTools → Console (clear; filter Errors/Warnings). Confirm "DEMO" indicators + banner.

2. Navigate to Notes surface (via bottom nav or command palette / views).

3. **Hierarchy + Drag**:
   - Create top-level notes + sub-notes ("New sub-note").
   - Drag notes to reparent (onto other notes) and reorder within parent. Verify optimistic expand, no cycles, stable after refresh.
   - Sidebar tree + search mode both functional with badges (← N for backlinks).

4. **Bidirectional Linking (core M2)**:
   - Open a note → use header "Linked Tasks" dropdown + in-editor /link or /note-link picker (real data, grouped, keyboard nav, fuzzy filter).
   - Insert @mentions for tasks/notes → verify auto link creation (useMentions).
   - Remove via panel × buttons or text deletion where supported.
   - Confirm symmetry: task side shows linked notes; backlinks accurate; refresh persists.
   - Test note-to-note full symmetry.

5. **Rich TaskEmbeds**:
   - Use /task slash → embed live cards.
   - Inline edit title (double-click or ✎), due (prompt), priority (cycle), status toggle, assignee cycle on card.
   - Unlink / deleted state (red strikethrough) handling.
   - Click card opens TaskModal; counts and data stay live.

6. **Version History**:
   - Use header "History" button + toolbar access.
   - Create manual + title-change snapshots.
   - View diff (side-by-side OLD/CURRENT with highlights).
   - Restore (safety "Before restore" snapshot + confirm). Verify non-destructive.
   - Test Export JSON/TXT buttons.

7. **DatabaseBlock (M2 complete interactive)**:
   - Insert via /db-block (placeholder evolves to real).
   - Switch Table ↔ Board; apply priority filters; drag status columns (intra + inter).
   - Edit View form: title, types, "Save current view", named saved views (input + Save + Load dropdown).
   - Persistence across note reload/remount.
   - Responsive Board (mobile 1-col).

8. **SyncedBlock**:
   - Insert /synced-block, pick target note via picker.
   - "Re-sync", clickable header to open source, graceful missing state.
   - Live reference resolution.

9. **Post-Smoke**:
   - Hard refresh ×2. All state (links, hierarchy order, history, DB configs) survives.
   - Console: zero new errors.
   - Toggle to any LIVE Supabase (if .env.local present) — same flows must work (guards respected).
   - Re-run the full hygiene chain above.

**Evidence Standard**: Terminal outputs + this checklist marked + 2-3 screenshots (tree with drag, TaskEmbed inline, DB Board + named view dropdown, history diff).

**Full References for Manual Steps**: [M0-POST-EDITOR-MANUAL-SMOKE-TEST.md](./M0-POST-EDITOR-MANUAL-SMOKE-TEST.md), [M0-POST-EDITOR-REGRESSION-SMOKE-CHECKLIST.md](./M0-POST-EDITOR-REGRESSION-SMOKE-CHECKLIST.md), [M0-HYGIENE-RUNBOOK.md](./M0-HYGIENE-RUNBOOK.md) (Sections 2.2/2.3/2.4), and the M2 smoke test file itself for exact assertions.

### What Good Looks Like for User Takeover
(From SIGNOFF-CHECKLIST §4 + Readiness cross-reference)

M2 is "done" (user can confidently start debugging/refining or move to M3) when:
- All 7 gaps have either concrete shipped increments (with evidence in the living progress doc) **or** explicit, narrow, well-documented de-scopes/bridges with rationale and no open critical holes.
- Full hygiene chain (typecheck + lint + build + test + e2e) exits 0 with no new errors introduced by M2 surfaces.
- M2 smoke suite (`notes-m2-smoke.test.ts`) passes 100% (all cases green).
- Manual Notes smoke (Section 3) passes end-to-end: hierarchy malleable and safe, bidirectional magic (picker + auto-mentions + panels + symmetry) delightful and automatic, TaskEmbeds feel "live editable", history safe + useful, DatabaseBlock and SyncedBlock production-grade for M2 scope, zero console errors on all paths, refresh persistence perfect in demo (and live when activated).
- All invariants (Section 2) verified via greps + runtime + the two post-edit `read_file` disciplines followed throughout the wave.
- Docs package complete: This checklist + updated WAVE8-MASTER-PLAN (Agent 46 status) + MILESTONE-2-PROGRESS (closeout + gaps + fold-ins) + any final handoff notes.
- User experience: Notes feel like the "love child of Notion + Obsidian + Linear" — addictive, interconnected, hierarchical, versioned, with magical embeds and links. Demo remains pristine (non-negotiable).

**If any invariant or smoke fails**: Do not declare M2 complete. Use the artifacts to drive the final narrow wave or direct fixes.

**User Decision Point**: After running the above, reply with "M2 done — begin user-led refinement/M3" or "one more wave on the 7 gaps (with specific priorities)".

---

## 4. M3 Starting Kit for Gaps 3 & 5 (Primary M2→M3 Bridges — Activation Content)

*(Integrated for Decision Day as the single-master M3 kickoff kit. Drawn verbatim/synthesized from SIGNOFF-CHECKLIST-2026-05-31.md §5 "M3 Bridge Items", M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md (Gap Area 3 + Gap Area 5 charters, reframed for the M2→M3 path), MILESTONE-2-PROGRESS-2026-05-28.md (scaffold polish + handoff notes), M2-READINESS-REPORT-2026-05-31.md, and invariant table in this pack. Focused on the two explicit heavy M2→M3 scoped gaps. Other bridges exist but 3 & 5 are the largest production MVPs + scaffolds.)*

**If you choose the M2→M3 path ("M2 done — begin user-led refinement/M3"), begin here.** Gaps 3 (DatabaseBlock) and 5 (SyncedBlock) received strong interactive MVPs in M2 with deliberate, heavily scaffolded bridges for the next phase. All "WHERE THE REAL..." / "M2→M3" / "HANDOFF FOR FUTURE AGENT 47/53 (M3)" markers are preserved in source with **zero behavior change** to current M2 surfaces.

### Gap 3 Focus: DatabaseBlock production completeness (server query engine / RPC foundation + full named views)

**M3 Starting Charter** (narrow, production-oriented):
- Advance named saved views to full narrow production (build directly on the delivered MVP: Edit View form title/types, "Save current view", Load dropdown, `queryConfig.views[]` persistence).
- Implement explicit server query engine stubs / RPC hook foundations. Numbered M3 scaffolding ("WHERE THE REAL ENGINE GOES"), RLS/hybrid notes, demo guards, and stable result shapes required.
- Existing interactive Board/kanban (intra + inter drag, columnOrders, priority filters, responsive), queryConfig auto-persist, and filter UI must remain 100% untouched.

**Key scaffold locations — read these first for any M3 work**:
- `features/notes/editor/extensions/database-block.ts` (top + `getDatabaseBlockData` stub): "M2→M3 SERVER QUERY ENGINE STUBS / RPC FOUNDATION". Handoff notes anchored to SIGNOFF §5 "server query engine stubs / RPC hooks foundation" + "hybrid query execution + RPCs". Includes inline stub + import comment.
- `features/notes/editor/extensions/database-block-node-view.tsx` (Board + named views MVP + persistence logic, esp. ~175-193): Edit View form, Load dropdown, queryConfig enrichment.

**First M3 increment success criteria**:
- Named views fully save/load/apply/persist via `queryConfig.views[]` (demo + live paths).
- Server stubs + clear M3 implementation steps documented (parse queryConfig, guarded supabase.rpc/.from(), RLS, hybridStore migration notes, demo ID guards, stable result shape).
- Expanded smoke cases cover view lifecycle + persistence.
- Zero regression to M2 Board/filter/drag behavior or invariants.

### Gap 5 Focus: SyncedBlock bidirectional + polish (explicit M2→M3 bridge — full content sync + production edges)

**M3 Starting Charter** (narrow, production-oriented):
- Extend the delivered title-only two-way sync MVP ("Edit in place", live auto-timestamp on source changes, Re-sync button, clickable header) to production edge cases: missing/deleted targets, cycles, deep hierarchies, live auto-updates.
- Strengthen scaffolding for full-content M3 sync (bidirectional content write path, serializers, extractors, ancestry-aware cycle prevention beyond current title-MVP).
- Preserve read-only foundation, picker flows, graceful missing state, "M2→M3 LIVE" badge/footer, and all prior behaviors perfectly.

**Key scaffold locations — read these first for any M3 work**:
- `features/notes/editor/extensions/synced-block.ts`: Strengthened top-level "M2→M3" header, onUpdateNote/options, addNodeView wiring, addCommands. Explicit "HANDOFF FOR FUTURE AGENT 47/53 (M3): Per §5 'SyncedBlock bidirectional live sync + richer edge handling (M2→M3 explicit)'" + "title-MVP only" precision.
- `features/notes/editor/extensions/synced-block-node-view.tsx`: "M2→M3 FULL CONTENT BIDIRECTIONAL SYNC SCAFFOLDING", CONTENT_WRITE STUB, cycle/data bridge, re-sync handlers, extract comments. Clarified "full content sync remains explicitly title-MVP only / M3 gated".
- Cross-wiring: `features/notes/editor/TipTapEditor.tsx` (slash command + configure for onOpenNote).

**First M3 increment success criteria**:
- Bidirectional title sync remains automatic/live (already M2-complete); source changes trigger timestamp + re-sync.
- Edge cases (deleted/missing target, cycles, deep hierarchies) handled gracefully without crashes or data loss.
- Heavy M2→M3 comments + stubs for remaining full content sync work are complete and ready for implementation.
- Smoke + manual verification cover sync flows + documented edges. Navigation/picker identical to M2.
- "M2→M3 LIVE" + conditional read-only footer UX preserved.

### Additional M3 Context (from SIGNOFF-CHECKLIST §5)
These bridges (plus lighter ones for History server round-trip, deeper AI stubs in editor "AI" slash category with "WHERE THE xAI/Grok CALL WILL GO" markers, a11y depth, final slimming) are already lightly scaffolded (stubs, comments, foundation code) so M3 can start immediately after M2 sign-off without re-architecture.

Full M3 bridge list: See [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) §5.

**End of M3 Starting Kit**. This section + the crown jewels below give a user choosing the M2→M3 path everything needed for instant activation. All per the 10-agent + verification wave outcomes and explicit handoff markers in source.

---

## 5. Crown-Jewel Artifacts (Direct Links/References)

These primary artifacts contain the authoritative original source material. All content in this pack (including the integrated Decision Day Quick Reference and M3 Starting Kit for Gaps 3 & 5 above) is aggregated from them + MILESTONE-2-PROGRESS (which embeds the 11-invariant table and wave closeouts). This Evidence Pack is the **single master reference** — use it first on Decision Day.

### Core Handoff & Evidence Crown Jewels
- **[M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md)** — Primary review document. Contains the 7 gaps, full invariants checklist (Section 2), exact Windows/PowerShell smoke commands (Section 3), "What good looks like" (Section 4), M3 bridges (Section 5), and transparency appendix of reads performed.
- **[M2-READINESS-REPORT-2026-05-31.md](./M2-READINESS-REPORT-2026-05-31.md)** — Comprehensive audit against SIGNOFF. Executive summary, status against all 11 invariants (detailed narrative), status against "What Good Looks Like", specific remaining holes/risks (M2→M3 bridges), and explicit recommendation ("M2 ready for user review").
- **[10-AGENT-WAVE-COMPLETION-2026-05-31.md](./10-AGENT-WAVE-COMPLETION-2026-05-31.md)** — Wave outcome table for all 10 agents, impact on the 7 gaps, key handoff artifacts created, follow-up JSX parse blocker resolution details, and overall M2 state summary post-wave.
- **[WAVE8-MASTER-PLAN.md](./WAVE8-MASTER-PLAN.md)** (M2 Status section, lines 103-120) — Inserted "M2 Status as of 2026-05-28 (Agent 46 charter)" block with verbatim 7 prioritized gaps, delivered summary, post 10-agent + 3-agent verification mini-wave updates, and explicit "Ready for user review/decision at any time" language with decision phrases.
- **[M2-DECISION-DAY-2026-05-31.md](./M2-DECISION-DAY-2026-05-31.md)** — Short one-pager (exact one-liner + two decision phrases + Decision Day checklist). **Content fully integrated** into this pack (see Decision Day Quick Reference above) for single-master convenience.
- **[M2-DECISION-DAY-COMMAND-CENTER-2026-05-31.md](./M2-DECISION-DAY-COMMAND-CENTER-2026-05-31.md)** and **[M2-ACTIVATION-SCRIPTS-2026-05-31.md](./M2-ACTIVATION-SCRIPTS-2026-05-31.md)** — Practical activation one-pagers (Command Center + ultra-short launch scripts). Cross-linked for instant use on Decision Day.

### Conditional Path Artifact (One More Wave)
- **[M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md](./M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md)** — **CONDITIONAL DRAFT — ONLY IF USER CHOOSES "one more wave on the 7 gaps (with specific priorities)"**. 
  - Pre-authored planning reference. Becomes actionable exclusively on that exact decision phrase.
  - Contains: Governance rules, overall success criteria, proposed 5-agent parallel structure (P-1 to P-5 mapping to the 7 gaps), and **detailed narrow charters + success criteria + estimated scope + file targets for every gap** (including full Gap Area 3: DatabaseBlock + Gap Area 5: SyncedBlock sections).
  - Gap 3 & 5 content from this proposal was used to populate the M3 Starting Kit (Section 4) above — but the full proposal adds the other gaps (1,2,4,6,7), agent assignments, and wave execution rules.
  - **Status note**: Strictly a planning artifact for one possible user-chosen path. No assumptions. No activation without the trigger phrase.
- **[M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md)** — Spawn-ready activation package (5 P-agents with copy-paste prompt blocks). Companion to the proposal above. Use this for instant parallel launch if the "one more wave" phrase is chosen.

### Dual-Path Kickoff & M3 Starting Kit Activation Files
- **[M3-KICKOFF-IF-M2-DONE-2026-05-31.md](./M3-KICKOFF-IF-M2-DONE-2026-05-31.md)** — Full M3 Starting Kit / spawn-ready activation package (M3-1, M3-2, M3-3 agents with verbatim prompt templates for Gaps 3 & 5 + AI). The dedicated file counterpart to the integrated M3 Starting Kit content in Section 4. Use for instant launch on the "M2 done — begin .../M3" phrase.
- **[M2-DECISION-DAY-COMMAND-CENTER-2026-05-31.md](./M2-DECISION-DAY-COMMAND-CENTER-2026-05-31.md)** — Ultimate one-screen practical Command Center (smoke one-liner + exact phrases + checklist + activation commands + quick links).
- **[M2-ACTIVATION-SCRIPTS-2026-05-31.md](./M2-ACTIVATION-SCRIPTS-2026-05-31.md)** — Ultra-short "second the phrase is said, run these lines" helper with copy-paste PowerShell blocks for both paths.
- [M2-DECISION-DAY-2026-05-31.md](./M2-DECISION-DAY-2026-05-31.md) — The short Decision Day one-pager (integrated above).
- **[M2-DECISION-DAY-CHEAT-SHEET-2026-05-31.md](./M2-DECISION-DAY-CHEAT-SHEET-2026-05-31.md)** — Corner quick-ref (one-liner + phrases + activation blocks).
- **🚨 [M2-SMOKE-RUN-COMPANION-2026-05-31.md](./M2-SMOKE-RUN-COMPANION-2026-05-31.md)** — The practical live-use helper for while the user is running the smoke tests right now. Exact one-liner variants, capture checklist, full manual smoke steps (hierarchy/bidir/DB/Synced), failure signatures → gaps map. Keep tab open during execution. (Primary companion referenced from top banner + Quick Reference.)
- **[M2-ULTRA-CLEAN-ACTIVATION-2026-05-31.md](./M2-ULTRA-CLEAN-ACTIVATION-2026-05-31.md)** — <5s copy-paste activation blocks (polished companion to Activation Scripts).
- **[M2-POST-DECISION-48HOUR-PLAYBOOK-2026-05-31.md](./M2-POST-DECISION-48HOUR-PLAYBOOK-2026-05-31.md)** — 48h activation governance + timeline for either decision path.
- **🚨 [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md)** — the practical failure signatures → gaps reference (PRIMARY for smoke test runners). Instant live mapper: exact failing `it('title')` from stack → Gap + owning kickoff charter. Open on any red smoke.

### Additional Living References (cross-linked throughout this pack)
- [MILESTONE-2-PROGRESS-2026-05-28.md](./MILESTONE-2-PROGRESS-2026-05-28.md) (the 2026-05-30/31 10-agent closeout section + 3-agent verification wave + full 11-invariant table + gap fold-ins + M2→M3 scaffolding enhancer details)
- [M2-TEST-RUN-INSTRUCTIONS.md](./M2-TEST-RUN-INSTRUCTIONS.md) (exact one-liner + interpretation + new learnings from sortOrder expansion)

**End of Pack**. All Decision Day material (one-pager, M3 Starting Kit for Gaps 3 & 5 + dedicated kickoff file, dual-path proposals + kickoff files, evidence tables, smoke pack, live Smoke Run Companion + Smoke Failure Mapper, closeout, decision language) is now self-contained in this single master document. A user on Decision Day needs only this file + the ability to run the documented commands on `C:\Build\Bad Ass Tasks`. Zero code changes. Process discipline (internal todo_write, narrow charters) maintained throughout.

---

*Pack integrated by M2 Evidence Pack Integrator (docs-only) per ultra-narrow charter. Merged DECISION-DAY one-pager, M3 Starting Kit for Gaps 3 & 5 (plus dedicated M3-KICKOFF activation file), dual-path proposal + kickoff files, and crown jewel references cleanly. Evidence Pack is now the single master reference. No modifications to source code, behavior, or any other files.*
