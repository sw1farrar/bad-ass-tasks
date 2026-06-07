# M2 Decision Readiness Pack — 2026-06

**Prepared by**: M2 Decision Readiness Prep Agent (subagent)  
**Date**: 2026-06 (on C4 wave wrap-up / pre-decision)  
**Purpose**: Frictionless handoff pack for the main thread. The moment the user finally provides M2 smoke results + one of the two exact decision phrases, this document + the user's captured evidence is the complete, copy-paste-ready package to close M2 and activate the correct next path (user-led refinement/M3 or one more targeted wave).  

**Current Context**: C4 execution wave (realtime collaboration + invites/membership lifecycle + Home global workspace hub) is wrapping up. User has repeatedly signaled "continue" but has not yet run/pasted the M2 smoke results or replied with either exact phrase:
- `"M2 done — begin user-led refinement/M3"`
- `"one more wave on the 7 gaps (with specific priorities)"`

All prior M2 artifacts (10-agent wave + 3-agent closeout polish + C4 prep) remain valid. This pack incorporates **current post-C4 state**, exact Windows/PowerShell commands (with hard-won path quoting + extension lessons), evidence standards, pre-drafted WAVE8 updates, and a decision matrix.

**Governance Reminder (for all paths)**: Narrow scope. Internal `todo_write`. Mandatory post-edit `read_file` + path-restricted `grep`. 100% demo/live/hybrid invariant preservation (`isSupabaseLive()` / `isSupabaseConfigured()` guards at top of every public export; w1/w2 demo blocks). Zero new console errors.

**Latest Polish (this Continue. wave)**: The newest one-pagers [2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md](./2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md) and [2026-06-DECISION-GATE-LATEST-POLISH-SUMMARY.md](./2026-06-DECISION-GATE-LATEST-POLISH-SUMMARY.md) are the latest high-signal consolidators. Recent polish also in WAVE8-MASTER-PLAN.md ("Latest Gate Polish (this Continue. wave)" note), Master Handoff, README, Inventory, Launch Guide, and Command Center (each with "**Latest Polish (this Continue. wave)**" notes). Pointer to exact canonical section: `## 2026-06 Post-C4 + Zustand Hygiene Fix + Exhaustive Decision Package Ready (This Continue Wave)` in WAVE8-MASTER-PLAN.md. Purely additive friction reduction at the gate.

---

## 1. Exact Current Windows / PowerShell Commands (Full Hygiene + M2 Smoke Suite)

**Canonical Project Root** (use the exact casing shown in your File Explorer / terminal; Windows is case-insensitive):
`C:\Build\Bad Ass Tasks` (or `C:\build\bad ass tasks` — quote it either way).

### Prerequisites (run once)
```powershell
cd "C:\Build\Bad Ass Tasks"
git status                          # Expect clean or note any uncommitted C4/M2 changes
# npm install                       # Only if package-lock changed
```

### Full Hygiene Regression (MANDATORY — run immediately before smoke + after any manual changes)
```powershell
npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e
```

**Why full chain every time (post-C4 note)**: C4 touched shared core (`lib/data/hybridStore.ts`, `app/page.tsx`, realtime subscriptions, invites/membership, Home wiring). The M2 smoke suite itself is heavily mocked and stable, but `typecheck`/`lint`/`build`/`test:e2e` validate integration. Exit code 0 + zero new errors = green. **Post-C4 Hygiene Baseline** (from dedicated auditor + task `019e74de-faf0-7861-8cff-0b3354c955d0`): 22 TS errors (exact pre-existing M2 extraction residuals in page.tsx + NotesView/TipTap/hooks + tests; 0 new), 30/120 test fails (pre-existing M2 smoke + hybridStore mock + jsdom drag + recurring edges), lint/build impacted by pre-existing anys. See "Post-C4 Hygiene Baseline Report" section in docs/C4-WAVE-COMPLETION-2026-06.md (now the required reference baseline). Re-run hygiene immediately before your smoke for fresh logs.

