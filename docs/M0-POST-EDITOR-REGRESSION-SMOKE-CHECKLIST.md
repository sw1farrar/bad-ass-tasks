# M0 Post-Editor Migration Regression + Manual Smoke Checklist

**Charter Reference**: M0 parallel support wave — Agent 2 (this deliverable)  
**Purpose**: Ready-to-execute checklist for Supervisor (Agent 44) to run **immediately after** Editor-Migration-Executor-Agent completes Batch 1 (TipTapEditor extraction to `features/notes/editor/TipTapEditor.tsx` + backward-compatible re-export shim at `components/TipTapEditor.tsx`).  
**Basis**: **Exact verbatim** M0-HYGIENE-RUNBOOK.md Sections 2.2 (Hygiene Commands) and 2.4 (Manual Demo Smoke Test Checklist). Augmented with Editor-migration-specific verification points (structure, imports/shim, editor flows from TipTapEditor.handoff.md + M0-Folder-Migration-Plan.md, tests, cross-flows like /task).  
**Governance**: Follows M0 iron rule, `todo_write`, exclusive reporting to Agent 44. 100% protection of demo invariant + hybrid guards. No changes to `lib/data/hybridStore.ts` or guarded paths expected/allowed from Editor migration (editor only performs a read-only `isSupabaseLive()` call for mode label).  
**Date**: 2026-05-25 (PT)  
**Status**: Production-ready for immediate post-migration execution. Self-contained. Copy-paste commands directly.  
**Cross-References**: `docs/M0-HYGIENE-RUNBOOK.md` (2.2/2.3/2.4/2.5), `M0-Folder-Migration-Plan.md` (Batch 1 diffs + verification gate), `components/TipTapEditor.handoff.md`, `docs/M0-VERIFICATION-SIGN-OFF-TEMPLATE.md`, `docs/WAVE8-MASTER-PLAN.md` (STAT-07 / REG-06), `package.json` scripts, `tests/e2e/smoke.spec.ts`, `tests/TipTapEditor.test.tsx`.

---

## Prerequisites & Environment Setup (Run Before Starting Checklist)

- Project root: `C:\Grok Build Projects\bad ass tasks`
- Shell: PowerShell (Windows per current env)
- `npm install` already complete (node_modules present)
- Git: Recommended clean state or post-migration commit ready for inspection (`git status`)
- Pure demo mode (critical): 
  - No `.env.local` with live keys, or rename non-destructively: `Rename-Item .env.local .env.local.bak` (if present)
  - Confirm via load: SupabaseSetupBanner visible/dismissible, "DEMO" indicators present
- Dev server: Will be started fresh for manual smoke (`npm run dev`)
- Browsers: 2+ profiles/tabs (one for primary, one for multi-tab collab sim). Hard refresh = Ctrl + Shift + R (or Cmd+Shift+R)
- DevTools: Open Console (filter to Errors + Warnings). Network tab for offline simulation.
- Evidence tools: Screenshot tool ready. Plan filenames: `01-pre-migration-structure.png`, `10-editor-slash-all.png`, etc. Also capture terminal outputs + this checklist filled.
- Time estimate: 15-40 min (regression ~2-5 min + smoke 15-30 min)
- Safety: All steps non-destructive on demo. Rollback per Section 2.5 of runbook if any failure.

**Pre-Launch Command (one-time)**:
```powershell
# Verify clean demo env + basic health
git status
Get-ChildItem .env* -Force | Select-Object Name, Length
```

---

## Phase 1: Post-Migration Structural Verification (Editor Batch 1 Specific)

These confirm the migration executed cleanly before full regression/smoke. (Additive to runbook 2.2 pre-flight.)

