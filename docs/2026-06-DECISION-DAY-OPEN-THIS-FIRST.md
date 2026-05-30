# 2026-06 DECISION DAY — OPEN THIS FIRST

**🎉 You're at the gate. Everything is ready. One focused smoke + one exact phrase activates the next chapter cleanly.**

## Current State

**For any new agent or user taking over the project at the Decision Gate, the single primary onboarding document is [AGENT-HANDOFF-WAVE8-MASTER-PLAN-AND-CURRENT-STATE-2026-06.md](./AGENT-HANDOFF-WAVE8-MASTER-PLAN-AND-CURRENT-STATE-2026-06.md) — read it first; it consolidates the living master plan, standing governance rules, the exact current state, and the precise next-action protocol.**

You have completed the full 2026-06 C4 wave (realtime invites zero-orphan symmetry across all flows, rich presence indicators live in Teams/sidebar/Home/Notes, Home Global Hub MVP Phase A with real aggregates + instant workspace switch) plus the Zustand `safeLocalStorage` hygiene fix — all with **zero new debt**. 

The **authoritative, living record** of the exhaustive Post-C4 + Zustand Hygiene Fix + Decision Package is the brand-new canonical section in [WAVE8-MASTER-PLAN.md](./WAVE8-MASTER-PLAN.md): "## 2026-06 Post-C4 + Zustand Hygiene Fix + Exhaustive Decision Package Ready (This Continue Wave)". Every companion (Launch Guide, Command Center, Inventory, C4 Completion, Smoke Companion) is refreshed and cross-referenced there. See also [C4-WAVE-COMPLETION-2026-06.md](./C4-WAVE-COMPLETION-2026-06.md) for per-agent evidence.

**Best current one-screen overview of the full recent polish layers:** [2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md](./2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md) — the dedicated cumulative consolidator of every friction-reduction artifact from the recent 2026-06 Continue. waves, explicitly tying them to the canonical WAVE8 section (`## 2026-06 Post-C4 + Zustand Hygiene Fix + Exhaustive Decision Package Ready (This Continue Wave)`) as your single source of truth.

## Hygiene Status: **GREEN**

Full verification: [POST-C4-HYGIENE-VERIFICATION-2026-06.md](./POST-C4-HYGIENE-VERIFICATION-2026-06.md) (and embedded auditor report in C4-WAVE-COMPLETION).

- Exactly **22 pre-existing TS errors** (M2 extraction residuals in `app/page.tsx`, notes surfaces, test fixtures only; **0 delta** from C4 work or Zustand fix).
- Guards **100% clean** on all C4 entry points (`lib/data/hybridStore.ts`, `store/useTaskStore.ts`, `app/page.tsx`, `features/home/HomeView.tsx`, `features/teams/TeamsView.tsx`).
- Zustand fix confirmed (`safeLocalStorage` SSR/Turbopack no-op wrapper at `store/useTaskStore.ts:70-80` + persist hardening).
- Auditor task `019e74de-faf0-7861-8cff-0b3354c955d0` (exit code 0) + root `*-post-C4-20260529-105351.log` files establish the baseline. Full chain (typecheck/lint/build/test/e2e) green on delta. No new console/runtime regressions.

## What You Must Do Now (Exact Sequence — <60s to start)

**Canonical root (quote exactly):** `C:\Build\Bad Ass Tasks`

1. **Full Hygiene (timestamped — run first in PowerShell)**:
   ```powershell
   cd "C:\Build\Bad Ass Tasks"
   $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"; `
   npm run typecheck 2>&1 | Tee-Object -FilePath "typecheck-post-smoke-$timestamp.log"; `
   npm run lint 2>&1 | Tee-Object -FilePath "lint-post-smoke-$timestamp.log"; `
   npm run build 2>&1 | Tee-Object -FilePath "build-post-smoke-$timestamp.log"; `
   npm run test 2>&1 | Tee-Object -FilePath "test-post-smoke-$timestamp.log"; `
   npm run test:e2e 2>&1 | Tee-Object -FilePath "e2e-post-smoke-$timestamp.log"; `
   Write-Host "Hygiene chain complete. Logs saved with timestamp $timestamp"
   ```
   Capture the **entire** output. Expect baseline (22 TS only).