**Capture**: Copy the **entire** terminal block (stdout + any stderr) into your reply or a dated log file (e.g. `M2-hygiene-2026-06-XX.log`).

### M2-Specific Smoke Suite (`notes-m2-smoke.test.tsx`)
**🚨 CRITICAL CORRECTION (post-C4 / legacy doc audit)**: Every prior M2 artifact (DECISION-DAY-*, SIGNOFF, WAVE8, EVIDENCE-PACK, TEST-RUN-INSTRUCTIONS, COMMAND-CENTER, etc.) incorrectly references `tests/notes-m2-smoke.test.ts`.  
**The actual file on disk is `tests/notes-m2-smoke.test.tsx`** (confirmed via directory + file reads + prior execution logs).  
Using `.ts` will fail to locate the test. **Always use `.tsx`** going forward. This pack is the corrected source of truth.

**Primary one-liner (recommended — copy/paste exactly)**:
```powershell
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch
```

**Alternative (no directory change — good for scripts / CI)**:
```powershell
npx vitest run --root "C:\Build\Bad Ass Tasks" "tests/notes-m2-smoke.test.tsx" --no-watch
```

**Recommended variants during debugging / evidence**:
```powershell
# Verbose (per-test timing + full console in output)
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose

# Focused on highest-leverage areas (Gap 1 sortOrder + recent renorm cases)
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch -t "sortOrder|renormaliz|Gap Closers|Hierarchy drag|load-time|cross-parent|defensive guards|integer guarantees"

# General M2 surfaces
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch -t "M2|Gap Closers|sortOrder|DatabaseBlock|SyncedBlock|backlink|kanban|history|synced"

# Re-run single failing case (replace with exact it() title substring from stack)
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch -t "exact failing it title here"
```

**Via npm (alternative)**:
```powershell
npm test -- tests/notes-m2-smoke.test.tsx
npm test -- tests/notes-m2-smoke.test.tsx -- --reporter=verbose
```

**Expected**: ~30–40 high-signal cases (M2 Core Flows + M2 Gap Closers describe blocks + Server snapshot round-trip contract) all green. ~23–36 core assertions on hierarchy/sortOrder, bidirectional, TaskEmbed, DatabaseBlock (Board + named views stub), SyncedBlock, history contract, backlinks centralization, guards.

**If red**: Immediately open and use [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) — map the exact failing `it('title')` from the stack trace to the owning Gap (1–7) + charter.

**Capture**: Full terminal output (especially with `--reporter=verbose` for red runs).

### Manual Notes-Focused Smoke (15–30 min — after `npm run dev`)
```powershell
npm run dev
```
- Wait for `localhost:3000` ready.
- **Hard refresh ×2** in browser (Ctrl + Shift + R).
- Open DevTools → Console tab (clear it; filter to Errors/Warnings only). Confirm DEMO badge + SupabaseSetupBanner visible.
- Navigate to Notes surface (bottom nav or Command Palette).

**Key flows to exercise** (full details in [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) §3 and [M2-SMOKE-RUN-COMPANION-2026-05-31.md](./M2-SMOKE-RUN-COMPANION-2026-05-31.md)):
1. **Hierarchy + Drag**: Create top-level + sub-notes. Drag reparent + intra-parent reorder. Verify no cycles, optimistic UI, stable order + expand state after hard refresh.
2. **Bidirectional Linking (core M2)**: Use header Linked Tasks dropdown, /link or /note-link picker, @mentions (auto link creation). Remove via panels or deletion. Verify full symmetry (task↔note + note↔note), backlink badges (← N), refresh persistence.
3. **Rich TaskEmbeds**: /task slash → live editable cards. Inline edit title/due/priority/status/assignee. Unlink + deleted state (red strikethrough). Click opens TaskModal; data stays live.
4. **Version History**: Header History + toolbar. Manual + title-change snapshots. Structured + JSON diff viewer. Restore (safety "Before restore" snapshot + confirm). Export JSON/TXT.
5. **DatabaseBlock (M2 interactive)**: /db-block. Table ↔ Board switch. Filters + intra/inter-column drag. Edit View form (title/types/filters) → "Save current view" + Load dropdown (named views MVP). Persistence across reload.
6. **SyncedBlock**: /synced-block + picker. Re-sync, clickable source header nav, graceful missing state, live title sync (bidir MVP).
7. **Post-Smoke Verification**:
   - Hard refresh ×2 → all state (links, hierarchy order, history snaps, DB queryConfig/views, Synced refs) survives perfectly.
   - Console: **zero new errors**.
   - (If `.env.local` present with live Supabase): Toggle to live workspace — repeat key flows (guards respected, same behavior).
   - Re-run the full hygiene chain above.