- [ ] **1.1 Verify migration file locations & sizes**
  **Action** (run in PowerShell):
  ```powershell
  Write-Host "=== Editor Migration Structure Check ===" -ForegroundColor Cyan
  "features/notes/editor/TipTapEditor.tsx exists? " + (Test-Path "features/notes/editor/TipTapEditor.tsx")
  if (Test-Path "features/notes/editor/TipTapEditor.tsx") { 
    $len = (Get-Item "features/notes/editor/TipTapEditor.tsx").Length 
    "  Size: $len bytes (expect ~1285+ LOC source)"
  }
  "components/TipTapEditor.tsx (shim) exists? " + (Test-Path "components/TipTapEditor.tsx")
  if (Test-Path "components/TipTapEditor.tsx") {
    Get-Content "components/TipTapEditor.tsx" | Select-Object -First 10
  }
  "No duplicate source? (old monolithic should be gone or shim only)"
  ```
  **Expected**: 
  - `features/notes/editor/TipTapEditor.tsx` present with full original content (~1285 LOC, identical to pre-move).
  - `components/TipTapEditor.tsx` is the small ~8-line backward shim exactly:
    ```ts
    "use client";
    // Backward-compatible re-export during M0 transition...
    export { TipTapEditor, type TipTapEditorProps } from "@/features/notes/editor/TipTapEditor";
    ```
  - Skeleton barrels in `features/notes/editor/{extensions,commands,ai,collab}/index.ts` remain (additive).
  - No other files unexpectedly altered.

  **Evidence Capture**:
  - Screenshot of terminal output (name: `01-post-editor-structure-verification.png`)
  - Copy full output to `M0-post-editor-evidence.txt`

- [ ] **1.2 Confirm import sites still resolve (shim + direct paths)**
  **Action**:
  ```powershell
  Write-Host "=== Import Resolution Check ===" -ForegroundColor Cyan
  Select-String -Path "app\page.tsx" -Pattern "TipTapEditor" -Context 0,1
  Select-String -Path "tests\TipTapEditor.test.tsx" -Pattern "TipTapEditor" -Context 0,1
  # Optional future direct import test (after any shim removal)
  ```
  **Expected**: `app/page.tsx:62` and `tests/TipTapEditor.test.tsx:89` still import from `"@/components/TipTapEditor"` (resolves via shim). No resolution errors anticipated. (If page updated to direct feature path in migration, shim still present for compat.)

  **Evidence**: Terminal output in evidence file + screenshot `02-imports-post-migration.png`

- [ ] **1.3 Editor-specific guard hygiene (no hybrid bypass introduced)**
  **Action**:
  ```powershell
  Write-Host "=== Editor Guard Hygiene (Post-Migration) ===" -ForegroundColor Cyan
  # Confirm editor only has the safe read (isSupabaseLive for mode label)
  grep -r --include="*.ts" --include="*.tsx" "from.*hybridStore\|isSupabaseLive\|isSupabaseConfigured" "features/notes/editor/" --exclude-dir=node_modules | head -10 || echo "No (or expected minimal) hybrid imports in editor — GOOD"
  grep -n "isSupabaseLive" "components/TipTapEditor.tsx" || echo "Shim has none (delegates to feature file)"
  ```
  **Expected**: Only the single read-only usage inside the moved `TipTapEditor.tsx` (for "LIVE"/"DEMO" toast label on snapshot). Zero new guarded writes, workspaceId handling, or bypasses. Editor remains pure UI.

  **Evidence**: Grep output captured.

- [ ] **1.4 Pre-flight baseline (runbook 2.2 exact)**
  ```powershell
  git status
  # Quick sanity (full chain in Phase 2)
  npm run typecheck 2>&1 | Select-Object -Last 5
  ```

**Phase 1 Complete Gate**: All items pass with clean structure + no guard risk. Proceed only if green. Timestamp: ________

---

## Phase 2: Automated Full Regression (Exact Verbatim from Runbook Section 2.2)

**"M0 FULL REGRESSION (MANDATORY before/after every authorized change + pre-gate)"**

Always run from project root. Use `&&` chain for atomic "all green" check. **Capture output for evidence (redirect or copy terminal).**

