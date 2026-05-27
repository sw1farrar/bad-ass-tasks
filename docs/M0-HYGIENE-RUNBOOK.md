# M0 Hygiene & Folder Reset Runbook

**Milestone**: M0 — Architecture Hygiene, Baseline Verification & Folder Reset (per WAVE8-MASTER-PLAN.md)  
**Extracted by**: Docs-Finalization-Agent (from M0-Docs-Runbooks-Agent proposal)  
**Source Document**: `docs/M0-DOCS-RUNBOOKS-PROPOSAL.md` (Section 2 — verbatim content)  
**Date**: 2026-05-25 (PT)  
**Status**: Operational runbook for M0 execution (follows proposal exactly)  
**Governance**: All M0 sub-agents and work must reference and execute this runbook. Proposal gate + `todo_write` + exclusive reporting to Supervisor Agent 44 (ID: 019e6070-aa6a-7373-8030-7b778d4d73ff) + 100% protection of demo invariant and hybrid guards required. See also `docs/M0-AGENT-PROPOSAL-TEMPLATE.md` (mandatory guard matrix) and `docs/M0-VERIFICATION-SIGN-OFF-TEMPLATE.md`.

This is the authoritative, copy-paste-ready "M0 Hygiene & Folder Reset Runbook" as defined in the M0 charter and delivered in the source proposal. Content below is **exactly** as proposed (no alterations to procedures, commands, checklists, or text).

---

## 2. M0 Hygiene & Folder Reset Runbook

### 2.1 Prerequisites & High-Level Overview
**Required**:
- Project cloned, `npm install` complete.
- Terminal + editor access.
- Git clean state (recommended for rollback).
- Access to all M0 sub-agent proposals (via Agent 44 monitoring or direct).
- 2+ browser profiles/tabs for any manual collab simulation (even in demo mode for presence stubs).
- Familiarity with hybrid invariant (demo always works perfectly; "w1"/"w2" hard-blocks).

**High-Level M0 Hygiene Flow** (executed per sub-agent wave + continuously):
1. Pre-flight audit (current baseline via `npm run typecheck`, grep guards).
2. Per-proposal / per-change: Run full regression + guard audit.
3. Manual demo smoke (post key changes or pre-gate).
4. Post-execution re-verify + evidence.
5. Gate preparation using sign-off template (Section 4).
6. Rollback if any regression.

**Time Estimates**: Hygiene commands <2 min; full guard audit + smoke: 15-30 min; pre-gate full matrix: 45-60 min.
**Safety**: All steps non-destructive on demo (no live Supabase required or used in M0). Demo mode remains 100% functional and untouched.

**Integration Note**: This runbook supports (and is supported by) parallel M0 agents. Every M0 proposal *must* reference + execute against this runbook.

### 2.2 Exact Hygiene Commands (Daily / Pre-Change / Post-Change / Pre-Gate)

Always run from project root. Use `&&` chain for atomic "all green" check. Capture output for evidence (redirect or copy terminal).

```bash
# === M0 FULL REGRESSION (MANDATORY before/after every authorized change + pre-gate) ===
npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e
```

**Individual / Targeted Commands** (for focused work):
```bash
npm run typecheck          # TypeScript baseline (target: zero errors post-Wave 1 TS agent)
npm run lint               # ESLint (improvements expected; no new errors)
npm run build              # Production build (catches more than typecheck)
npm run test               # Vitest (utils + core logic; demo-tolerant)
npm run test:e2e           # Playwright smoke (demo-tolerant; runs against localhost:3000)
npm run test:watch         # Interactive during development (not for gates)
npm run test:e2e:ui        # Playwright UI mode (for manual exploration)
```

**Pre-Flight Baseline (at start of any M0 session or new sub-agent wave)**:
```bash
git status                 # Ensure clean
npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e
```

