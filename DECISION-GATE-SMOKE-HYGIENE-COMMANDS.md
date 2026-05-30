# Decision Gate Smoke & Hygiene Commands

**Canonical project root (quote exactly):** `C:\Build\Bad Ass Tasks`

**Post-C4 + Zustand Hygiene Baseline:** Exactly 22 TypeScript errors (pre-existing M2 extraction and test harness residuals only, located in `app/page.tsx`, notes surfaces, and test fixtures). **Zero new errors or regressions** introduced by C4 (realtime invites zero-orphan symmetry, rich presence indicators, Home Global Workspace Hub MVP Phase A) or the Zustand `safeLocalStorage` SSR/Turbopack hardening. Verified by background auditor task `019e74de-faf0-7861-8cff-0b3354c955d0` (exit code 0) plus root timestamped logs `*-post-C4-20260529-105351.log`.

**Purpose of this artifact:** Single, clean, user-facing reference for the mandatory hygiene + M2 smoke sequence that must be executed at the Decision Gate. Run the full hygiene block **before** smoke/manual and **again after** manual verification. All companion docs (OPEN-THIS-FIRST, Quick Reference Card, Smoke Companion, Launch Guide, etc.) either embed or point to this block. Capture every terminal for evidence.

## 1. Prep (run first, every time)

```powershell
cd "C:\Build\Bad Ass Tasks"
git status   # Capture output for evidence pack (clean or note any uncommitted C4/M2 changes)
```

## 2. Full Hygiene Regression (timestamped logs — strongly preferred for evidence)

This is the complete, reproducible chain. Each command captures combined stdout + stderr to a uniquely timestamped file in the project root for easy diffing and archiving.

```powershell
# Create filesystem-safe timestamp (YYYYMMDD-HHMMSS) for log correlation across pre/post runs
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

# TypeScript check — must match the known baseline of exactly 22 errors (M2 extraction debt only)
npm run typecheck 2>&1 | Tee-Object -FilePath "typecheck-post-smoke-$timestamp.log"

# Lint — baseline warnings only; no new issues allowed
npm run lint 2>&1 | Tee-Object -FilePath "lint-post-smoke-$timestamp.log"

# Production build — must complete successfully (any pre-existing issues are already documented in baseline logs)
npm run build 2>&1 | Tee-Object -FilePath "build-post-smoke-$timestamp.log"

# Unit test suite (Vitest) — pre-existing noise in some suites is acceptable; the focused M2 smoke below is the real gate
npm run test 2>&1 | Tee-Object -FilePath "test-post-smoke-$timestamp.log"

# End-to-end suite (Playwright) — must be green on the delta from baseline
npm run test:e2e 2>&1 | Tee-Object -FilePath "e2e-post-smoke-$timestamp.log"

# Success marker — note the timestamp for your evidence pack
Write-Host "Hygiene chain complete. Logs saved with timestamp $timestamp" -ForegroundColor Green
Write-Host "Review the five new *.log files. Proceed to M2 smoke only if no *new* failures beyond the documented 22 TS baseline." -ForegroundColor Cyan
```

**Fast alternative (no logs, for quick local gate only — never use for final evidence):**

```powershell
npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e
```

## 3. M2 Smoke (primary focused regression for Notes crown jewels)

**Critical:** Use the `.tsx` filename exactly (legacy references to `.ts` are incorrect post-C4 corrections).

Primary (recommended):

```powershell
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose
```

No-cd alternative:

```powershell
npx vitest run --root "C:\Build\Bad Ass Tasks" "tests/notes-m2-smoke.test.tsx" --no-watch --reporter=verbose
```

**Expected:** ~30–40 high-signal test cases pass.

**If any failure appears:** STOP immediately. Do not run manual or reply with a decision phrase. Open `docs/M2-SMOKE-FAILURE-MAPPER-2026-05-31.md`, map the exact failing `it('title')` (or symptom) to its owning Gap (1–7), address under full governance, then re-execute the entire pre-smoke hygiene → smoke → manual sequence.

**High-signal filter variants** (append `-t "..."` to either smoke command):

- `-t "sortOrder|renormaliz|Gap Closers|Hierarchy drag"` (Gap 1 focus)
- `-t "M2|Gap Closers|sortOrder|DatabaseBlock|SyncedBlock|backlink|kanban|history|synced"` (broad M2 coverage)

Full variant table and C4-surface integration notes live in `docs/M2-SMOKE-EXECUTION-COMPANION-POST-C4-2026-06.md`.

## 4. Manual Verification (after `npm run dev`)

1. Start the dev server: `npm run dev`
2. Use 2+ incognito browser tabs/windows. Real Supabase accounts are ideal for live paths; demo mode (no Supabase keys or `isSupabaseLive()` returning false) must still pass 100% cleanly.
3. On **every surface you visit**, perform hard refresh (Ctrl + Shift + R) at least twice.
4. Open DevTools Console on each relevant tab: Clear console, enable "Preserve log", filter to Errors only.
5. Exercise **every** item below. Confirm zero *new* console errors after the hard refreshes.

**M2 Crown Jewels (Notes surfaces — unchanged by C4):**
- Hierarchy: deep drag reparent, stable sortOrder after refresh and back/forth navigation, no cycles, backlink count badges update live.
- Bidirectional symmetry: task ↔ note linking via picker, LinkedTasksPanel, mentions; auto-sync in both directions.
- Rich TaskEmbeds: inline editing of title/due/priority/status, unlink, correct deleted-state handling.
- Version History: snapshot creation, diff viewer, Restore action with confirmation, title autosnap on edit.
- DatabaseBlock Board view: intra- and inter-column drag, "Save current view", named views dropdown (load/apply/persist in both demo and live Supabase).
- SyncedBlock: live title and content synchronization between source note and all embeds.