**Primary Command (PowerShell — recommended capture with timestamp)**:
```powershell
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$log = "M0-post-editor-regression-$ts.log"
Write-Host "=== M0 FULL REGRESSION (POST-EDITOR MIGRATION) — Capturing to $log ===" -ForegroundColor Green
npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e *> $log
Write-Host "Full chain exit code: $LASTEXITCODE" -ForegroundColor $(if ($LASTEXITCODE -eq 0) { "Green" } else { "Red" })
Write-Host "Log saved: $((Get-Item $log).FullName)" -ForegroundColor Cyan
```

**Expected Output / Success Criteria**:
- Exit code 0 for the entire `&&` chain.
- `typecheck`: Zero errors (or only pre-existing/approved baseline post-TS-Final). No *new* module resolution or type errors from editor move/shim.
- `lint`: No *new* errors (warnings may exist pre-M0; volume stable or improved).
- `build`: Succeeds cleanly (`next build` — catches more than typecheck; production output in `.next/`).
- `test` (Vitest): All green or within documented demo-tolerant baseline (e.g. 61/66 or better post-harness; TipTapEditor.test.tsx 4/4 passing via mocks + shim; hybridStore.test.ts 11/11 green). No new drift from editor paths.
- `test:e2e` (Playwright): Smoke passes (home load, ⌘K palette, add/complete task). Demo-tolerant (may have browser install notes if not pre-installed; webServer starts cleanly on :3000). No new failures from editor (e2e does not deeply exercise rich editor yet).
- **Full atomic chain green** = primary gate.

**Targeted / Individual Commands** (use if phase fails for diagnosis; from exact 2.2):
```powershell
npm run typecheck          # TypeScript baseline (target: zero errors post-Wave 1 TS agent)
npm run lint               # ESLint (improvements expected; no new errors)
npm run build              # Production build (catches more than typecheck)
npm run test               # Vitest (utils + core logic; demo-tolerant)
npm run test:e2e           # Playwright smoke (demo-tolerant; runs against localhost:3000)
npm run test:watch         # Interactive during development (not for gates)
npm run test:e2e:ui        # Playwright UI mode (for manual exploration)
```

**Pre-Flight Baseline** (exact from 2.2, re-run here post-migration):
```powershell
git status                 # Ensure clean or expected migration diffs only
npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e
```

**Post-Authorized Change Verification** (exact flow from 2.2, executed here):
1. Run full chain above (this Phase).
2. Perform relevant manual smoke items (Phase 4 — full 2.4 + editor specifics).
3. Re-run guard audit (Phase 3).
4. Attach outputs + screenshots to proposal/update / sign-off template.

**Evidence Capture Points** (Mandatory):
- Full log file: `M0-post-editor-regression-YYYYMMDD-HHmmss.log` (absolute path noted)
- Individual command outputs if split (e.g. `M0-post-editor-typecheck.log`)
- Terminal screenshots: `03-regression-chain-start.png`, `04-regression-chain-end.png`
- Note any diffs vs. prior baselines (e.g. `M0-regression-wave2-baseline-20260525-132650.log` or `M0-TS-final-hygiene.log`)
- Git diff summary (post-migration): `git diff --stat HEAD~1` or equivalent if committed.

**CI/Local Parity Note** (exact): These exact commands will be the demo-only matrix. Always run the **full atomic chain** (incl. build) locally per Sec 2.2 for gates. (See `.github/workflows/ci.yml` if present for parity.)

**Environment Note** (exact): M0 is demo-only. Never introduce live Supabase keys during M0 hygiene.

**Phase 2 Complete Gate**: Full chain GREEN. Log captured. Timestamp: ________   Exit codes: typecheck= lint= build= test= e2e=

---

## Phase 3: Guard Audit (Post-Editor — Incorporates Exact Runbook 2.3 + Editor Tailoring)

**Purpose**: Enforce continuous hybrid guard. Editor migration is lowest-risk (no writes, only one read-only `isSupabaseLive()` for label). Re-audit touched paths.