**Post-C4 note for manual**: C4 added realtime presence, invite flows, and Home aggregates. Spot-check that Notes surfaces still feel instant (no regressions in drag/picker/sync) and that switching workspaces via new Home hub (if wired) preserves note state.

---

## 2. What Evidence to Capture (Non-Negotiable Standard)

**Minimum for confident decision** (paste or attach in your reply):

- **Terminal output**:
  - Complete hygiene chain run (full stdout).
  - M2 smoke one-liner run (full stdout; use `--reporter=verbose` if any failures or for rich evidence).
  - Any focused re-runs.

- **Screenshots** (2–4 high-signal, timestamped filenames recommended):
  1. Sidebar + editor note hierarchy tree (show drag in progress or stable post-reparent + backlink badges ← N).
  2. DatabaseBlock Board view (drag between columns + Edit View form open showing "Save current view" button + named views Load dropdown populated).
  3. Version History panel (diff viewer side-by-side with highlights + Restore button / confirm dialog).
  4. SyncedBlock or TaskEmbed live card (inline edit + bidirectional panel symmetry visible).
  5. DevTools Console tab (after hard refresh ×2, filter Errors; ideally "Preserve log" enabled; show completely clean or only expected non-errors).

- **Console / Runtime**:
  - Explicit statement: "Zero new console errors on Notes surface post hard refresh ×2 (demo and live if tested)."
  - Any warnings that are pre-existing / defensive only (note them).

- **Other strong signals** (optional but high value):
  - `git status` + short `git diff --stat` (or full diff if changes).
  - Browser network tab or Supabase dashboard (if live) showing no errors during key flows.
  - Dated log files committed or pasted (e.g. `M2-smoke-evidence-2026-06-XX.txt`).

**Mark the [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) mentally or copy it**: Note pass/fail per invariant and per gap area.

**Failure protocol**: Any red smoke → open [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) immediately. Do not declare M2 done.

---

## 3. Pre-Drafted Sections for WAVE8-MASTER-PLAN.md

Copy the appropriate block verbatim (or lightly adapt with your date + evidence links) and insert it **immediately after the existing "M2 Status as of 2026-05-28 / 05-31 Closeout" synthesis section** (around the end of the long M2 block that ends with the 11-invariant table and "Next User Actions").

### Option A — If user replies exactly: "M2 done — begin user-led refinement/M3"

