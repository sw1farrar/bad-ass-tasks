# M2 Decision Execution Master Checklist — 2026-06

**Ultra-tight "just follow this" one-pager.** Print or keep in tiny window.  
**Canonical root** (quote exactly): `C:\Build\Bad Ass Tasks`  
**Post-C4 baseline**: Exactly 22 TS errors (pre-existing M2 extraction residuals only; **0 new** from C4). Full hygiene **mandatory** before smoke.

**Latest Polish (this Continue. wave)**: [2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md](./2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md) is the best current one-screen cumulative view of the newest polish layer + [2026-06-DECISION-GATE-LATEST-POLISH-SUMMARY.md](./2026-06-DECISION-GATE-LATEST-POLISH-SUMMARY.md) the latest consolidator. WAVE8-MASTER-PLAN.md ends the canonical section with "**Latest Polish Wave (this Continue.)**" note; high-traffic launch docs carry matching "**Latest Polish (this Continue. wave)**" notes. Pointer to exact section: `## 2026-06 Post-C4 + Zustand Hygiene Fix + Exhaustive Decision Package Ready (This Continue Wave)` in WAVE8-MASTER-PLAN.md. Purely additive.

---

## 1. Open Documents in This Exact Order

1. **M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md** — ultimate one-pager: commands, matrix, exact phrases, pre-drafted WAVE8 blocks. **Keep open.**
2. **M2-SMOKE-EXECUTION-COMPANION-POST-C4-2026-06.md** — practical step-by-step runbook. **Keep open during execution.**
3. M2-DECISION-EXECUTION-PACKAGE-INDEX-2026-06.md — launch button + full TOC + links.
4. M2-DECISION-READINESS-PACK-2026-06.md — corrected commands source of truth + complete matrix.
5. C4-WAVE-COMPLETION-2026-06.md — shipped C4 summary + **full Post-C4 Hygiene Baseline Auditor Report**.
6. **During run** (keep open): M2-SIGNOFF-CHECKLIST-2026-05-31.md (11 invariants + crown jewels) + **M2-SMOKE-FAILURE-MAPPER-2026-05-31.md** (red → gap mapping).

**Bonus scannable companion**: M2-DECISION-EXECUTION-QUICK-REFERENCE-CARD-2026-06.md

---

## 2. Best Copy-Paste Commands (Post-C4 .tsx versions)

**Prep (always first):**
```powershell
cd "C:\Build\Bad Ass Tasks"
git status   # clean or note uncommitted C4/M2 changes
```

**Full Hygiene Regression (MANDATORY before smoke + after manual):**
```powershell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"; `
npm run typecheck 2>&1 | Tee-Object -FilePath "typecheck-post-smoke-$timestamp.log"; `
npm run lint 2>&1 | Tee-Object -FilePath "lint-post-smoke-$timestamp.log"; `
npm run build 2>&1 | Tee-Object -FilePath "build-post-smoke-$timestamp.log"; `
npm run test 2>&1 | Tee-Object -FilePath "test-post-smoke-$timestamp.log"; `
npm run test:e2e 2>&1 | Tee-Object -FilePath "e2e-post-smoke-$timestamp.log"; `
Write-Host "Hygiene chain complete. Logs saved with timestamp $timestamp"
```
*(Quick gate alt: `npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e`)*  
**Reference**: `*-post-C4-20260529-105351.log` (22 TS only; 0 delta).

**M2 Smoke Suite (CRITICAL: use .tsx exactly):**
```powershell
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose
```
**No-cd alt:** `npx vitest run --root "C:\Build\Bad Ass Tasks" "tests/notes-m2-smoke.test.tsx" --no-watch --reporter=verbose`

**High-signal variants** (add `-t "..."`):  
`-t "sortOrder|renormaliz|Gap Closers|Hierarchy drag|..."` (Gap 1 focus)  
`-t "M2|Gap Closers|sortOrder|DatabaseBlock|SyncedBlock|backlink|kanban|history|synced"`