**Post-Authorized Change Verification**:
1. Run full chain above.
2. Perform relevant manual smoke items (Section 2.4).
3. Re-run guard audit (Section 2.3).
4. Attach outputs + screenshots to proposal/update.

**CI/Local Parity Note** (for future M0-CI-CD agent): These exact commands will be the demo-only matrix in `.github/workflows/ci.yml`.

**Environment Note**: M0 is demo-only. Never introduce live Supabase keys during M0 hygiene (use separate profiles or commented .env for verification of guards).

### 2.3 Guard Audit Procedure (Core — Embedded in All M0 Work + Continuous Requirement)

**Purpose**: Enforce "Continuous: Hybrid Guard Auditor" (plan line 341). Every M0 proposal *must* include an explicit "Hybrid Guard & Demo Invariant Audit Matrix" (see Section 3 template). This procedure is the repeatable method.

**Automated Guard Discovery (run these greps; capture results)**:
```bash
# Primary guard function locations
grep -r --include="*.ts" --include="*.tsx" "isSupabaseLive\|isSupabaseConfigured" . --exclude-dir=node_modules --exclude-dir=.next

# Demo ID hard-blocks (w1/w2 stripping + guards)
grep -r --include="*.ts" --include="*.tsx" '"w1"\|"w2"\|w1\|w2' . --exclude-dir=node_modules --exclude-dir=.next | grep -E "(workspaceId|if|includes|block|strip|guard|demo)"

# All public hybridStore exports (verify top-of-function guards)
grep -n "export .*function\|export const .* =" lib/data/hybridStore.ts | head -30
```

**Manual Review Checklist (key files; cross-ref to 2026 research + prior audits)**:
- [ ] `lib/data/hybridStore.ts`: Confirm NOTE at lines ~519-521 ("Every public export below has an isSupabaseLive() guard at the VERY TOP... demo IDs ("w1"/"w2") are additionally blocked"). Verify *every* exported function (getTasks ~529, getNotes, createTask, updateTask, delete*, enqueuePendingOperation, processPendingOperations ~300+, loadPendingQueue, subscribeToWorkspaceRealtime, presence funcs, workspace ops ~1783+, invite/notif/comment ~1519+, etc.) starts with `if (!isSupabaseLive()) return ...` + demo ID strip where applicable (e.g. lines 300, 313, 360, 531-533).
- [ ] `lib/supabase/client.ts`: `isSupabaseConfigured` (lines 28-33) exact (URL + anon key check); `isSupabaseLive` alias in hybridStore.
- [ ] `store/useTaskStore.ts`: Delegation to hybrid with guards; realtime setup/teardown; workspace bootstrap/init flows (no bypasses).
- [ ] `middleware.ts`: Session refresh skipped in demo (isSupabaseConfigured guard).
- [ ] `app/page.tsx`, components (AuthModal, SupabaseSetupBanner, TipTapEditor, etc.): Mode detection, no hard-coded live assumptions.
- [ ] Init/auth flows, queue processing, realtime channels: All early returns + "w1"/"w2" blocks.
- [ ] New code in M0 (e.g. folder pilot extractions, harness tests, CI): *Must not* introduce bypasses (explicit audit in each proposal).
- [ ] No direct Supabase client calls bypassing hybridStore in app code.

