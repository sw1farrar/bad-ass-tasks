# M0-DOCS-RUNBOOKS-PROPOSAL: M0 Hygiene, Guard Protection Runbooks, Checklists & Verification Sign-Off Template

**Agent**: M0-Docs-Runbooks-Agent  
**Reporting To**: Supervisor Agent 44 (ID: 019e6070-aa6a-7373-8030-7b778d4d73ff) — Architect & Primary Supervisor  
**Wave / Milestone**: M0 (Architecture Hygiene, Baseline Verification & Folder Reset)  
**Date**: 2026-05-25 (PT)  
**Status**: **PROPOSAL ONLY — SUBMITTED FOR SUPERVISOR REVIEW & APPROVAL**  
**Governance Compliance**: Strict adherence to all rules in WAVE8-MASTER-PLAN.md (Iron Rule, proposal gate before *any* search_replace/mkdir/high-impact edits, `todo_write` discipline with one in_progress, report exclusively to Agent 44, protect demo invariant and hybrid guards 100%). Full non-destructive review of relevant sections of the plan + prior runbooks (AGENT-71) + related proposals (AGENT-70, AGENT-69, AGENT-PHASE1-..., research reports) + codebase (hybrid guards, scripts, structure) completed via tools before drafting. **Zero edits performed to any existing files**. This single document is the sole deliverable and contains all M0-specific runbooks, checklists, proposal template, and sign-off/verification template. All content is additive for M0 only; no vision or non-M0 doc changes proposed without explicit future approval.

---

## Executive Summary & Charter Fulfillment

This proposal fulfills the exact charter assigned to the M0-Docs-Runbooks-Agent by Supervisor Agent 44 in the revised 7-Milestone Master Plan (docs/WAVE8-MASTER-PLAN.md, section "2026-05-25 — Agent 44 ... Milestone 0 Launch"):

**Charter (quoted)**: "Formalize M0 baseline documentation, runbooks, and guard protection checklists (extends AGENT-71-RUNBOOKS-PROPOSAL.md).
- Create/append M0-specific sections to existing runbooks or README: 'M0 Hygiene & Folder Reset Runbook' with exact commands (typecheck, lint, build, test, manual demo smoke checklist), guard audit steps, rollback.
- Update WAVE8-MASTER-PLAN.md or add M0 verification sign-off template (checklist for Agent 44 approval: TS clean, folder pilot verified, CI green, harness green, demo pristine, hybrid guards audited).
- Cross-reference all 2026 research reports and key code (hybridStore guards locations).
- No changes to vision or other docs unless additive for M0.
**Governance**: Review all current docs/proposals first. Proposal with exact edit locations + new content. Edits only post-approval via search_replace on existing files. Preserve all prior handoff integrity.
**Success for M0 gate**: Runbooks updated with M0 procedures + sign-off template; Agent 44 can use for milestone verification."

**Scope Covered**:
- Full M0 Hygiene & Folder Reset Runbook (commands, guard audit procedure, manual smoke, rollback, integration points).
- M0 Agent Proposal Template (standardized with mandatory "Hybrid Guard & Demo Invariant Audit Matrix" section per "Continuous: Hybrid Guard Auditor" requirement).
- Clear, printable M0 Verification Sign-Off Template (comprehensive checklist for Agent 44 at the M0 gate).
- Cross-references to 2026 research (architecture/folder, testing/CI/CD, hybrid realtime/offline, etc.), AGENT-71/70/69, core guard code locations.
- Proposed *exact* additive extensions to WAVE8-MASTER-PLAN.md (new M0 Sign-Off Record section) and README.md (hygiene reference) — gated behind your approval; no execution yet.

