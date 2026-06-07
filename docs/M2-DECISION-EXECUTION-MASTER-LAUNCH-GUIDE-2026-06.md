# M2 Decision Execution Master Launch Guide 2026-06

**The ultimate one-pager. Open this. Follow 1-8 exactly. Decide.**

**Canonical root** (quote exactly): `C:\Build\Bad Ass Tasks`  
**Post-C4 baseline**: Exactly 22 TS errors (pre-existing M2 extraction residuals only; **0 new** from C4). Full hygiene **mandatory** before smoke + after manual. Reference: `*-post-C4-20260529-105351.log` (recent background run complete).

**Post-Continue 2026-06 Update**: C4 surfaces (realtime invites symmetry, rich presence, Home Hub MVP Phase A) are now the confirmed delivered baseline on the active branch. Zustand `safeLocalStorage` wrapper (`store/useTaskStore.ts:70-80`) resolved the prior persist/SSR "storage unavailable" warnings (contributing to console clean state). All hygiene references point to the exact post-C4 auditor logs + full report in [C4-WAVE-COMPLETION-2026-06.md](./C4-WAVE-COMPLETION-2026-06.md) verification section. Windows/PowerShell smoke commands, .tsx filename, and the two verbatim decision phrases remain accurate and activation-ready. Zero ramp-up for phrase-triggered spawn.

**Latest Polish (this Continue. wave)**: Zero-ramp gate entry — open the dedicated [2026-06-DECISION-DAY-OPEN-THIS-FIRST.md](./2026-06-DECISION-DAY-OPEN-THIS-FIRST.md) ("OPEN THIS FIRST" one-pager) first, then the retrospective [2026-06-LATEST-CONTINUE-WAVE-DELIVERED.md](./2026-06-LATEST-CONTINUE-WAVE-DELIVERED.md). Both prominently surface the canonical WAVE8 section "## 2026-06 Post-C4 + Zustand Hygiene Fix + Exhaustive Decision Package Ready (This Continue Wave)" + full Post-C4 hygiene/C4 surfaces/decision package. Purely additive friction reduction.

---

## Exact 8-Step Sequence

**1. Prep**  
Open this document.  
```powershell
cd "C:\Build\Bad Ass Tasks"
git status   # note clean or uncommitted C4/M2 changes
```

**2. Run Full Hygiene (pre-smoke — timestamped)**  
```powershell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"; `
npm run typecheck 2>&1 | Tee-Object -FilePath "typecheck-post-smoke-$timestamp.log"; `
npm run lint 2>&1 | Tee-Object -FilePath "lint-post-smoke-$timestamp.log"; `
npm run build 2>&1 | Tee-Object -FilePath "build-post-smoke-$timestamp.log"; `
npm run test 2>&1 | Tee-Object -FilePath "test-post-smoke-$timestamp.log"; `
npm run test:e2e 2>&1 | Tee-Object -FilePath "e2e-post-smoke-$timestamp.log"; `
Write-Host "Hygiene chain complete. Logs saved with timestamp $timestamp"
```
Capture **entire** terminal output.

**3. Run M2 Smoke** (critical: use `.tsx`)  
```powershell
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose
```
(Alt no-cd: `npx vitest run --root "C:\Build\Bad Ass Tasks" "tests/notes-m2-smoke.test.tsx" --no-watch --reporter=verbose`)  
**Expected**: ~30–40 high-signal cases green.  
**Any red?** STOP immediately. Open `M2-SMOKE-FAILURE-MAPPER-2026-05-31.md`. Map failure. Do **not** decide yet.

**4. Manual Verification (M2 crown jewels + explicit C4 surfaces)**  
```powershell
npm run dev
```
- Use **2+ incognito tabs** (real accounts preferred). Hard refresh ×2 (Ctrl+Shift+R) on every surface. DevTools Console: clear + "Preserve log" + filter Errors.
- **M2 Crown Jewels**: Hierarchy drag/reparent (no cycles, stable post-refresh) + backlink badges; Bidirectional symmetry (tasks↔notes); Rich TaskEmbeds (inline edit + unlink); Version History (diff + Restore + confirm); DatabaseBlock Board (drag + "Save current view" + named views dropdown); SyncedBlock (live title sync).
- **+ C4 Surfaces**: Home Hub (Workspace Pulse cards → instant switch + "live pulse"; Today's Focus; Recent Movement; AI stub); Invites realtime symmetry (multi-tab: owner send → recipient instant banner → accept/revoke/decline/self-leave → zero orphans on hard refresh all tabs); Rich Presence (sidebar 👁/✎ indicators, Teams rich badges + online list, Home pulse framing, Notes cursors).
- Toggle `.env` Supabase keys (off = pure demo, no leaks). **Zero *new* console errors** on Notes + C4 surfaces.

**5. Re-run Full Hygiene (post-manual)**  
Repeat Step 2 exactly (fresh timestamp). Must match post-C4 baseline (22 TS pre-existing only).

**6. Capture Evidence (tiny non-negotiable minimum)**  
- Full terminal blocks: pre-smoke hygiene + M2 smoke (verbose) + post-manual hygiene.
- **7–8 timestamped screenshots**:
  1. Sidebar + hierarchy (drag/reparent + backlinks ← N)
  2. DatabaseBlock Board (drag + Edit View + "Save current view" + named views)
  3. Version History (diff viewer + Restore + confirm)
  4. SyncedBlock/TaskEmbed (inline edit + bidir symmetry)
  5. **Home Hub**: Pulse + Today's Focus + Recent Movement + AI stub
  6. **Presence**: Teams badges/online + sidebar 👁/✎
  7. **Invites symmetry**: Multi-tab (owner send + recipient banner + post-accept)
  8. DevTools Console (post hard refresh ×2 on Notes/Home/Teams; clean or pre-existing only)
- Verbatim statements:
  - "Zero *new* console errors on Notes surfaces + C4 surfaces (Home hub, invites flows, rich presence) post hard refresh ×2 (demo and live if tested)."
  - "Post-manual hygiene re-run completed with [green / only pre-existing baseline noise]."

**7. What Success Looks Like (one line)**  
Hygiene matches post-C4 baseline (22 TS pre-existing only), M2 smoke ~30–40 green, full manual verification of M2 crown jewels + explicit C4 surfaces (Home Hub, invites symmetry, rich presence) passes with **zero new console errors** after hard refresh ×2 + multi-tab, all evidence captured cleanly.

**8. Decide**  
Reply with **complete evidence pack + precisely one** of these exact phrases (no changes, no paraphrasing):  
**"M2 done — begin user-led refinement/M3"**  
**"one more wave on the 7 gaps (with specific priorities)"** (include your additional priorities)

**What to do if red**: STOP. Use Failure Mapper immediately. Address under full governance (`todo_write`, read_file + grep after edits, demo/live/hybrid guards, zero new console errors). Re-run the **entire sequence** (Steps 1–6) after fixes. Only clean green end-to-end allows a decision.

**Non-negotiable (both paths)**: Exact phrase + full evidence. Re-run hygiene + M2 smoke + manual (incl. C4 surfaces) after **any** code changes in the chosen path.

---

**Execute in exact numbered order. Capture everything. Reply cleanly.**

*Post-C4 synthesis from Master Checklist, Package Index, Command Center, Smoke Companion, Quick Reference Card. Frictionless. One screen. Ready to decide.*

**End of M2 Decision Execution Master Launch Guide 2026-06**