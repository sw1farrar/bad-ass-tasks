# M2 Decision Execution Package Index — 2026-06

**The single launch button + table of contents.** One screen / one printed page. Use this to run the final M2 smoke and decide cleanly.

**Status (Post-C4)**: All artifacts mature, commands corrected (`.tsx`), hygiene baseline documented (22 pre-existing TS residuals only; 0 new from C4), pre-drafted WAVE8 blocks + dual-path activation ready. C4 (invites/realtime symmetry + rich presence + Home Hub MVP Phase A) complete under strict governance.

**Canonical root** (quote exactly): `C:\Build\Bad Ass Tasks`

**Latest Polish (this Continue. wave)**: The newest one-pagers [2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md](./2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md) and [2026-06-DECISION-GATE-LATEST-POLISH-SUMMARY.md](./2026-06-DECISION-GATE-LATEST-POLISH-SUMMARY.md) are the latest high-signal consolidators. Recent polish also in WAVE8-MASTER-PLAN.md ("Latest Gate Polish (this Continue. wave)" note), Master Handoff, README, Inventory, Launch Guide, and Command Center (each with "**Latest Polish (this Continue. wave)**" notes). Pointer to exact canonical section: `## 2026-06 Post-C4 + Zustand Hygiene Fix + Exhaustive Decision Package Ready (This Continue Wave)` in WAVE8-MASTER-PLAN.md. Purely additive friction reduction at the gate.

---

## Recommended Order to Open Documents (Run the Smoke)

1. **This Index** (`M2-DECISION-EXECUTION-PACKAGE-INDEX-2026-06.md`) — start here.
2. **M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md** — ultimate one-pager + full matrix + pre-drafted blocks.
3. **M2-SMOKE-EXECUTION-COMPANION-POST-C4-2026-06.md** — practical step-by-step runbook (keep open).
4. **M2-DECISION-READINESS-PACK-2026-06.md** — corrected commands source, evidence standards, matrix, blocks.
5. **C4-WAVE-COMPLETION-2026-06.md** — shipped C4 summary + **full Post-C4 Hygiene Baseline Auditor Report** (task `019e74de-faf0-7861-8cff-0b3354c955d0`).
6. **CURRENT-WAVE-STATUS-2026-06.md** + **C4-WAVE-VALUE-SUMMARY-2026-06.md** — wave synthesis (reference).
7. **During run (keep open)**: `M2-SIGNOFF-CHECKLIST-2026-05-31.md` (invariants + checklist), `M2-SMOKE-FAILURE-MAPPER-2026-05-31.md` (red → gap map instantly), `M2-SMOKE-RUN-COMPANION-2026-05-31.md`.

---

## Copy-Paste Ready Commands (Best Post-C4 Versions)

**Prerequisites**
```powershell
cd "C:\Build\Bad Ass Tasks"
git status   # clean or note uncommitted C4/M2 changes
```

**1. Full Hygiene Regression (MANDATORY before smoke + after manual changes)**
```powershell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"; `
npm run typecheck 2>&1 | Tee-Object -FilePath "typecheck-post-smoke-$timestamp.log"; `
npm run lint 2>&1 | Tee-Object -FilePath "lint-post-smoke-$timestamp.log"; `
npm run build 2>&1 | Tee-Object -FilePath "build-post-smoke-$timestamp.log"; `
npm run test 2>&1 | Tee-Object -FilePath "test-post-smoke-$timestamp.log"; `
npm run test:e2e 2>&1 | Tee-Object -FilePath "e2e-post-smoke-$timestamp.log"; `
Write-Host "Hygiene chain complete. Logs saved with timestamp $timestamp"
```
(Quick gate alternative: `npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e`)

**Reference baseline logs** (repo root): `*-post-C4-20260529-105351.log` (22 TS errors pre-existing M2 only; 0 C4 delta).

**2. M2 Smoke Suite (Critical: use .tsx)**
```powershell
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose
```
**No-cd alt**: `npx vitest run --root "C:\Build\Bad Ass Tasks" "tests/notes-m2-smoke.test.tsx" --no-watch --reporter=verbose`

**High-signal variants** (add `-t "..."`):
- Gap 1 focus: `-t "sortOrder|renormaliz|Gap Closers|Hierarchy drag|load-time|cross-parent|defensive guards|integer guarantees"`
- Broad: `-t "M2|Gap Closers|sortOrder|DatabaseBlock|SyncedBlock|backlink|kanban|history|synced"`