**Foundation Observed (Post Full Review)**:
- **M0 as Mandatory Gate** (WAVE8-MASTER-PLAN.md lines 254-366): Hygiene + baseline verification + folder reset *before* Milestone 1 (Live Supabase activation now aligned under revised plan). Iron Rule reaffirmed: proposal gate + demo/hybrid invariant + clean regression commands before/after changes + exclusive reporting to Agent 44 + `todo_write`.
- **Prior Runbooks Style (AGENT-71-RUNBOOKS-PROPOSAL.md)**: Polished, copy-paste ready numbered runbooks, master checklists (Pre/Execution/Post), troubleshooting, success criteria aligned to plan, risks, explicit Supervisor approval request. Used as direct model.
- **Verification/Harness Style (AGENT-70-TESTING-PROPOSAL.md)**: Evidence-based, layered (automated + manual), "Demo Invariant" principle (tests never pollute pristine demo), multi-matrix, pass/fail + artifacts. Extends naturally to M0 baseline.
- **Research Alignment**: AGENT-RESEARCH-2026-TESTING-DEPLOYMENT-CICD.md (demo-only CI as M0 quick win, runbooks in future `docs/runbooks/`, Agent 71 model, always-run demo regression, guard coverage); AGENT-RESEARCH-2026-ARCHITECTURE-FOLDER-STRUCTURE.md (M0 pilot extraction validation); others reinforce hygiene, no scope creep.
- **Code Baseline**: Hybrid guards world-class and non-negotiable (primarily `lib/data/hybridStore.ts` — see NOTE at ~lines 519-521 and every public export; `isSupabaseLive` alias to `isSupabaseConfigured` in `lib/supabase/client.ts:28-33`; demo "w1"/"w2" ID strips in queue/ops ~300+, 360+, 529+; similar patterns in store/useTaskStore.ts, middleware.ts, auth/init flows). Package.json scripts exact: typecheck/lint/build/test/test:e2e. README basic (outdated phases noted but left untouched per "additive only").
- **No Existing M0 Runbooks/Sign-Off**: Confirmed via exhaustive grep/list_dir across workspace + docs/. AGENT-71 is activation-focused; this extends it for M0 hygiene/gates.
- **Current Baseline State (from plan + audits)**: ~15-16 TS errors; flat monolith; no CI; minimal tests; hybrid pristine; lint debt. M0 Wave 1 prioritizes this agent + TS-Hygiene for quick clean baseline win.

**Key Deliverable**: This document provides production-ready, copy-paste-usable M0 runbooks + checklists + sign-off template. Once approved by Agent 44, it becomes the authoritative reference for all M0 sub-agents, daily hygiene, guard protection, and the final milestone gate verification. It directly enables Agent 44 to record "M0 verification sign-off in this plan + memory" (per plan line 342) and unlock Milestone 1.

**Iron Rule & Demo Invariant Alignment**: Every element here enforces 100% pristine demo mode, strict hybrid guards, zero leakage of SAMPLE/"w1"/"w2" data, and clean regression before/after. Guard audit is *continuous and embedded* (required matrix in all M0 proposals).

---

## 1. Review of Relevant Plan Sections, Prior Runbooks & Research (Completed per Charter)

**Completed Actions (Internal `todo_write` tracked; tools used: list_dir, grep (multiple patterns/paths), read_file (full + offset/limit on key files), memory_search)**:
- Workspace/docs structure mapped (no pre-existing `docs/runbooks/` or M0-*.md).
- Full M0 section of WAVE8-MASTER-PLAN.md read (lines 254-366 + cross-refs to Iron Rule at top, governance process, sub-agent charters 1-5, sequencing Waves 1-3 + continuous guard auditor, gate criteria, references).
- Full AGENT-71-RUNBOOKS-PROPOSAL.md read (style, structure, checklists, activation runbooks as extension base).
- Targeted reads/greps on AGENT-70-TESTING-PROPOSAL.md (harness principles, checklists, demo invariant), AGENT-69-DX-HYGIENE-PROPOSAL.md (TS baseline), AGENT-PHASE1-SUPABASE-ACTIVATION-PROPOSAL.md (activation context), AGENT-RESEARCH-2026-TESTING-DEPLOYMENT-CICD.md (M0 CI/quick wins, runbooks future, regression mandates), AGENT-RESEARCH-2026-ARCHITECTURE-FOLDER-STRUCTURE.md (pilot context), package.json (exact scripts), lib/data/hybridStore.ts (guard locations ~258+, 519+ NOTE, queue stripping, every export), lib/supabase/client.ts (isSupabaseConfigured), app/page.tsx (key flows for smoke), README.md (current docs state), middleware.ts, store/useTaskStore.ts.
- Broader searches for "M0|guard|audit|checklist|sign-off|verification|runbook|demo invariant|Iron Rule|hybrid guard" across all .md + code.
- Memory recall for context (M0 launch, supervisor model, reseed discipline).