**Guard Audit Matrix (fill per proposal / pre-gate; example template in Section 3)**:
Use table format. Confirm: Guard present at top? | Demo ID ("w1"/"w2") block/strip? | Risk if missing? | Verified (date/agent)? | Evidence (grep snippet or line #)?

**Evidence Standard**: Attach grep output, file excerpts, "before/after" for any M0 changes touching data layer.

**If Audit Fails**: Halt. Propose fix (via new/updated proposal to Agent 44). Re-audit + full regression before proceeding. Never proceed with weakened guards.

**Continuous Enforcement**: This procedure + matrix required in *all* M0 proposals (TS, Folder, CI, Harness, and this one). Final gate matrix aggregates all.

### 2.4 Manual Demo Smoke Test Checklist (M0 Baseline — Evidence-Based)

Perform after key changes, hygiene passes, or pre-gate. Use fresh dev server + hard refresh (Ctrl/Cmd + Shift + R). Two tabs/profiles for view/presence simulation. Log console (filter to errors/warnings). Capture screenshots or notes for each item.

**Pre-Launch / Environment**:
- [ ] `npm run dev` starts cleanly; no startup errors.
- [ ] App loads at http://localhost:3000 in pure demo (no .env.local or keys commented out). SupabaseSetupBanner visible or dismissible.
- [ ] No console errors related to Supabase/hybrid on load.
- [ ] "DEMO" indicators or graceful fallback visible in UI/status.

**Core Flows (Tasks + Views)**:
- [ ] Command Palette (⌘K or Ctrl+K): Opens instantly, search/filter works, create task via palette or natural language ("Ship report P0 @me tomorrow") succeeds, data appears in list.
- [ ] Tasks List View: Add/edit/complete task (Space key for complete triggers confetti + toast). Persists across hard refresh. Priorities/tags/due/assignees functional.
- [ ] Kanban Board: Drag & drop reorder between columns (optimistic + persist). No layout shift or perf issues.
- [ ] Today View: Smart briefing/focus score/priority surfacing loads and updates with task changes.
- [ ] Switch between views (Today/Tasks/Notes/etc. via sidebar or keys 1/2/3): Smooth, state preserved.

**Notes + Editor**:
- [ ] Notes section / detail: Open TipTapEditor. Type rich content, use slash commands (/task, /note, /link, /heading, /list, /ai etc.), create bidirectional links/mentions. Content roundtrips on refresh (JSONB via hybrid).
- [ ] Link extraction/backlinks: Detected mentions/links appear in panels; remove works.

**Persistence, Offline & Resilience (Critical for Hybrid)**:
- [ ] Create/edit tasks/notes while "offline" (browser DevTools → Network → Offline). Queue builds (pending ops visible if UI exposed or via logger).
- [ ] Reconnect (toggle online): Auto-sync via pending queue + LWW (no loss, no duplicates, timestamps respected). Verify data consistent post-reconnect + refresh.
- [ ] Mid-edit refresh or crash simulation: Data survives (optimistic + localStorage/hybrid).
- [ ] Workspace switcher (demo "w1"/"w2"): Data isolates correctly; no cross-contamination.

**Realtime / Collab Simulation (Demo Mode Stubs)**:
- [ ] Multi-tab: Open two tabs (same demo workspace). Perform create/edit in one → observe optimistic + any presence/cursor stubs in other (no full pub in pure demo, but no errors).
- [ ] Presence / editing badges: Basic indicators if present; no crashes.
- [ ] Conflict UI (if triggered via timing): LWW resolution works gracefully.

**Polish & Non-Regression**:
- [ ] Keyboard-first: Full nav (⌘K, arrows, Enter, Escape, Space complete) works everywhere.
- [ ] Neon aesthetic / motion: 60fps glassmorphism, confetti, toasts (Sonner), Framer Motion smooth. No layout shift.
- [ ] ErrorBoundary / global-error: Test by forcing error (if safe); graceful recovery.
- [ ] Command Palette + search + quick actions: End-to-end delightful.
- [ ] No critical console errors/warnings across all flows (filter known pre-existing TS/lint items if any).
- [ ] Demo data pristine: "w1"/"w2" workspaces fully functional; sample tasks/notes intact and isolated.

**Success Gate for Smoke**: All items pass with zero data loss, zero guard violations, zero demo pollution, full UX delight preserved. Attach evidence (screenshots, console excerpts, store state dumps if helpful) to proposals/gate docs.

**Note**: Current E2E smoke (`tests/e2e/smoke.spec.ts`) is demo-tolerant and can be run as automated complement. Future harness (M0-Verification-Harness-Agent) will expand this.

### 2.5 Rollback Procedures
- **Immediate (pre-commit)**: `git checkout -- <file>` or `git restore .` for specific changes. Re-run full hygiene + guard audit + relevant smoke.
- **Post-commit / Wave**: `git revert <commit>` or reset to known-good (e.g. pre-M0 baseline tag if created). Always re-execute full regression chain + guard audit after rollback.
- **Data Layer Specific**: If any demo leakage suspected (impossible under guards, but): Clear localStorage / IndexedDB for workspace, hard refresh. Verify isolation.
- **Documentation Rollback**: Git on this proposal or future runbook files.
- **Post-Rollback Gate**: Full M0 regression + smoke must green before resuming authorized work.

**Prevention**: Small, proposal-approved increments only. Full re-verify after each.

### 2.6 Integration with Other M0 Sub-Agents & Sequencing
- **Wave 1 (with M0-TS-Error-Hygiene-Agent)**: Use this runbook for pre/post hygiene on TS fixes. Guard audit on any store/hybrid touches (none expected).
- **Wave 2 (M0-Verification-Harness + M0-CI-CD)**: Harness tests must cover guard paths (per their charter). CI workflow executes the exact commands here. This runbook documents "local equivalent".
- **Wave 3 (M0-Folder-Structure-Pilot)**: Pilot extractions (e.g. TipTapEditor → features/notes/editor/) must preserve all import paths, no hybrid changes, run full smoke on editor flows post-pilot. Guard audit on any touched data paths (none).
- **Continuous**: All proposals reference + execute this runbook's commands/audit/smoke. Update this doc (post-approval) with learnings.
- **Pre-Gate**: Aggregate evidence from all waves into Section 4 template.

---

**End of M0 Hygiene & Folder Reset Runbook**

*Content exactly as proposed in M0-DOCS-RUNBOOKS-PROPOSAL.md Section 2. Use this for all M0 work. Always protect the demo invariant and hybrid guards in `lib/data/hybridStore.ts` (NOTE ~519+, every export) and related paths.*

**Cross-References** (from proposal):
- Full M0 charter & sequencing: `docs/WAVE8-MASTER-PLAN.md` (lines 254-366 + STAT-07 M0 wave synthesis/metrics/sign-off record)
- Guard locations & code: `lib/data/hybridStore.ts`, `lib/supabase/client.ts`, `store/useTaskStore.ts`, `middleware.ts`, `app/page.tsx`
- Research: `docs/AGENT-RESEARCH-2026-TESTING-DEPLOYMENT-CICD.md`, `docs/AGENT-RESEARCH-2026-ARCHITECTURE-FOLDER-STRUCTURE.md`, others
- Related proposals: `docs/AGENT-71-RUNBOOKS-PROPOSAL.md` (style), `docs/AGENT-70-TESTING-PROPOSAL.md` (verification), `docs/AGENT-69-DX-HYGIENE-PROPOSAL.md`
- Companion artifacts: `docs/M0-AGENT-PROPOSAL-TEMPLATE.md`, `docs/M0-VERIFICATION-SIGN-OFF-TEMPLATE.md` (and the source proposal for full context)

**Post-CI-Verification Integration (additive, 2026-05-25)**: `.github/workflows/ci.yml` (demo-only) now implements the core hygiene commands from this runbook (typecheck/lint/test/e2e). CI-Verification-Agent completed local validation + runbook alignment. Note: workflow is minimal (no build step); always run the **full atomic chain** (incl. build) locally per Sec 2.2 for gates. CI provides parity for PRs. See WAVE8-MASTER-PLAN.md STAT-07 synthesis + ci.yml for details. Re-run full regression + guard audit post any CI-triggered context.

**Usage**: Run pre-flight, per change, pre-gate. Capture evidence. Report to Agent 44 only.