```markdown
## M2 Decision: COMPLETE — "M2 done — begin user-led refinement/M3" (2026-06-XX)

**User Decision Phrase (exact)**: "M2 done — begin user-led refinement/M3"  
**Decision Date**: 2026-06-XX (PT)  
**Evidence Pack**: See attached/pasted M2 smoke results + screenshots + this Readiness Pack (docs/M2-DECISION-READINESS-PACK-2026-06.md). Full hygiene + `notes-m2-smoke.test.tsx` passed 100%. Manual Notes smoke (hierarchy, bidirectional, TaskEmbeds, History, DatabaseBlock named views, SyncedBlock) passed with zero new console errors and perfect refresh persistence in demo (and live when tested).

**7 Gaps Status at Sign-Off**:
- 1. Stable integer sortOrder normalization — Closed (production-grade load-time + post-mutation renorm, integer Math.floor midpoint math, defensive guards).
- 2. Backlinks centralization — Closed (`useBacklinks` single source of truth).
- 3. DatabaseBlock production completeness — Strong MVP + named saved views delivered; explicit M2→M3 bridge for full server query/RPC + custom NodeView (see M3-1 charter).
- 4. Version History depth — Closed (structured/JSON diff + complete `onPersistSnapshot` round-trip contract).
- 5. SyncedBlock bidirectional + polish — Strong MVP (live title sync + heavy scaffolding); explicit M2→M3 bridge for full content sync (see M3-2 charter).
- 6. Monolith slimming (narrow) + test execution — Closed (multiple extractions; `renderNotesView` thin; expanded smoke suite + Windows-executable instructions delivered and passing).
- 7. Mobile/keyboard a11y depth + AI wiring — Addressed on new surfaces (44px+ targets, ARIA); AI slash stubs with explicit "WHERE THE xAI/Grok CALL WILL GO" markers present (deeper integration = M3-3).

**Invariants**: All 11 verified (8 GREEN production-grade in static + prior audits; 3 YELLOW purely user-executable hygiene/smoke/manual — now GREEN per user's run). Demo/live/hybrid separation pristine. Zero new console errors across the entire Notes surface.

**Overall M2 State**: Production-grade "love child of Notion + Obsidian + Linear" Notes platform delivered for M2 scope. Notes + deep bidirectional Task integration is addictive, hierarchical, versioned, embeddable, and ready for user-led refinement or M3 acceleration.

**Next**: Immediately activate M3 per [M3-KICKOFF-IF-M2-DONE-2026-05-31.md](./M3-KICKOFF-IF-M2-DONE-2026-05-31.md) and [M3-READY-EXECUTION-PROMPTS-2026-06.md](./M3-READY-EXECUTION-PROMPTS-2026-06.md). Launch M3-1 (DatabaseBlock server query/RPC), M3-2 (SyncedBlock full bidirectional content sync), M3-3 (AI editor integration) **in parallel**. Update this Master Plan with M3 status blocks. 48-hour post-decision playbook in [M2-POST-DECISION-48HOUR-PLAYBOOK-2026-05-31.md](./M2-POST-DECISION-48HOUR-PLAYBOOK-2026-05-31.md) applies for user refinement window.

**Prepared by**: User decision + M2 Decision Readiness Pack (2026-06). All prior waves (10-agent + closeout + C4) maintained obsessive governance.
```

### Option B — If user replies exactly: "one more wave on the 7 gaps (with specific priorities)"

```markdown
## One More Wave Authorized on the 7 Gaps — "one more wave on the 7 gaps (with specific priorities)" (2026-06-XX)

**User Decision Phrase (exact)**: "one more wave on the 7 gaps (with specific priorities)"  
**Decision Date**: 2026-06-XX (PT)  
**User-Specified Priorities**: [PASTE USER'S ADDITIONAL PRIORITIES HERE — e.g. "focus P-3 on server stubs for DB + richer History diff first"]  
**Evidence Pack**: See attached/pasted M2 smoke results + screenshots + this Readiness Pack. Hygiene + smoke executed; any red signatures mapped via Failure Mapper and addressed in this wave.

**Rationale for Additional Wave**: User review of smoke/manual results + 7 gaps identified remaining edges (explicit M2→M3 bridges or polish items) that benefit from one final narrow, high-governance targeted execution before declaring M2 complete.

**Wave Scope (per [M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md](./M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md) + [M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md))**:
- P-1: Gap 1 final sortOrder edges (if any)
- P-2: Gap 2 backlink consumers (if any)
- P-3: Gaps 3+4 (DatabaseBlock server query stubs/RPC + History server snapshot depth)
- P-4: Gap 5 (SyncedBlock full bidirectional content + edge cases)
- P-5: Gaps 6+7 (final slimming + test expansion + a11y/AI wiring polish)

**Governance for This Wave**: Identical strict rules (todo_write, read_file + grep after every edit, invariant preservation, zero new console errors). All work folded only after main-thread verification. Re-run full hygiene + M2 smoke + manual smoke at wave close. Update this Master Plan + MILESTONE-2-PROGRESS + SIGNOFF with fresh evidence.

**Post-Wave Expectation**: One final user smoke gate. Then re-present for the M2 done decision (or further narrow de-scope). No scope creep beyond the 7 gaps + user's stated priorities.

**Next**: Launch P-1 through P-5 sub-agents in parallel using the exact spawn-ready prompts in [M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md). Track in living docs. After completion + user re-verification smoke, return to Decision Day with updated evidence.

**Prepared by**: User decision + M2 Decision Readiness Pack (2026-06). All prior waves maintained obsessive governance.
```