**Automated Guard Discovery** (exact greps from 2.3; run + capture):
```powershell
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$guardLog = "M0-post-editor-guard-audit-$ts.txt"
Write-Host "=== Guard Audit (POST-EDITOR) — Results to $guardLog ===" -ForegroundColor Yellow

"# Primary guard function locations" | Out-File $guardLog
grep -r --include="*.ts" --include="*.tsx" "isSupabaseLive\|isSupabaseConfigured" . --exclude-dir=node_modules --exclude-dir=.next | Out-File -Append $guardLog

"`n# Demo ID hard-blocks (w1/w2 stripping + guards)" | Out-File -Append $guardLog
grep -r --include="*.ts" --include="*.tsx" '"w1"\|"w2"\|w1\|w2' . --exclude-dir=node_modules --exclude-dir=.next | grep -E "(workspaceId|if|includes|block|strip|guard|demo)" | Out-File -Append $guardLog

"`n# All public hybridStore exports (verify top-of-function guards)" | Out-File -Append $guardLog
grep -n "export .*function\|export const .* =" lib/data/hybridStore.ts | head -30 | Out-File -Append $guardLog

"`n# Editor-specific (post-migration hygiene — expect only safe read)" | Out-File -Append $guardLog
grep -r --include="*.ts" --include="*.tsx" "hybridStore\|isSupabaseLive" "features/notes/editor/" --exclude-dir=node_modules | Out-File -Append $guardLog
grep -n "isSupabaseLive\|isSupabaseConfigured" "components/TipTapEditor.tsx" "features/notes/editor/TipTapEditor.tsx" 2>$null | Out-File -Append $guardLog