**Explicit C4 Surfaces (mandatory post-C4 verification):**
- Home Global Workspace Hub MVP Phase A: Workspace Pulse cards (show name + role, instant `switchWorkspace` on click, "live pulse" framing), Today's Focus (actionable grouped tasks + workspace pill), Recent Movement (cross-workspace activity feed), AI Summary stub. Test instant workspace switch and `.env` toggle between demo synthesis and live member-scoped data. Confirm separate global slices (no per-workspace pollution).
- Invites + Membership realtime symmetry (multi-tab critical path): Owner (Tab A) sends invite → recipient (Tab B) sees instant banner + bell notification with no refresh. Accept → instant workspace switch + owner-side list update. Revoke / decline / self-leave / remove → instant clear on both sides. Hard-refresh **all tabs mid-flow** → zero orphans anywhere (RPC + fetch paths). Exercise last-owner protection and concurrent edit flows. Notifications refetch live.
- Rich Presence indicators: Sidebar (live 👁N viewer counts + ✎ editing dots), TeamsView (rich "editing X" badges on member pills + full online list with status + pulsing), Home Pulse cards (live framing), Notes remote cursors in TipTap editor (reconfirm no regression). Workspace and view switches propagate cleanly via `updatePresenceMeta`. No leaks on offline/reconnect/hard refresh.
- Cross-cutting guards on every surface: `.env` Supabase keys off → pure demo (synthesized Home + zero invites/presence errors or leaks); hard refresh ×2 + offline reconnect mid-flow → perfect persistence of hierarchy, links, DB views, snapshots, membership, aggregates, and presence.

6. Record the clean (or baseline-only) console state.

## 5. Post-Manual Hygiene Re-Run

Repeat the exact timestamped block from Step 2 (new `$timestamp`). Compare the new set of five logs to your pre-smoke set. They must match on delta — only the documented 22 pre-existing TS errors.

## Mandatory Evidence Pack (include with your decision phrase)

Paste or attach everything below:

- **Terminal sessions** (complete, untruncated):
  - Pre-smoke full hygiene (all five stages + completion message)
  - M2 smoke (full verbose output)
  - Post-manual full hygiene
- **Timestamped screenshots** (7–8 minimum, descriptive filenames including date/time):
  1. Sidebar + hierarchy (drag/reparent in flight + live backlink N badges)
  2. DatabaseBlock Board (column drag + Edit View open + "Save current view" + named views Load dropdown)
  3. Version History (diff viewer visible + Restore button + confirm dialog)
  4. TaskEmbed and/or SyncedBlock (inline edit active + bidirectional symmetry visible)
  5. Home surfaces (Pulse cards, Today's Focus, Recent Movement, AI stub)
  6. Presence surfaces (TeamsView badges + online list + sidebar 👁/✎ indicators)
  7. Invites multi-tab symmetry (owner send in Tab A → recipient banner in Tab B → post-accept state)
  8. DevTools Console (post hard refresh ×2 on Notes + Home + Teams tabs; Errors filter only; clean or pre-existing baseline only)
- **Verbatim statements** (copy exactly, fill the bracket):
  - "Zero *new* console errors on Notes surfaces + C4 surfaces (Home hub, invites flows, rich presence) post hard refresh ×2 (demo and live if tested)."
  - "Post-manual hygiene re-run completed with [green / only pre-existing baseline noise (22 TS)]."
- **Optional high-signal additions:** `git status` + short diff summary; the actual `*-post-smoke-*.log` files; Supabase Realtime inspector screenshot during multi-tab invites test.

## Decision Phrases (reply with exactly one after evidence)

- `"M2 done — begin user-led refinement/M3"`
- `"one more wave on the 7 gaps (with specific priorities)"` (include your concrete priorities inside the parentheses)

See the sibling artifact `ACTIVATION-KITS-QUICK-REFERENCE.md` (same directory) for what each phrase activates, the exact agent charters, key files, and post-activation re-run requirements.

## Primary References (open these alongside this file)

- Dedicated gate one-pager with full context: `docs/2026-06-DECISION-DAY-OPEN-THIS-FIRST.md`
- Ultra-scannable cheat-sheet (tiny window friendly): `docs/M2-DECISION-EXECUTION-QUICK-REFERENCE-CARD-2026-06.md`
- Step-by-step practical runbook (C4 surfaces + failure protocol): `docs/M2-SMOKE-EXECUTION-COMPANION-POST-C4-2026-06.md`
- C4 completion + full embedded Post-C4 Hygiene Baseline Auditor Report: `docs/C4-WAVE-COMPLETION-2026-06.md`
- Master inventory + recommended open order: `docs/M2-DECISION-EXECUTION-PACKAGE-INDEX-2026-06.md`
- Living single source of truth (the canonical 2026-06 section): `docs/WAVE8-MASTER-PLAN.md`
- Latest polish layer summary: `docs/2026-06-DECISION-GATE-LATEST-POLISH-SUMMARY.md` + `docs/ALL-2026-06-DECISION-PACKAGE-MASTER-HANDOFF.md`

**Governance (applies to this sequence and all future waves):** Preserve 100% of demo/live/hybrid invariants (`isSupabaseLive()` + w1/w2 guard blocks at the VERY TOP of every hybridStore entry point). Produce zero new console errors, zero new TS errors beyond the documented baseline, and honor the feature-folder monolith extraction. All changes must survive this exact hygiene + smoke + manual sequence before any handoff or fold.

*Clean, final, user-facing artifact. Polished and heavily commented for immediate copy-paste execution at the Decision Gate. Synthesized exclusively from the full set of 2026-06 post-C4 Decision companions under strict additive governance. No scope creep.*