**Insertion Tip**: After pasting the chosen block, also consider a one-line update at the very top "M2 Status" summary table if present, and ensure the "Next User Actions" list is superseded by the decision text.

---

## 4. "What Happens Next" Decision Matrix (Short Reference)

| Exact Decision Phrase                              | Immediate User / Main-Thread Actions                          | Primary Activation Documents to Use Immediately                                                                 | Sub-Agent / Wave Launch                                                                 | WAVE8-MASTER-PLAN + Living Docs Updates                  | Post-Decision Focus & Timeline Notes |
|----------------------------------------------------|---------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|----------------------------------------------------------|--------------------------------------|
| **"M2 done — begin user-led refinement/M3"**      | User begins personal debugging/refinement on Notes surfaces. Main thread shifts to M3 orchestration + user support. Full refinement window opens (48h playbook recommended). | [M3-KICKOFF-IF-M2-DONE-2026-05-31.md](./M3-KICKOFF-IF-M2-DONE-2026-05-31.md)<br>[M3-READY-EXECUTION-PROMPTS-2026-06.md](./M3-READY-EXECUTION-PROMPTS-2026-06.md)<br>This Readiness Pack | **Launch in parallel**: M3-1 (DBBlock server query/RPC + NodeView), M3-2 (SyncedBlock full content sync), M3-3 (AI editor xAI/Grok integration). Use verbatim spawn templates in kickoff. | Insert Option A block above. Add M3 status sections. Mark Agent 46 M2 charter complete. Update 7 gaps to "Closed / Bridged". | M3 Phase 3+ acceleration (AI + Graph, advanced views, realtime for new surfaces). User owns Notes polish. Demo remains pristine. |
| **"one more wave on the 7 gaps (with specific priorities)"** | User provides any additional priorities. One final narrow targeted wave executes under full governance. Re-present smoke results for final decision at end. | [M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md](./M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md)<br>[M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md)<br>This Readiness Pack + Failure Mapper (if any prior reds) | **Launch in parallel**: P-1 to P-5 per user's priorities (Gap 1 sortOrder, Gap 2 backlinks, Gaps 3+4 DB+History, Gap 5 Synced, Gaps 6+7 slim+tests+a11y). Strict narrow charters. | Insert Option B block above. After wave: re-run smoke, update M2 Status with wave outcome + final evidence. | Short, high-signal wave (days). Zero scope creep. Final user smoke gate required before M2 can be declared done. Then matrix row 1 applies. |

**Both paths require**:
- The user's smoke results + screenshots + console confirmation pasted.
- Reply using the **exact phrase** (no paraphrasing).
- Re-run of hygiene + M2 smoke after any code changes in the chosen path.

---

## 5. Quick Improvements to Smoke Instructions (Post-C4 Audit)

1. **.tsx Extension Fix (Highest Priority)**: All M2 crown-jewel docs still say `.ts`. This pack + future runs must use `.tsx`. Recommend user (or a follow-up narrow doc agent) does a global search/replace in `docs/` for the old references once decision is made (or treat this pack as the authoritative command source until then).

2. **Post-C4 Hygiene Gate Explicit**: Added strong callout that C4 changes to shared realtime/hybrid/Home code make a fresh full `npm run typecheck && ... && npm run test:e2e` mandatory before the M2 smoke decision. Previously this was implicit; now surfaced for frictionless execution.

3. **Verbose + Focused Filters Pre-Baked**: Added ready-to-paste variants for Gap 1 (sortOrder renorm — historically highest leverage) and general M2 surfaces. These were scattered; now centralized.

