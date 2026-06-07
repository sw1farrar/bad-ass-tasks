# M2 Decision Execution Quick Reference Card — 2026-06

**Ultra-scannable cheat sheet** (print / tiny window).  
**Canonical root** (exact): `C:\Build\Bad Ass Tasks`  
**Post-C4 baseline**: 22 TS errors (M2 extraction residuals only; **0 new** from C4). Full hygiene **mandatory** pre-smoke. **Critical**: use `.tsx` (legacy docs had `.ts`).

**Latest Polish (this Continue. wave)**: [2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md](./2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md) is the best current one-screen cumulative view of the newest polish layer + [2026-06-DECISION-GATE-LATEST-POLISH-SUMMARY.md](./2026-06-DECISION-GATE-LATEST-POLISH-SUMMARY.md) the latest consolidator. WAVE8-MASTER-PLAN.md ends the canonical section with "**Latest Polish Wave (this Continue.)**" note; high-traffic launch docs carry matching "**Latest Polish (this Continue. wave)**" notes. Pointer to exact section: `## 2026-06 Post-C4 + Zustand Hygiene Fix + Exhaustive Decision Package Ready (This Continue Wave)` in WAVE8-MASTER-PLAN.md. Purely additive.

## Prep
```powershell
cd "C:\Build\Bad Ass Tasks"
git status   # clean or note C4/M2 changes
```

## Best Hygiene + M2 Smoke One-Liners (copy-paste)

**Hygiene quick gate:**
```powershell
npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e
```

**Hygiene best (timestamped logs — preferred for evidence):**
```powershell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"; `
npm run typecheck 2>&1 | Tee-Object -FilePath "typecheck-post-smoke-$timestamp.log"; `
npm run lint 2>&1 | Tee-Object -FilePath "lint-post-smoke-$timestamp.log"; `
npm run build 2>&1 | Tee-Object -FilePath "build-post-smoke-$timestamp.log"; `
npm run test 2>&1 | Tee-Object -FilePath "test-post-smoke-$timestamp.log"; `
npm run test:e2e 2>&1 | Tee-Object -FilePath "e2e-post-smoke-$timestamp.log"; `
Write-Host "Hygiene chain complete. Logs saved with timestamp $timestamp"
```

**M2 Smoke — Primary (recommended, use exactly):**
```powershell
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose
```

**M2 Smoke alt (no cd):**
```powershell
npx vitest run --root "C:\Build\Bad Ass Tasks" "tests/notes-m2-smoke.test.tsx" --no-watch --reporter=verbose
```

**Expected**: ~30–40 cases green.

## Exact Recommended Order of Operations
1. Full hygiene (timestamped) + capture entire output
2. M2 smoke one-liner (verbose; **keep Failure Mapper open**)
3. `npm run dev` → manual verification: M2 crown jewels **+ explicit C4 surfaces** (2+ incognito tabs, hard refresh ×2, DevTools Console clear + Preserve log)
4. Re-run full hygiene post-manual
5. Capture evidence (terminals + screenshots + statements)
6. Reply with **complete evidence pack + exactly one** decision phrase below

## What to Specifically Exercise — New C4 Surfaces (condensed)
- **Home Global Workspace Hub MVP (Phase A)**: Workspace Pulse cards (name+role → instant `switchWorkspace` + "live pulse"); Today's Focus (grouped actionable + workspace pill); Recent Movement (cross-ws feed); AI Summary stub. Hard refresh repopulates; `.env` toggle (demo synthesis vs live member-scoped); confirm **separate global slices** (no per-ws pollution).
- **Invites + Membership Lifecycle + Realtime Symmetry (P0)**: Multi-tab (owner Tab A send invite → recipient Tab B instant banner/bell notification, no refresh; accept → instant switch + owner list update; revoke/decline/self-Leave/remove → instant clear on both sides). Hard refresh **all tabs mid-flow** → zero orphans (RPC + fetch). Exercise last-owner protection + concurrent edits. Live: notifications refetch on changes.
- **Rich Presence + UI Surfaces**: Sidebar (👁N counts + ✎ editing indicators); TeamsView (rich "editing X" badges on pills + full online list with status + pulsing); Home (Pulse cards with live framing); Notes (remote cursors in TipTap — reconfirm). Workspace/view switches update cleanly via `updatePresenceMeta` (no leaks).
- **Cross-Cutting Guards (every surface)**: `.env` Supabase keys off → pure demo (synthesized Home + **zero** invites/presence errors/leaks); **zero *new* console errors**; hard refresh ×2 + offline reconnect mid-flow → perfect persistence (hierarchy, links, DB views, snaps, membership, aggregates, presence).

## Mandatory Evidence Capture Checklist (very short)
**Paste/attach in reply:**
- **Terminals**: Full pre-smoke hygiene + M2 smoke (verbose) + post-manual hygiene (stdout + stderr).
- **Screenshots** (timestamped filenames; 7–8 high-signal):
  1. Sidebar + hierarchy (drag/reparent + backlink badges ← N)
  2. DatabaseBlock Board (drag columns + Edit View open + "Save current view" + named views Load dropdown)
  3. Version History (diff viewer + Restore + confirm dialog)
  4. SyncedBlock / TaskEmbed (inline edit + bidirectional symmetry)
  5. **Home surfaces**: Pulse + Today's Focus + Recent Movement + AI stub
  6. **Presence surfaces**: Teams badges/online list + sidebar 👁/✎
  7. **Invites symmetry**: Multi-tab (owner send + recipient banner + post-accept)
  8. DevTools Console (post hard refresh ×2 on Notes+Home+Teams; filter Errors; show clean or pre-existing only)
- **Explicit statements** (verbatim):
  - "Zero *new* console errors on Notes surfaces + C4 surfaces (Home hub, invites flows, rich presence) post hard refresh ×2 (demo and live if tested)."
  - "Post-manual hygiene re-run completed with [green / only pre-existing baseline noise]."
- Optional high-value: `git status` + short diff; dated Tee logs; Supabase realtime inspector (live).

## The Two Exact Decision Phrases
Reply with **precisely one** (no paraphrasing):
- `"M2 done — begin user-led refinement/M3"`
- `"one more wave on the 7 gaps (with specific priorities)"` (include your additional priorities if selecting this)

**Non-negotiable (both paths)**: Full evidence above + exact phrase. Re-run hygiene + M2 smoke + manual (incl. C4 surfaces) after **any** code changes in chosen path.

## What to Do If Red (one-line)
**STOP immediately**. Open [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md). Map the exact failing `it('title')` (or symptom) to owning Gap (1–7). Do **not** reply with a decision phrase. Address under full governance, then re-run the **entire sequence** (hygiene → smoke → manual C4 → capture).

---

**Keep open while running**: [M2-SMOKE-EXECUTION-COMPANION-POST-C4-2026-06.md](./M2-SMOKE-EXECUTION-COMPANION-POST-C4-2026-06.md) + [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) + [M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md](./M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md)

**Execute in order. Capture everything. Decide with the exact phrase.**  
*Pure synthesis from Post-C4 Command Center, Smoke Companion, Package Index, Readiness Pack & Master Handoff under strict governance. All prior M2 crown jewels remain canonical. Low noise. Frictionless.*

**End of M2 Decision Execution Quick Reference Card — 2026-06**