**Expected**: ~30–40 high-signal cases green.

**Manual (after `npm run dev`)**: 2+ incognito tabs, hard refresh ×2 (Ctrl+Shift+R), DevTools Console (clear + "Preserve log"). Exercise all M2 crown jewels + explicit C4 surfaces (Home Hub, Invites symmetry, Rich Presence). Re-run full hygiene post-manual.

---

## 3. The Two Exact Decision Phrases

Reply with **precisely one** (no paraphrasing, no changes):

**"M2 done — begin user-led refinement/M3"**  
**"one more wave on the 7 gaps (with specific priorities)"** (include your additional priorities)

**Non-negotiable (both paths)**: Full evidence pack + exact phrase. Re-run hygiene + M2 smoke + manual (incl. C4 surfaces) after **any** code changes in the chosen path.

---

## 4. What Success Looks Like (one line)
Hygiene matches post-C4 baseline (22 TS pre-existing only), M2 smoke ~30–40 green, full manual verification of M2 crown jewels (hierarchy/drag, bidirectional, TaskEmbeds, History, DatabaseBlock named views, SyncedBlock) + explicit C4 surfaces (Home Hub instant switch + aggregates, invites multi-tab zero-orphan realtime symmetry, rich presence across sidebar/Teams/Home/Notes) passes with **zero *new* console errors** after hard refresh ×2 + multi-tab, all evidence captured cleanly.

---

## 5. What To Do If Red (one line)
**STOP immediately.** Open `M2-SMOKE-FAILURE-MAPPER-2026-05-31.md` right now. Map the exact failing `it('title')` (or symptom) to owning Gap (1–7). **Do not reply with any decision phrase yet.** Address under full governance (`todo_write`, post-edit `read_file` + grep, demo/live/hybrid guards, zero new console errors). Re-run the **entire sequence** (hygiene → smoke → manual C4 → capture) after fixes.

---

## 6. Evidence to Capture (tiny non-negotiable minimum)

**Paste/attach in your reply:**
- **Terminals**: Full pre-smoke hygiene chain (stdout + stderr) + M2 smoke (verbose) + post-manual hygiene re-run.
- **Screenshots** (7–8 high-signal, timestamped filenames):
  1. Sidebar + hierarchy (drag/reparent + backlink badges ← N)
  2. DatabaseBlock Board (drag + Edit View open + "Save current view" + named views dropdown)
  3. Version History (diff viewer + Restore + confirm dialog)
  4. SyncedBlock / TaskEmbed (inline edit + bidirectional symmetry)
  5. **Home Hub**: Pulse cards + Today's Focus + Recent Movement + AI stub
  6. **Presence**: Teams rich badges/online list + sidebar 👁/✎
  7. **Invites symmetry**: Multi-tab (owner send + recipient instant banner + post-accept)
  8. DevTools Console (post hard refresh ×2 on Notes + Home + Teams; filter Errors; clean or pre-existing only)
- **Explicit statements** (verbatim):
  - "Zero *new* console errors on Notes surfaces + C4 surfaces (Home hub, invites flows, rich presence) post hard refresh ×2 (demo and live if tested)."
  - "Post-manual hygiene re-run completed with [green / only pre-existing baseline noise]."

**Optional high-value**: `git status` + short diff; dated Tee logs; Supabase realtime logs (live).

---

**Execute in exact order. Capture everything. Reply with complete evidence + exactly one decision phrase only.**

*Pure synthesis from Package Index, Command Center (Post-C4), Smoke Companion (Post-C4), Quick Reference Card, Signoff Checklist, Failure Mapper, C4-WAVE-COMPLETION auditor report, and Readiness Pack under strict governance. All prior M2 crown jewels remain canonical. Frictionless. One screen. Ready to decide.*

**End of M2 Decision Execution Master Checklist — 2026-06**