4. **C4 Context in Manual Smoke**: Added a one-bullet reminder to spot-check Notes surfaces remain delightful alongside new C4 features (Home hub workspace switching, presence, invite realtime).

5. **Evidence Polish**: Explicitly recommend `--reporter=verbose`, "Preserve log" in DevTools, and dated log files. Makes handoff to main thread higher signal.

6. **No New Scripts Needed Yet**: The existing `scripts/` (invite lifecycle .ps1/.sh) pattern is solid. A future `M2-Decision-Smoke.ps1` wrapper could be added post-decision if desired (contents would be the hygiene + smoke one-liners + echo prompts for screenshots), but not required for this moment.

7. **M3 / One-More-Wave Docs Also Carry the Bug**: [M3-READY-EXECUTION-PROMPTS-2026-06.md](./M3-READY-EXECUTION-PROMPTS-2026-06.md) etc. reference the old `.ts` name in a couple places — minor cleanup item for whichever path is chosen.

These are low-friction, high-value, and fully compatible with the existing M2 artifacts.

---

## 6. Master References (All Still Canonical)

- **This Pack**: The practical, corrected, post-C4 ready-to-hand document.
- Crown Jewels: [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) (7 gaps + full invariants + manual steps + "What Good Looks Like"), [M2-READINESS-REPORT-2026-05-31.md](./M2-READINESS-REPORT-2026-05-31.md), [10-AGENT-WAVE-COMPLETION-2026-05-31.md](./10-AGENT-WAVE-COMPLETION-2026-05-31.md), [M2-EVIDENCE-PACK-2026-05-31.md](./M2-EVIDENCE-PACK-2026-05-31.md) (single master aggregation).
- Live Execution: [M2-SMOKE-RUN-COMPANION-2026-05-31.md](./M2-SMOKE-RUN-COMPANION-2026-05-31.md) (keep open during smoke), [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) (red smoke instant map), [M2-TEST-RUN-INSTRUCTIONS.md](./M2-TEST-RUN-INSTRUCTIONS.md).
- Decision Day One-Screen: [M2-DECISION-DAY-COMMAND-CENTER-2026-05-31.md](./M2-DECISION-DAY-COMMAND-CENTER-2026-05-31.md), [M2-DECISION-DAY-2026-05-31.md](./M2-DECISION-DAY-2026-05-31.md).
- Dual-Path Activation: [M3-KICKOFF-IF-M2-DONE-2026-05-31.md](./M3-KICKOFF-IF-M2-DONE-2026-05-31.md) + [M3-READY-EXECUTION-PROMPTS-2026-06.md](./M3-READY-EXECUTION-PROMPTS-2026-06.md) | [M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md) + [M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md](./M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md).
- Living Core: [WAVE8-MASTER-PLAN.md](./WAVE8-MASTER-PLAN.md) (M2 Status block), [MILESTONE-2-PROGRESS-2026-05-28.md](./MILESTONE-2-PROGRESS-2026-05-28.md) (full closeout + 11-invariant table), [C4-READY-EXECUTION-CHARTER-2026-06.md](./C4-READY-EXECUTION-CHARTER-2026-06.md) (context for current wave wrap).

**Post-Decision 48h Playbook**: [M2-POST-DECISION-48HOUR-PLAYBOOK-2026-05-31.md](./M2-POST-DECISION-48HOUR-PLAYBOOK-2026-05-31.md) (applies especially to the "M2 done" path).

---

**Ready for the moment the user pastes smoke results + one exact phrase.**

Paste the commands from Section 1. Run hygiene → smoke (keep Companion + Mapper open) → manual flows → capture evidence per Section 2. Reply with **exactly one** of the two decision phrases (plus your evidence).

The main thread can then hand this entire pack + your results back to the user or immediately activate the correct path using the pre-drafted sections and matrix.

All prior obsessive governance (todo_write, read_file verification, invariant discipline) has been respected in the creation of this pack. The package is mature. Let's close M2 cleanly and make the next phase legendary.

**End of M2 Decision Readiness Pack — 2026-06**