**Key Extracted Requirements for This Proposal** (synthesized, no duplication):
- **M0 Commands**: `npm run typecheck && npm run lint && npm run build && npm test && npm run test:e2e` (demo-tolerant) as invariant before/after *every* authorized M0 change (plan lines 261, 342).
- **Guard Audit (Continuous)**: Explicit matrix in *every* proposal (plan line 341). Audit steps for hybridStore guards + demo ID blocks in *all* public paths (queue, CRUD, realtime, auth, init, etc.). Zero bypasses.
- **Manual Demo Smoke**: Specific flows for editor/tasks/kanban/realtime simulation/offline queue (plan line 342). Evidence-based.
- **Sign-Off Criteria for Agent 44** (plan line 324): TS clean; folder pilot verified; CI green; harness green; demo pristine; hybrid guards audited.
- **Rollback**: Git-based + re-verify regression.
- **Sequencing Support**: Docs-Runbooks in Wave 1 (with TS-Hygiene); supports later waves.
- **Preservation**: All prior handoffs (AGENT-71 etc.) integrity; additive only for M0; no vision changes.
- **Delivery**: Proposal format (this doc) first; exact edit locations for any future master/README changes.

Full details cross-referenced in sections below. This review ensures zero scope creep and perfect alignment.

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

## 3. M0 Agent Proposal Template

**All M0 sub-agents** (TS-Hygiene, Folder-Pilot, CI-CD, Verification-Harness, and this Docs agent) **must** use this standardized proposal format (modeled on AGENT-71 / AGENT-70 / etc.). This ensures consistency and embeds guard auditing.

**Required Header** (copy-paste):
```
# M0-XXX-PROPOSAL: [Descriptive Title]

**Agent**: [M0-XXX-Agent]  
**Reporting To**: Supervisor Agent 44 (ID: 019e6070-aa6a-7373-8030-7b778d4d73ff)  
**Milestone**: M0 (Hygiene, Baseline Verification & Folder Reset)  
**Date**: 2026-05-25 (PT)  
**Status**: **PROPOSAL ONLY — SUBMITTED FOR SUPERVISOR REVIEW**  
**Governance Compliance**: [Statement affirming proposal gate, Iron Rule, demo invariant, todo_write, exclusive report to 44, zero changes until approval.]
```