Write-Host "Guard audit saved to $guardLog"
```

**Manual Review Checklist** (key files; exact from 2.3, with editor note):
- [ ] `lib/data/hybridStore.ts`: Confirm NOTE at lines ~519-521 ("Every public export below has an isSupabaseLive() guard at the VERY TOP... demo IDs ("w1"/"w2") are additionally blocked"). Verify *every* exported function starts with guard + demo ID strip. **(Editor migration did not touch this file.)**
- [ ] `lib/supabase/client.ts`: `isSupabaseConfigured` (lines 28-33) exact.
- [ ] `store/useTaskStore.ts`: Delegation to hybrid with guards; realtime; workspace bootstrap. **(No changes from editor.)**
- [ ] `middleware.ts`: Session refresh skipped in demo.
- [ ] `app/page.tsx`, components (..., TipTapEditor shim + feature file, etc.): Mode detection, no hard-coded live assumptions. **(Editor usage in renderNotesView confirmed safe; only passes props + wires callbacks through guarded store APIs.)**
- [ ] Init/auth flows, queue processing, realtime channels: All early returns + "w1"/"w2" blocks.
- [ ] **NEW for Editor migration**: `features/notes/editor/` and shim contain **zero** bypassing hybrid calls. Only the documented single `isSupabaseLive()` read for UX label.
- [ ] No direct Supabase client calls bypassing hybridStore in app code.

**Guard Audit Matrix** (fill; use table format from runbook):
Guard present at top? | Demo ID ("w1"/"w2") block/strip? | Risk if missing? | Verified (date/agent)? | Evidence (grep snippet or line #)?
---|---|---|---|---
... (focus on any editor-adjacent paths; all others unchanged)

**Evidence Standard** (exact): Attach grep output, file excerpts, "before/after" for any M0 changes touching data layer. (Here: before/after on editor import paths + the one read site.)

**If Audit Fails**: Halt. Propose fix. Re-audit + full regression before proceeding.

**Phase 3 Complete Gate**: All greps clean, manual review passed, matrix filled 100%. No new risks from editor move. Timestamp: ________

---

## Phase 4: Manual Demo Smoke Test Checklist (Exact Verbatim from Runbook Section 2.4 + Editor-Migration Expansions)

**Perform after key changes, hygiene passes, or pre-gate. Use fresh dev server + hard refresh (Ctrl/Cmd + Shift + R). Two tabs/profiles for view/presence simulation. Log console (filter to errors/warnings). Capture screenshots or notes for each item.**

**Start Dev Server** (run in dedicated terminal / background process; do not kill until smoke complete):
```powershell
npm run dev
# In separate terminal for commands, or use the same for interleaved. Access at http://localhost:3000
```

**Pre-Launch / Environment** (exact items + editor context):
- [ ] `npm run dev` starts cleanly; no startup errors.
  - Evidence: Console screenshot `05-dev-server-clean.png`. No errors on editor import/shim load.
- [ ] App loads at http://localhost:3000 in pure demo (no .env.local or keys commented out). SupabaseSetupBanner visible or dismissible.
  - Evidence: Screenshot `06-app-load-demo.png` (show DEMO badge + banner).
- [ ] No console errors related to Supabase/hybrid on load.
  - Evidence: DevTools console excerpt (clean or only known tolerant items).
- [ ] "DEMO" indicators or graceful fallback visible in UI/status. **(Editor-specific: Open a note → confirm editor footer shows "DEMO" mode label from isSupabaseLive read.)**
  - Evidence: Screenshot `07-demo-indicator-editor.png`

**Core Flows (Tasks + Views)** (exact + palette/editor cross-flows):
- [ ] Command Palette (⌘K or Ctrl+K): Opens instantly, search/filter works, create task via palette or natural language ("Ship report P0 @me tomorrow") succeeds, data appears in list.
  - **Detailed execution**:
    1. Press Ctrl+K (or Cmd+K).
    2. Type "create task" or natural language example.
    3. Execute create action.
    4. Verify new task appears in list / Today / Kanban.
  - **Expected**: Instant glassmorphism cmdk dialog, results filter live, create succeeds (optimistic + persist), no errors.
  - Evidence: Screenshots `08-command-palette-open.png`, `09-command-palette-create-success.png`. Console clean.
- [ ] Tasks List View: Add/edit/complete task (Space key for complete triggers confetti + toast). Persists across hard refresh. Priorities/tags/due/assignees functional.
  - Evidence: Before/after + post-refresh `10-tasks-persist.png`.
- [ ] Kanban Board: Drag & drop reorder between columns (optimistic + persist). No layout shift or perf issues.
  - Evidence: `11-kanban-dnd.png`.
- [ ] Today View: Smart briefing/focus score/priority surfacing loads and updates with task changes.
  - Evidence: `12-today-view.png`.
- [ ] Switch between views (Today/Tasks/Notes/etc. via sidebar or keys 1/2/3): Smooth, state preserved.
  - Evidence: Quick nav screenshot.

**Notes + Editor** (exact + **full post-migration expansions** — critical for this checklist):
- [ ] Notes section / detail: Open TipTapEditor. Type rich content, use slash commands (/task, /note, /link, /heading, /list, /ai etc.), create bidirectional links/mentions. Content roundtrips on refresh (JSONB via hybrid).
  - **Detailed post-Editor execution steps** (verify migration success + full feature parity):
    1. Switch to Notes view (sidebar or key '3' or equivalent).
    2. Create new note ("Untitled Note") or select existing sample.
    3. In the inline TipTapEditor (keyed by note.id):
       - Type rich text (bold via toolbar or **, lists, etc.).
       - Press `/` anywhere: Verify **categorized floating glass menu** appears (Formatting | Lists & Structure | Smart Embeds & Actions | Utilities & AI) with live scored filter (title priority + category bonus). Keyboard nav (↑↓ Enter/Tab Esc) works.
       - Test **all major slash commands** (from handoff + current impl):
         - `/h1` or `/heading` → heading inserted.
         - `/task` → placeholder + **auto-creates real task** (via `onCreateTaskFromSlash` wired to `addTask`) + **bidirectional link** (chip appears in note header panel; task shows link back).
         - `/link` → inserts styled neon **mention-pill** (MentionMark extension: @label with hover effects, data attrs).
         - `/embed` → prompts URL, inserts.
         - `/ai` (or similar) → exercises AI polish/transforms (toasts or content update).
         - `/divider`, `/quote`, `/list`, `/today`, etc. → confirm all categories.
       - Use toolbar: Bold, Italic, Strikethrough (added in polish), lists, headings, etc.
       - **Bidirectional linking panel** (in note detail header, outside pure editor but wired):
         - Click +LINK → add task link → symmetric chips with titles + one-click × remove (updates both sides + toast).
         - See computed backlinks (tasks linking to this note).
         - "→ Task" convert button works.
       - History: Trigger snapshot capture (internal button or flow) → toast with mode label (DEMO) + localStorage persist.
       - Remote cursors / presence badges (if visible in two tabs): Basic stubs render without crash.
    4. Make substantive rich changes.
    5. **Hard refresh** (Ctrl+Shift+R) the tab.
    6. Re-open the same note: Verify **full rich content roundtrips** (all formatting, pills, structure preserved via `prepareInitialContent` + hybrid `jsonToNoteContent`/`noteContentToJson` + JSONB).
    7. Previews in notes grid use extracted plain/rich summary correctly.
  - **Expected (migration success)**: Zero breakage from move + shim. Editor feels identical or better (colocated). All slash, pills (MentionMark), bidirectional sync, JSONB persistence, toolbar, toasts, history, cross-flows (/task → tasks + links) 100% functional in demo. No console errors on mount/update/shim resolution. "DEMO" label visible.
  - Evidence (multiple required):
    - `13-editor-notes-open.png`
    - `14-editor-slash-menu-categorized.png` (show groups + filter)
    - `15-editor-slash-task-create-link.png` (task created + chip in panel)
    - `16-editor-mention-pill.png` (neon @ style)
    - `17-editor-bidirectional-panel-chips.png`
    - `18-editor-rich-after-refresh.png` (prove roundtrip)
    - `19-editor-toolbar-history.png`
    - DevTools console excerpt (zero new errors).
- [ ] Link extraction/backlinks: Detected mentions/links appear in panels; remove works.
  - Evidence: Covered in above bidirectional screenshots + `20-backlinks-flow.png`.

**Persistence, Offline & Resilience (Critical for Hybrid)** (exact + editor note content):
- [ ] Create/edit tasks/notes while "offline" (browser DevTools → Network → Offline). Queue builds (pending ops visible if UI exposed or via logger).
  - **Editor-specific**: Edit rich note content offline → changes should queue (optimistic UI).
- [ ] Reconnect (toggle online): Auto-sync via pending queue + LWW (no loss, no duplicates, timestamps respected). Verify data consistent post-reconnect + refresh.
  - **Editor-specific**: Rich editor content + any /task links survive sync.
- [ ] Mid-edit refresh or crash simulation: Data survives (optimistic + localStorage/hybrid).
  - **Editor-specific**: Hard refresh mid-TipTap edit (with rich content + links) → content preserved.
- [ ] Workspace switcher (demo "w1"/"w2"): Data isolates correctly; no cross-contamination.
  - Evidence for all: Screenshots `21-offline-editor-edit.png`, `22-reconnect-sync.png`, `23-mid-refresh-survival.png`, `24-w1-w2-isolation.png`. Console + any logger output.

**Realtime / Collab Simulation (Demo Mode Stubs)** (exact):
- [ ] Multi-tab: Open two tabs (same demo workspace). Perform create/edit in one → observe optimistic + any presence/cursor stubs in other (no full pub in pure demo, but no errors).
  - **Editor-specific**: Edit note in Tab A (type, slash, cursors) → Tab B shows optimistic updates / badge / cursor overlay stubs in editor.
- [ ] Presence / editing badges: Basic indicators if present; no crashes.
- [ ] Conflict UI (if triggered via timing): LWW resolution works gracefully.
  - Evidence: `25-multitab-collab-editor.png` (two tabs), console clean in both.

**Polish & Non-Regression** (exact + editor):
- [ ] Keyboard-first: Full nav (⌘K, arrows, Enter, Escape, Space complete) works everywhere. **(Editor: Full slash keyboard nav + toolbar shortcuts + content editing keys.)**
- [ ] Neon aesthetic / motion: 60fps glassmorphism, confetti, toasts (Sonner), Framer Motion smooth. No layout shift.
  - **Editor-specific**: Slash menu glass + neon pills + smooth typing/toolbar.
- [ ] ErrorBoundary / global-error: Test by forcing error (if safe); graceful recovery.
- [ ] Command Palette + search + quick actions: End-to-end delightful. (Cross-ref editor /task flow.)
- [ ] No critical console errors/warnings across all flows (filter known pre-existing TS/lint items if any).
  - **Editor-specific post-migration**: Zero shim/import, TipTap mount, slash, onChange (JSON emit), bidirectional, persistence errors.
- [ ] Demo data pristine: "w1"/"w2" workspaces fully functional; sample tasks/notes intact and isolated. **(Editor: Samples exercise rich content, seeded links/pills.)**
  - Evidence: Final full-app screenshots + console summary `26-polish-final-state.png`.

**Success Gate for Smoke** (exact + tailored):
All items pass with zero data loss, zero guard violations, zero demo pollution, full UX delight preserved. **Editor migration specifically validated**: Behavior identical pre/post-move (via shim), imports/tests resolve, colocation achieved without regression, all slash/bidir/JSONB/persistence/keyboard flows delightful and cross-functional (/task etc.). Attach evidence (screenshots, console excerpts, store state dumps if helpful) to proposals/gate docs.

**Note** (exact): Current E2E smoke (`tests/e2e/smoke.spec.ts`) is demo-tolerant and can be run as automated complement (already covered in Phase 2). Future harness will expand (deeper editor coverage possible post-colocation).

**Phase 4 Complete Gate**: Every checkbox passed with evidence. Editor flows (including migration-specific) 100% green. Timestamp: ________

---

## Post-Execution Steps & Sign-Off

1. Re-run full atomic regression chain (Phase 2) one final time if any manual steps touched code.
2. Re-run guard audit (Phase 3) and append to matrix.
3. Fill this checklist completely (add timestamps, notes, "PASS" per item).
4. Collect evidence packet:
   - All `M0-post-editor-*.log` / `.txt` files
   - 15+ named screenshots (01-26+ as referenced)
   - Filled copy of this checklist
   - `git diff --stat` or migration commit hash
   - Console excerpts / DevTools dumps
5. Update `docs/M0-VERIFICATION-SIGN-OFF-TEMPLATE.md` (add this execution under "Next for REG-06 / post-Editor" section + attach evidence).
6. Report **exclusively** to Supervisor Agent 44 with:
   - This document (filled)
   - Evidence zip/folder
   - "Post-Editor Regression + Smoke: [GREEN / BLOCKED with details]"
7. If any failure: Execute rollback per exact runbook 2.5. Re-verify full chain + relevant smoke before retry.

**Rollback Reminder** (verbatim from 2.5):
- **Immediate (pre-commit)**: `git checkout -- <file>` or `git restore .` ... Re-run full hygiene + guard audit + relevant smoke.
- **Post-commit / Wave**: `git revert <commit>` ...
- **Data Layer Specific**: Clear localStorage / IndexedDB for workspace, hard refresh...
- **Post-Rollback Gate**: Full M0 regression + smoke must green before resuming.

**Prevention**: Small, proposal-approved increments only. Full re-verify after each.

---

**End of M0 Post-Editor Migration Regression + Manual Smoke Checklist**

*This document was built exactly to the charter using verbatim Sections 2.2 and 2.4 from `docs/M0-HYGIENE-RUNBOOK.md`, expanded only with migration-specific executable details for immediate supervisor use. Editor migration (Batch 1) verified as zero-risk to demo/hybrid per prior audits in M0-Folder-Migration-Plan.md.*

**Usage**: Run Phases 1-4 sequentially. Mark items live. Capture everything. Deliver to Agent 44.

**Next Integration**: Feed results into STAT-07 / REG-06 synthesis + final M0 gate sign-off. CI parity via full local chain.

**Absolute Path to this file**: `C:\Grok Build Projects\bad ass tasks\docs\M0-POST-EDITOR-REGRESSION-SMOKE-CHECKLIST.md`