**Via npm**: `npm test -- tests/notes-m2-smoke.test.tsx -- --reporter=verbose`

**Expected**: ~30–40 high-signal cases green.

**3. Manual Verification** (after `npm run dev`; 2+ incognito tabs recommended)
- Hard refresh ×2 (Ctrl+Shift+R). DevTools Console (clear; filter Errors; "Preserve log").
- **M2 Crown Jewels**: Hierarchy+drag (reparent/reorder, no cycles, stable post-refresh, backlinks), Bidirectional linking (symmetry + badges), Rich TaskEmbeds (inline edit + unlink), Version History (snapshots + restore + diff), DatabaseBlock (Board drag + named views MVP), SyncedBlock (bidir title sync).
- **+ Explicit C4 Surfaces**: Home Hub (Pulse cards → instant switch; Today's Focus; Recent Movement; AI stub), Invites (multi-tab send/accept/revoke/decline/self-leave symmetry + zero orphans on hard refresh), Rich Presence (sidebar 👁/✎, Teams pills + online list, Home pulse framing, Notes cursors).
- Guard toggle: Remove .env Supabase keys → pure demo (no leaks). Zero *new* console errors. Hard refresh ×2 everywhere.
- Re-run full hygiene post-manual.

**Capture (non-negotiable)**: Full terminal blocks (hygiene + smoke + post), 7–8 timestamped screenshots (hierarchy, DB Board+views, History diff, Synced/TaskEmbed, Home surfaces, Presence, Invites multi-tab, clean Console), explicit statements ("Zero new console errors on Notes + C4 surfaces post hard refresh ×2.").

**Failure**: Any red → open `M2-SMOKE-FAILURE-MAPPER-2026-05-31.md` immediately. Do not decide yet.

---

## One-Glance: What Each Document Is For

| Document | Purpose | Open When |
|----------|---------|-----------|
| `M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md` | Ultimate one-pager: commands, manual steps (incl. C4), evidence checklist, exact phrases, pre-drafted WAVE8 blocks (Option A/B), full decision matrix | First practical reference; keep open |
| `M2-DECISION-READINESS-PACK-2026-06.md` | Complete companion: corrected commands source of truth, evidence standards, pre-drafted blocks, decision matrix, post-C4 hygiene gate, all references | Commands + matrix + activation handoff |
| `M2-SMOKE-EXECUTION-COMPANION-POST-C4-2026-06.md` | Ultra-practical runbook: exact order of ops, copy-paste commands + variants, condensed manual + C4 surfaces, evidence checklist, failure protocol | During actual smoke execution |
| `C4-WAVE-COMPLETION-2026-06.md` | C4 exec summary + per-Exec evidence + **full Post-C4 Hygiene Baseline Auditor Report** (22 TS only; categorized residuals; C4 integration risks; 0 new debt) + multi-tab verification matrix | Baseline reference + hygiene report |
| `CURRENT-WAVE-STATUS-2026-06.md` | High-signal "continue" wave synthesis + paste-ready next steps + prepared artifacts list | Quick context / paste into WAVE8 |
| `C4-WAVE-VALUE-SUMMARY-2026-06.md` | Retrospective: key wins, before/after, evidence links, current branch state | Value justification + fold planning |
| `M2-SIGNOFF-CHECKLIST-2026-05-31.md` | 7 gaps definitions + 11 invariants + full manual "What Good Looks Like" | During manual verification |
| `M2-SMOKE-FAILURE-MAPPER-2026-05-31.md` + `M2-SMOKE-RUN-COMPANION-2026-05-31.md` | Red mapping + live helper | On any failure or for rich evidence |
| `WAVE8-MASTER-PLAN.md` | Living master: insert chosen pre-drafted block (post-Closeout section) | Post-decision record |
| `M3-KICKOFF-IF-M2-DONE-2026-05-31.md` + `M3-READY-EXECUTION-PROMPTS-2026-06.md` | Spawn-ready parallel M3-1/2/3 (if "M2 done") | Activation for Option A |
| `M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md` + `M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md` | P-1 to P-5 narrow charters + prompts (if "one more wave") | Activation for Option B |
| `M2-POST-DECISION-48HOUR-PLAYBOOK-2026-05-31.md` | User refinement window (especially "M2 done" path) | Post-decision support |
| Root hygiene logs (`*-post-C4-20260529-105351.log`) | Timestamped post-C4 baseline (typecheck/lint/build/test/e2e) | Reference for delta claims |

---

## Direct Links to Every Key Artifact

**Core Post-C4 Decision Package** (docs/):
- `M2-DECISION-EXECUTION-PACKAGE-INDEX-2026-06.md` (this file)
- `M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md`
- `M2-DECISION-READINESS-PACK-2026-06.md`
- `M2-SMOKE-EXECUTION-COMPANION-POST-C4-2026-06.md`
- `C4-WAVE-COMPLETION-2026-06.md`
- `C4-WAVE-VALUE-SUMMARY-2026-06.md`
- `CURRENT-WAVE-STATUS-2026-06.md`
- `C4-READY-EXECUTION-CHARTER-2026-06.md`
- `C4-INVITES-REALTIME-HANDOFF.md`

**M2 Crown Jewels & Activation** (docs/):
- `M2-SIGNOFF-CHECKLIST-2026-05-31.md`, `M2-SMOKE-RUN-COMPANION-2026-05-31.md`, `M2-SMOKE-FAILURE-MAPPER-2026-05-31.md`, `M2-EVIDENCE-PACK-2026-05-31.md`, `10-AGENT-WAVE-COMPLETION-2026-05-31.md`, `M2-READINESS-REPORT-2026-05-31.md`
- `WAVE8-MASTER-PLAN.md`, `MILESTONE-2-PROGRESS-2026-05-28.md`
- `M3-KICKOFF-IF-M2-DONE-2026-05-31.md`, `M3-READY-EXECUTION-PROMPTS-2026-06.md`
- `M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md`, `M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md`
- `M2-POST-DECISION-48HOUR-PLAYBOOK-2026-05-31.md`

**Hygiene & Ops**: Repo root `typecheck-post-C4-20260529-105351.log` etc. (5 files); `M0-HYGIENE-RUNBOOK.md`

All paths require: internal `todo_write`, `read_file` + path-restricted `grep` after edits, 100% demo/live/hybrid guards (`isSupabaseLive()` + w1/w2 at top of every entry), zero new console errors.

---

## The Two Exact Decision Phrases (Reply with Precisely One)

**"M2 done — begin user-led refinement/M3"**  
→ Main thread activates M3 (parallel M3-1 DBBlock server/RPC+NodeView, M3-2 SyncedBlock full content sync, M3-3 AI xAI/Grok editor). Insert Option A block into WAVE8. 48h user refinement playbook applies. Update living docs + fold C4. Re-run hygiene/smoke after any changes.

**"one more wave on the 7 gaps (with specific priorities)"**  
→ (Include your additional priorities.) Launches narrow P-1–P-5 targeted wave under full governance. Re-present smoke evidence for final decision at end. Insert Option B block. No scope creep. Re-run full hygiene + smoke (incl. C4 surfaces) post-wave. Then Option A path.

**Non-negotiable for both**: Paste full evidence (terminals + screenshots + "zero new console errors" statement) + use **exact phrase** (no paraphrasing). Re-run hygiene + M2 smoke + manual (C4 surfaces) after any code changes in chosen path.

---

## Ready to Execute Checklist

- [ ] In `C:\Build\Bad Ass Tasks` (git status noted)
- [ ] Docs opened in recommended order (Index + Command Center + Smoke Companion + Readiness + C4 Completion)
- [ ] Full timestamped hygiene chain run + entire output captured (pre-smoke)
- [ ] M2 smoke one-liner (`notes-m2-smoke.test.tsx` + verbose) run + full output captured
- [ ] Manual verification complete: M2 crown jewels + explicit C4 surfaces (multi-tab, hard refresh ×2, clean console)
- [ ] Post-manual hygiene re-run + captured
- [ ] 7–8+ high-signal screenshots captured (hierarchy, DB Board+named views, History, Synced/TaskEmbed, Home Hub, Presence, Invites symmetry, clean DevTools Console)
- [ ] Explicit statements captured: "Zero *new* console errors on Notes surfaces + C4 surfaces post hard refresh ×2 (demo and live if tested)."
- [ ] (If any red) Failure Mapper used; issues addressed + full sequence re-run
- [ ] Evidence pack complete + **exactly one** decision phrase ready to paste

**Execute in order. Capture everything. Decide with the exact phrase.**

*Pure synthesis from on-disk artifacts (M2 Command Center, Readiness Pack, Smoke Companion, C4 Completion + auditor report, Current Wave Status, Value Summary, crown jewels) under strict governance. Low noise. Frictionless. Immediately actionable. All prior M2 artifacts remain fully valid.*

**End of M2 Decision Execution Package Index — 2026-06**