**Required Sections** (minimum):
1. Executive Summary & Charter Fulfillment (quote relevant charter slice from master plan).
2. Audit / Diagnostic Findings (with tool evidence, current baseline).
3. Detailed Proposal (root causes, exact diffs as code blocks or search_replace instructions, phased plan, risk matrix).
4. **Hybrid Guard & Demo Invariant Audit Matrix** (MANDATORY — see template below. Non-negotiable per plan line 341).
5. Verification & Success Criteria (tied to M0 gate + this runbook's commands/smoke/audit).
6. Risks, Mitigations & Rollback.
7. Proposed Execution Sequencing / Dependencies on other M0 agents.
8. Request for Supervisor Review & Approval (explicit asks; questions).

**Hybrid Guard & Demo Invariant Audit Matrix Template** (include populated version in every proposal; update pre-gate):

| File / Path | Specific Guard / Block Location (line # or func) | Guard Present at Top? (Y/N + evidence) | Demo ID ("w1"/"w2") Strip/Block? (Y/N + evidence) | Risk if Bypassed | Verified By / Date | Notes / Action |
|-------------|--------------------------------------------------|---------------------------------------|---------------------------------------------------|------------------|--------------------|---------------|
| lib/data/hybridStore.ts | getTasks (~529), queue ops (~300+), etc. | Y - `if (!isSupabaseLive()) return []` + NOTE 519 | Y - `.filter(op => !["w1","w2"].includes...)` | RLS error / data mixing | [Agent] [Date] | Pristine per audit |
| lib/supabase/client.ts | isSupabaseConfigured (28-33) | N/A (foundation) | N/A | ... | ... | ... |
| store/useTaskStore.ts | ... | ... | ... | ... | ... | ... |
| [Any new file from proposal] | N/A yet | [To be added post-edit] | ... | ... | ... | Must pass audit pre-merge |
| ... | ... | ... | ... | ... | ... | ... |

**Aggregate Summary**: "All existing paths audited [date]; zero bypasses introduced by this proposal. Full demo regression passed. Demo invariant held."

**Additional Requirements in Proposals**:
- Reference this runbook (Section 2) for commands, smoke, audit procedure.
- Include pre/post regression output snippets.
- For folder pilot / code moves: Confirm no impact to hybridStore imports or guards.
- For harness/CI: Confirm demo-only, guard test coverage.

This template + matrix ensures "every proposal must include explicit guard/demoid audit matrix."

---

## 4. M0 Verification Sign-Off Template (Clear Checklist for Agent 44)

**Copy this entire section for use at gate. Fill with evidence/attachments.**

---

**M0 MILESTONE VERIFICATION SIGN-OFF**

**Milestone**: M0 — Architecture Hygiene, Baseline Verification & Folder Reset (per WAVE8-MASTER-PLAN.md, 2026-05-25 launch section)  
**Date of Verification**: ________________  
**Supervisor**: Agent 44 (ID: 019e6070-aa6a-7373-8030-7b778d4d73ff)  
**Lead Sub-Agent Coordination**: M0-Docs-Runbooks-Agent (this proposal) + peer M0 agents

**Iron Rule Confirmation**: All work followed proposal gates, `todo_write`, exclusive reporting to Agent 44. Demo mode 100% pristine; hybrid guards untouched and audited in every proposal + final matrix. No structural work on M1+ unlocked until this sign-off.

### Automated Gates (Evidence Attached: Full Terminal Logs / Outputs)
- [ ] `npm run typecheck` — Clean (zero errors or only pre-approved baseline). Output: [paste or attach]
- [ ] `npm run lint` — Clean or improved (no new errors). Output: [paste or attach]
- [ ] `npm run build` — Succeeds cleanly.
- [ ] `npm run test` (Vitest) — All green (demo-tolerant).
- [ ] `npm run test:e2e` (Playwright smoke) — All green (demo-tolerant).
- [ ] **Full Atomic Chain** (executed pre- and post- all waves): `npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e` — GREEN. Logs attached.
- [ ] Demo regression documented and pristine (no pollution from any M0 activity).

### M0 Sub-Agent Completions & Proposals (Links + Status)
- [ ] **M0-TS-Error-Hygiene-Agent**: Proposal approved/executed/verified. TS zero errors + clean build. Link: [AGENT-69 update or M0-TS-HYGIENE-PROPOSAL.md]
- [ ] **M0-Folder-Structure-Pilot-Agent**: Proposal approved/executed/verified. Pilot extraction(s) complete (e.g. editor to features/...), imports clean, `app/page.tsx` measurably slimmer, no regressions in editor/hybrid. Link: [proposal]
- [ ] **M0-CI-CD-Bootstrap-Agent**: Proposal approved/executed/verified. `.github/workflows/ci.yml` (demo-only) merged + green run on demo suite. Local equivalent matches Section 2.2 commands. Link: [proposal]
- [ ] **M0-Verification-Harness-Agent**: Proposal approved/executed/verified. Harness skeleton (e.g. hybridStore.test.ts for guards/queue/demo-stripping) + key guard tests passing + full demo regression green. Link: [AGENT-70 extension or M0-VERIFICATION-PROPOSAL.md]
- [ ] **M0-Docs-Runbooks-Agent** (this): Proposal approved. Runbooks (Section 2) + template (this Section 4) delivered + cross-refs. Guard audit procedure operationalized.

### Manual Demo Smoke Test (Section 2.4 Checklist) — All Items Passed
- [ ] Pre-launch / environment (5 items)
- [ ] Core flows — Tasks + Views (5+ items: palette, list, Kanban, Today, switches)
- [ ] Notes + Editor (2+ items: TipTap, slash, linking)
- [ ] Persistence / Offline / Resilience (4+ items: queue, reconnect, LWW, refresh survival)
- [ ] Realtime / Collab sim (2+ items)
- [ ] Polish & Non-Regression (5+ items: keyboard, UX, no errors, pristine demo)
**Evidence**: Screenshots, console logs, video captures, or notes attached for each major item or as summary packet.

### Hybrid Guards & Demo Invariant Audit (Final Aggregate)
- [ ] Full automated greps executed + results attached (isSupabaseLive / "w1"/"w2" across workspace).
- [ ] Manual review of key files complete (hybridStore.ts NOTE + every export; client.ts; store; middleware; page/components; any M0-touched paths).
- [ ] **Final Guard Audit Matrix** (aggregated from all M0 proposals + this runbook) attached and 100% passing (no bypasses, all top-of-function guards + demo ID blocks present and effective).
- [ ] Zero leakage of SAMPLE/demo data into any live paths (N/A in pure M0; invariant held).
- [ ] Demo mode remains 100% pristine and fully functional (explicit test: keys absent or commented → full demo behavior).
- [ ] All M0 changes (if any) passed guard re-audit + regression post-edit.

### Additional M0 Gate Criteria
- [ ] Folder pilot architecture alignment validated (per AGENT-RESEARCH-2026-ARCHITECTURE-FOLDER-STRUCTURE.md + pilot proposal).
- [ ] CI workflow (if present) gates the exact hygiene commands.
- [ ] Harness enforces demo invariant + guard coverage.
- [ ] Full regression matrix (automated + manual demo flows for editor/tasks/kanban/realtime simulation/offline queue) green.
- [ ] No scope creep; all work additive for M0 hygiene/baseline only.
- [ ] Cross-references to 2026 research reports + key code (hybridStore guards) documented in proposals/runbooks.

### Evidence & Regression Log (Summary)
- Pre-M0 baseline date/state: [ ]
- Wave 1 (TS + Docs) completion: [date] + logs
- Wave 2 (Harness + CI) completion: [date] + logs
- Wave 3 (Folder Pilot) completion: [date] + logs
- Final pre-gate regression: [date] + full output
- Guard audit snapshots: [attached]
- Other artifacts: [M0 proposals, screenshots, etc.]

**M0 Verification Decision**:
- [ ] **APPROVED — M0 COMPLETE**. All criteria met. Demo invariant and hybrid guards protected. Baseline verified clean. Folder reset pilot successful. Ready for Milestone 1 (Live Supabase activation prep/execution per aligned prior Agent 45/64-71 work).
- [ ] **CONDITIONAL / PENDING** (notes below)
- [ ] **REJECTED / REQUIRES REMEDIATION** (rationale + next steps)

**Agent 44 Sign-Off**:
Signature / Confirmation: _______________________________________________  
Date: ________________  
Recorded in: WAVE8-MASTER-PLAN.md (M0 Sign-Off Record section) + memory session.  
**Milestone 1 Unlocked**: Yes / No (per Iron Rule)

**Notes / Observations from Agent 44**:
____________________________________________________________________________
____________________________________________________________________________

**End of M0 Sign-Off Template**

---

**Usage**: Agent 44 (or delegated) fills this at gate after all waves + full evidence review. This template (plus the runbook in Section 2) directly satisfies the "M0 verification sign-off template" requirement in the M0-Docs-Runbooks-Agent charter.

---

## 5. Proposed Extensions to Existing Documentation (Exact Locations + Content — Gated)

**Important**: These are *proposed only*. Per governance, **no search_replace or edits to WAVE8-MASTER-PLAN.md, README.md, or any other file will occur until explicit approval from Agent 44 on this proposal**. Upon approval, this agent (or per your direction) will execute the precise changes using search_replace, followed by re-verification per this runbook.

### 5.1 Proposed Update to WAVE8-MASTER-PLAN.md
**Location**: Append at the very end of the file (after current final References section, ~line 366). Add as new top-level section for living history.

**Exact Content to Append** (copy-paste ready upon approval):

```
---

## M0 Verification Sign-Off Record

**Date**: [To be filled on sign-off]  
**Status**: PENDING / COMPLETED (see below)  
**Executed Under**: M0 Launch section (above); Waves 1-3 + continuous Hybrid Guard Auditor per plan.

**M0 Sub-Agents & Key Artifacts**:
- M0-TS-Error-Hygiene-Agent: [link to proposal + verification]
- M0-Folder-Structure-Pilot-Agent: [link]
- M0-CI-CD-Bootstrap-Agent: [link]
- M0-Verification-Harness-Agent: [link to harness + AGENT-70]
- M0-Docs-Runbooks-Agent: docs/M0-DOCS-RUNBOOKS-PROPOSAL.md (authoritative M0 Hygiene & Folder Reset Runbook, guard audit procedure, M0 Agent Proposal Template with mandatory guard matrix, and this sign-off template)

**Verification Executed**:
- Full automated regression chain (typecheck/lint/build/test/e2e) green pre/post all waves (logs in proposals + sign-off packet).
- Manual demo smoke checklist (editor/tasks/kanban/realtime sim/offline queue flows) passed with evidence.
- Hybrid guards 100% audited across all paths (matrix in final proposals + runbook Section 2.3/3); demo invariant held; zero "w1"/"w2" leakage risk.
- All M0 proposals included explicit guard/demoid audit matrix.
- Folder pilot + hygiene + CI + harness baselines verified.

**M0 Verification Sign-Off Template** (completed version attached in docs/M0-DOCS-RUNBOOKS-PROPOSAL.md Section 4).

**Agent 44 Final Confirmation**:
[Space for signature, date, "M0 complete under full governance. Iron Rule satisfied. Milestone 1 (Live Supabase activation prep/execution per prior Agent 45/64-71 work, now aligned to revised 7-milestone plan) unlocked."]

**Update History**: This section added via M0-Docs-Runbooks-Agent proposal (approved [date]).

*This record, together with the runbooks in docs/M0-DOCS-RUNBOOKS-PROPOSAL.md, enables repeatable M0 hygiene and future milestone gates.*
```

**Additional Minor Update (same proposal approval)**: In the existing "References for M0 Agents" section (around line 357-365), add:
- `docs/M0-DOCS-RUNBOOKS-PROPOSAL.md` (M0 runbooks, guard checklists, sign-off template)

### 5.2 Proposed Additive Update to README.md (Non-Governance, Purely Helpful)
**Location**: After the "## 🧪 Useful Commands" table (around line 158), before "## 🙏 Next Steps...", insert a new small subsection. This is *additive hygiene reference only* — does not alter vision, phases, or structure descriptions.

**Exact Content to Insert** (upon approval):

```
## 🧰 M0 Baseline Hygiene (For Contributors & Agents)

For M0 (and ongoing) work under the revised 7-Milestone Master Plan (see docs/WAVE8-MASTER-PLAN.md):

```bash
# Full regression (run before/after any change + pre-gate)
npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e
```

See the authoritative **M0 Hygiene & Folder Reset Runbook + Guard Audit Procedure + Sign-Off Template** in:
`docs/M0-DOCS-RUNBOOKS-PROPOSAL.md` (Sections 2–4).

Always protect the demo invariant and hybrid guards (`isSupabaseLive()` + "w1"/"w2" blocks in `lib/data/hybridStore.ts` etc.).
```

**Rationale**: Provides quick reference for anyone following the plan, without changing existing content.

### 5.3 Cross-Reference / Extension Note for AGENT-71-RUNBOOKS-PROPOSAL.md (Optional, Non-Blocking)
Upon approval, a short note can be appended to AGENT-71 (or left as-is since this proposal already "extends" it per charter). Example: "See also docs/M0-DOCS-RUNBOOKS-PROPOSAL.md for M0 hygiene extensions, guard procedures, and milestone templates."

No action required in this proposal unless you direct.

**All proposed changes are strictly additive for M0 governance/execution support and preserve full integrity of prior handoffs/proposals/research.**

---

## 6. Risks, Mitigations & Notes

**Risks**:
- Overlap/duplication with future `docs/runbooks/` structure (research recommendation) or expanded ADRs: Mitigated by keeping this proposal self-contained and proposing only gated additive updates; future refactoring post-M0 approval.
- Agent sequencing dependencies (e.g. harness/CI providing artifacts for sign-off): Mitigated by Wave 1-3 plan + this runbook's integration guidance + explicit cross-refs in template.
- Pre-existing TS/lint debt or demo smoke gaps surfacing during audits: Mitigated by "known baseline" handling in checklists; focus on "no new errors" + evidence.
- Documentation drift: Mitigated by proposal format, git, and Agent 44 ownership of master plan.
- Scope creep into vision/Phase 1 docs: Explicitly forbidden in charter and this proposal.

**Mitigations**: All content derived from exhaustive review + plan quotes. Guard/demo invariant is first-class and non-negotiable in every procedure/matrix. Small, reviewable increments only. Evidence-based everything.

**Future-Proofing**: 
- Ready for `docs/runbooks/M0-hygiene.md` extraction or `docs/adr/M0-001-...md` post-approval.
- Easily extensible for post-M0 (e.g. live matrix in sign-off once M1 unlocked).
- References 2026 research reports directly for long-term alignment.
- Supports production hardening (Agent 53) and full runbooks library evolution.

**Relation to Prior Work**: Directly extends AGENT-71 (runbooks style + checklists), AGENT-70 (verification/harness/demo invariant), AGENT-69 (hygiene baseline), M0 sub-agent charters in master plan, and all 2026 research. Builds on Wave 7 hybrid hardening (guards in hybridStore).

---

## 7. Request for Supervisor Review & Approval

**M0-Docs-Runbooks-Agent** has completed the assigned charter with exhaustive, tool-driven review of the plan (M0 section + Iron Rule + governance), prior runbooks (AGENT-71 full + AGENT-70/Phase1 context), research reports, and key codebase (hybrid guards at lib/data/hybridStore.ts:519+ NOTE + all exports + client.ts + related; package scripts; app flows for smoke). Internal `todo_write` discipline observed throughout (see current list for status). All activity strictly diagnostic + proposal drafting.

This document (`docs/M0-DOCS-RUNBOOKS-PROPOSAL.md`) is the **sole and complete deliverable**. It operationalizes the M0-Docs-Runbooks-Agent charter by providing:
- The "M0 Hygiene & Folder Reset Runbook" (Section 2) with exact commands, guard audit steps/procedure, manual demo smoke checklist, rollback.
- The M0 Agent Proposal Template with mandatory guard/demoid audit matrix (Section 3).
- The clear M0 verification sign-off/verification template (Section 4).
- Cross-references to all required sources.
- Exact proposed (gated) extensions to WAVE8-MASTER-PLAN.md and README.md (Section 5).

**Explicit Requests for Agent 44**:
1. **Approve this proposal** in full, including the contained runbooks, checklists, proposal template, and sign-off template as the authoritative M0 reference.
2. **Authorize the exact documentation extensions** described in Section 5 (WAVE8-MASTER-PLAN.md append for sign-off record + minor additive README hygiene reference). Upon your explicit "go", this agent will execute via `search_replace` (with full re-verification per runbook Section 2.2/2.3).
3. **Guidance on living document placement**: Confirm whether to keep runbooks embedded here, extract a standalone `docs/M0-HYGIENE-RUNBOOK.md` (or under `docs/runbooks/`), or other preference post-approval.
4. **Sequencing / Coordination**: Any specific handoff timing with the parallel M0-TS-Error-Hygiene-Agent (Wave 1) or monitoring instructions via `get_command_or_subagent_output`?
5. **Refinements**: Any adjustments to checklists, guard matrix template, smoke items, or success criteria before approval?
6. **Next**: Upon approval, ready to support remaining M0 waves and prepare for the M0 gate sign-off using the template herein.

**Questions for Supervisor (if any during review)**:
- Preferred format for attaching large evidence (logs/screenshots) in future gate packets?
- Should the sign-off template be duplicated/excerpted into the master plan update, or referenced only?
- Any additional guard locations or M0-specific manual flows to emphasize?

Thank you for the opportunity to contribute this foundational M0 documentation under your oversight, Agent 44. The rigorous governance model (proposal-first, guard-first, demo-invariant) protects the "most badass notes + tasks app" vision from day one of the revised plan.

**End of Proposal**

---

*This document was generated solely as a proposal following full charter review on 2026-05-25. All technical details, quotes, paths, and procedures accurately reflect the inspected current codebase state, WAVE8-MASTER-PLAN.md (M0 section), AGENT-71/70 style, and 2026 research. No changes executed.*

**M0-Docs-Runbooks-Agent — Reporting exclusively to Supervisor Agent 44 (019e6070-aa6a-7373-8030-7b778d4d73ff)**
