# M2 Sign-Off Checklist — 2026-05-31

**Project**: Bad Ass Tasks (Wave 8 / Agent 46 charter — Notes System + Deep Task Integration)  
**Date**: 2026-05-31 (PT)  
**Status**: Crown jewel handoff artifact. Self-contained for user decision: "M2 done — start debugging/refining or M3 transition" **OR** "authorize one final targeted wave for the remaining gaps".  
**Companions** (read these first):  
- `WAVE8-MASTER-PLAN.md` (new short "M2 Status as of 2026-05-28" section inserted directly under the Agent 46 charter)  
- `MILESTONE-2-PROGRESS-2026-05-28.md` (appended "2026-05-30/31: Prior 10-Agent Wave Completion + Resumption" section with full closeout summary + the exact 7 prioritized gaps + sub-agent fold-ins)  

This checklist consolidates everything the user needs for review without opening code. All work to date has strictly followed the Iron Rule, WAVE8 governance, hybrid/demo invariant, and "zero new console errors" bar.

---

## 1. Remaining Work: The 7 Prioritized High-Leverage M2 Gaps

These were synthesized from living "Remaining High-Leverage Items", the M2 Close-out Audit sub-agent charter, and wave focus areas. One gap (#6) explicitly encompasses final closeout prep + handoff.

1. **Stable integer sortOrder normalization** (highest-leverage data hygiene)  
   Full load-time renormalization + hardened mid-point math for all reorders/reparents. Eliminate any drift or unstable ordering after repeated drag/reparent cycles. (sortOrder groundwork + same-parent handling already shipped.)

2. **Backlinks centralization**  
   Make `useBacklinks` hook the single source of truth. Unify sidebar badges (← N), `getBacklinkCount`, editor panel, and all consumers. Remove any remaining inline computation.

3. **DatabaseBlock production completeness**  
   Named saved views (narrow MVP already delivered in post-closeout fold-in) + server query engine stubs / RPC hooks foundation. Full interactive NodeView + filter UI ready for M3 wiring.

4. **Version History depth**  
   Richer structured/JSON diff viewer + complete server snapshot persistence (onPersistSnapshot live round-trip when Supabase active). Export already present; per-note + title autosnap already solid.

5. **SyncedBlock bidirectional + polish** (explicit M2→M3 bridge)  
   Two-way sync, live updates on source note change, production edge cases (missing targets, cycles, deep hierarchies). Read-only foundation + picker already shipped.

6. **Monolith slimming (narrow) + test execution**  
   One focused additional extraction in the notes domain + **user-executable run of the full expanded M2 smoke suite** (notes-m2-smoke.test.ts now ~18-30 high-signal cases covering drag, picker, restore, export, DB queryConfig, Board status, mentions, sortOrder, synced stub, history contract). Terminal path-with-space limitations noted in prior agent output — use `npx vitest run ...` or full `npm test -- ...`.

7. **Mobile/keyboard a11y depth + AI wiring**  
   Focused polish on Kanban Board + SyncedBlock + History panel + note tree (touch targets, responsive, keyboard nav). Deepen the AI slash stubs (already present in "AI" category with "WHERE THE xAI/Grok CALL WILL GO" markers + context injection points) with richer prompts and editor integration.

**Current Momentum Note**: Several gaps have partial or full incremental delivery from the final wave fold-ins (named views, test expansion, hygiene). The package is mature.

---

## 2. Invariants to Verify (Non-Negotiable — 100% Must Hold)

- **Demo / Live / Hybrid Separation**: `isSupabaseLive()` and `isSupabaseConfigured()` guards at the absolute top of every public export in `lib/data/hybridStore.ts`. Demo workspaces ("w1", "w2") hard-blocked in all live paths. No SAMPLE data leakage. DEMO badges and SupabaseSetupBanner behave correctly.
- **Zero Console Errors** in the entire Notes surface (hierarchy tree, drag/reparent, TaskEmbed, bidirectional panels/picker/mentions, Version History, DatabaseBlock, SyncedBlock, editor slash commands).
- **Bidirectional Symmetry**: Task ↔ Note and Note ↔ Note links (via `linkedTaskIds` / `linkedNoteIds`) create, remove, and reflect automatically (mention insertion, panel actions, picker). Backlinks accurate via scanning.
- **Hierarchy Safety**: Drag-to-reparent + intra-parent reordering never creates cycles (existing ancestor walk guard). sortOrder + parentNoteId math produces stable, refresh-persistent trees.
- **TaskEmbed Liveness**: Embedded cards prefer live store data; support inline title/due/priority/assignee/status edits + unlink + deleted-state handling. Updates flow through `updateTask` (hybrid safe).
- **Version History Safety**: Snapshots (auto + manual + title) are non-destructive. "Before restore" auto-snapshot + confirm always fires. Export (JSON/TXT) works. Restore is safe.
- **DatabaseBlock & SyncedBlock**: Interactive (Board/kanban drag, filters, named views, queryConfig persistence). Synced references resolve and allow navigation without crashes.
- **Extraction Hygiene**: Notes domain uses hooks (`useNoteOperations`, `useMentions`, `useBacklinks`, `useNoteSearch`, `useNoteKeyboard`) and extracted components (LinkedTasksPanel, NoteHeader, etc.). `app/page.tsx` `renderNotesView` is thin wiring.
- **TypeScript / Lint / Build Clean**: On notes-related surfaces (no new `as any` in domain paths). Full atomic hygiene chain green.
- **Refresh + Persistence**: All M2 state (hierarchy, links, history, DB view configs, editor content) survives hard refresh in both demo and (when configured) live.
- **No Scope Creep**: Zero changes to hybridStore core, Zustand, realtime foundations, auth, or non-Notes surfaces beyond narrow M2 bridges.

**Verification Method**: Full hygiene chain (see Section 3) + manual Notes smoke (Section 3) + targeted greps for guards + `grep` for demo seeds in features/notes/.

---

## 3. How to Run the Smoke Tests on Windows (PowerShell)

**Project Root**: `C:\Build\Bad Ass Tasks` (canonical tree — edits always land here).

**Prerequisites** (run once):
```powershell
cd C:\Build\Bad Ass Tasks
git status                          # Recommended: clean or note uncommitted M2 changes
npm install                         # If needed
```

**Full Hygiene Regression (MANDATORY before/after any review or change — demo-tolerant)**:
```powershell
npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e
```
- Captures: TypeScript (zero errors target), ESLint (no new), build, Vitest core, Playwright e2e smoke.
- Expect: Exit 0 (green) on demo paths. Capture full terminal output as evidence.

**M2-Specific Smoke Suite (notes-m2-smoke.test.ts — expanded to ~18-30 cases)**:
```powershell
# Targeted run (recommended)
npx vitest run tests/notes-m2-smoke.test.ts

# Or via npm
npm test -- tests/notes-m2-smoke.test.ts
```
- Covers: DB queryConfig persistence + Board status drag, history extraction/restore/export contract, synced stub + picker, sortOrder math, mentions auto-sync, hierarchy reparent, TaskEmbed behaviors, etc.
- **Path note** (from prior agent): Some agents saw "grok build projects\Build" view in context; always use the canonical `C:\Build\Bad Ass Tasks\tests\notes-m2-smoke.test.ts` path. Use `npx` to avoid certain quoting issues with spaces in broader paths.
- Expect: All cases pass (18+ high-signal assertions using renderHook, fireEvent, mocks for hybrid).

**Manual Notes-Focused Smoke (15-30 min, adapted from M0-POST-EDITOR-MANUAL-SMOKE-TEST.md + M0-POST-EDITOR-REGRESSION-SMOKE-CHECKLIST.md + M0-HYGIENE-RUNBOOK.md §2.4)**:

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

**Full References for Manual Steps**: `docs/M0-POST-EDITOR-MANUAL-SMOKE-TEST.md`, `docs/M0-POST-EDITOR-REGRESSION-SMOKE-CHECKLIST.md`, `docs/M0-HYGIENE-RUNBOOK.md` (Sections 2.2/2.3/2.4), and the M2 smoke test file itself for exact assertions.

---

## 4. What Good Looks Like for User Takeover

**M2 is "done" (user can confidently start debugging/refining or move to M3) when**:
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

## 5. M3 Bridge Items (Logical Next After M2 Polish)

These are explicitly called out in charters, progress docs, and stubs as post-M2:
- Full custom TipTap NodeView + React rendering engine for DatabaseBlock with hybrid query execution + RPCs (beyond the current JSON config + DOM table/Board).
- Server-side snapshot persistence (full onPersistSnapshot round-trip for Version History when live Supabase active) + richer structured JSON diff viewer.
- Deeper AI integration in editor (real xAI/Grok calls for "Summarize...", "Extract action items", "Improve writing" — replace the explicit stubs/markers with production orchestration, context-aware prompts, and streaming).
- Stable full sortOrder normalization + optional virtualization for very large note hierarchies.
- Mobile/keyboard/a11y production polish across all new M2 surfaces (Board, SyncedBlock, History, tree drag, editor toolbar).
- SyncedBlock bidirectional live sync + richer edge handling (M2→M3 explicit).
- Notes domain final extraction / monolith slimming (if any thin remainders).
- Broader Wave 8 unlocks (post-Phase 1 Supabase live activation): realtime for new M2 surfaces, AI+Graph collab per Agent 47, advanced task views (48), etc.
- Onboarding/activation "magic moments" surfacing the new deep notes power (first linked note+task, first DB block, first history restore).

These bridges are already lightly scaffolded (stubs, comments, foundation code) so M3 can start immediately after M2 sign-off without re-architecture.

---

**This is the complete, production-oriented handoff.**

All prior waves (including the just-closed 10-agent wave) maintained obsessive governance, internal `todo_write`, mandatory post-edit `read_file` verification on every touched file, and strict isolation where used. The three updated/created docs (WAVE8-MASTER-PLAN.md, MILESTONE-2-PROGRESS-2026-05-28.md, and this checklist) give the user everything needed for a confident decision with zero ambiguity.

**Prepared by**: Senior Technical Writer + M2 Domain Expert (Wave 8 / Agent 46 charter context)  
**Exact Reads Performed During This Handoff** (for transparency):  
- Multiple targeted `read_file` (full + offset/limit) on `WAVE8-MASTER-PLAN.md` (Agent 46 charter, later M2 updates, end sections)  
- Multiple targeted `read_file` (full + offset 1-300, 301+, 451+, 1700+, 1753+, 1760+, 1780+, 1788) on `MILESTONE-2-PROGRESS-2026-05-28.md` (all autonomous batches + the full appended 10-agent closeout + 7 gaps + final fold-ins)  
- `read_file` on `README.md` (top 100 lines for context on Wave 8 references and current status)  
- `read_file` (initial + targeted sections) on supporting docs: `M0-POST-EDITOR-MANUAL-SMOKE-TEST.md`, `M0-POST-EDITOR-REGRESSION-SMOKE-CHECKLIST.md`, `M0-HYGIENE-RUNBOOK.md` (hygiene commands, guard audit, manual smoke procedures, Windows/PowerShell examples)  
- `list_dir` on `C:\Build\Bad Ass Tasks`, `C:\Build\Bad Ass Tasks\docs`, and workspace root context  
- `grep` (multiple, path-restricted to docs/ and specific files) for "Agent 46", "7 prioritized gaps", "smoke test", "M2 Close-out", "notes-m2-smoke", hygiene commands, etc.  
- Post-edit `read_file` verification on every edited file (WAVE8 section 95-144, MILESTONE end 1780-1789, and the full new checklist upon creation) + additional greps as needed for placement accuracy.  

**No code, no tests executed, no terminal commands, isolation "none" respected, docs only.**

Ready for your review and decision, user. Let's make the next phase legendary.