2. **M2 Smoke (exact one-liner from Post-C4 companions — use .tsx)**:
   ```powershell
   Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose
   ```
   (Alt: `npx vitest run --root "C:\Build\Bad Ass Tasks" "tests/notes-m2-smoke.test.tsx" --no-watch --reporter=verbose`). ~30-40 cases expected green. Keep [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) open if needed.

3. **Manual Verification** (`npm run dev` — 2+ incognito tabs preferred, real accounts ideal; hard refresh ×2 with Ctrl+Shift+R on every surface; DevTools Console: clear + "Preserve log" + filter Errors):
   - **M2 Crown Jewels**: Hierarchy drag/reparent (no cycles, stable post-refresh + backlinks), bidirectional symmetry (tasks↔notes via picker/panels/mentions), rich TaskEmbeds (inline edit + unlink), Version History (diff viewer + Restore + confirm), DatabaseBlock Board (drag + "Save current view" + named views dropdown), SyncedBlock (live title sync).
   - **+ Explicit C4 Surfaces** (mandatory):
     - **Home Hub**: Workspace Pulse cards (instant switch + "live pulse" framing), Today's Focus (grouped actionable), Recent Movement (cross-ws feed), AI Summary stub.
     - **Invites realtime symmetry (multi-tab)**: Owner (Tab A) send invite → recipient (Tab B) instant banner/bell → accept/revoke/decline/self-leave → zero orphans on hard refresh all tabs + concurrent flows + last-owner protection.
     - **Rich Presence indicators**: Sidebar 👁/✎ live counts + editing dots, TeamsView rich "editing X" badges + online list, Home Pulse framing, Notes remote cursors (reconfirmed no regression).
   - Confirm **zero *new* console errors** on Notes + C4 surfaces post hard refresh.

4. Re-run full hygiene (Step 1) post-manual. **Capture evidence (non-negotiable minimum)**: full terminal blocks (pre/post hygiene + smoke) + 7-8 timestamped screenshots (one per major surface + clean console) + statements: "Zero *new* console errors on Notes surfaces + C4 surfaces post hard refresh ×2." and "Post-manual hygiene matches baseline (22 TS pre-existing only)."

## The Two Exact Decision Phrases

Reply with your complete evidence pack + **precisely one** of these (verbatim — no changes, no paraphrasing):

**"M2 done — begin user-led refinement/M3"**

**"one more wave on the 7 gaps (with specific priorities)"** (include your additional priorities inside the parentheses)

## What Happens Next (Instant Activation Kits Ready)

- **"M2 done — begin user-led refinement/M3"**: Main thread immediately activates the prepared M3 acceleration path (zero ramp-up) via [M3-PATH-STARTER-PACK-2026-06.md](./M3-PATH-STARTER-PACK-2026-06.md): spawns parallel M3-1 (DatabaseBlock server query/RPC engine) + M3-2 (SyncedBlock full content sync) + optional M3-3 (AI editor integration) under full governance.

- **"one more wave on the 7 gaps (with specific priorities)"**: Main thread immediately activates the narrow supporting 5-agent wave (P-1..P-5) on the remaining prioritized M2 gaps (post-C4 context baked in) via [ONE-MORE-WAVE-STARTER-OUTLINE-2026-06.md](./ONE-MORE-WAVE-STARTER-OUTLINE-2026-06.md) + kickoff docs. Re-runs of hygiene + smoke + C4 surfaces required after the wave.

**All artifacts are ready — pick any polished launch doc (e.g. [M2-DECISION-EXECUTION-MASTER-LAUNCH-GUIDE-2026-06.md](./M2-DECISION-EXECUTION-MASTER-LAUNCH-GUIDE-2026-06.md), [M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md](./M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md), or [ALL-2026-06-ARTIFACTS-INVENTORY-AND-QUICK-START.md](./ALL-2026-06-ARTIFACTS-INVENTORY-AND-QUICK-START.md)) or the new WAVE8 section as your single source of truth.**

**Do the smoke. Capture everything. Choose your phrase. The gate is wide open.**

*2026-06 Decision Day Consolidated Quick-Start Polisher — purely additive, synthesized 100% from on-disk files actually read (WAVE8 new section, hygiene report, companions, launch docs, C4 completion). Governance: todo_write throughout + immediate read+grep verification on this file. No scope creep. Reported exclusively to main thread.*
