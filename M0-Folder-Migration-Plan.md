# M0 Folder Structure Pilot — Recovery & Migration Plan

**Context**: The dedicated M0-Folder-Structure-Pilot-Agent was correctly blocked by the permission system when it attempted structural file operations (as required by governance). This is expected and good behavior.

**Autonomous Recovery Decision**: Instead of waiting, I (main thread in Autonomous Mode) have taken over safe preparatory work for this workstream to keep M0 momentum.

## Target 2026 Architecture (from Research)

See the detailed recommendation in `docs/AGENT-RESEARCH-2026-ARCHITECTURE-FOLDER-STRUCTURE.md`.

Core idea:
- `app/` becomes thin routing + shells only.
- Real logic moves to `features/<domain>/` (notes, tasks, teams, ai) with colocation.
- `shared/` for cross-cutting concerns (data/hybridStore, ui, state, types, utils).

## Current State (as of this plan)

- Target directory skeleton created safely:
  ```
  features/
    notes/
      editor/
    tasks/
    teams/
    ai/
  shared/
    ui/
    data/
    state/
    types/
    utils/
  ```

- No existing code moved yet (intentionally).

## Recommended Incremental Migration Sequence (Editor First)

1. **Prep Phase (done)**: Create target directories + this plan.
2. **Editor Extraction (lowest risk, highest value)**:
   - Move `components/TipTapEditor.tsx` + its extensions/logic into `features/notes/editor/`.
   - Update imports gradually.
   - Keep backward-compatible re-exports if needed during transition.
3. **Thin the Monolith** (`app/page.tsx`):
   - Extract view components (Today, Tasks list/Kanban, Notes, Calendar, Teams) into their feature folders.
   - Turn `app/page.tsx` into a thin composer + layout shell.
4. **Extract Domain Logic**:
   - Move recurring engine, Kanban helpers, etc. into `features/tasks/lib/`.
   - Move AI orchestration into `features/ai/`.
5. **Shared Layer**:
   - Gradually move stable pieces from `lib/data/hybridStore.ts` (keep as the core) and utils into `shared/`.
6. **Final Cleanup**:
   - Remove old flat `components/`, `store/` (migrate Zustand slices), etc.
   - Update all imports.
   - Full verification gate.

## Guardrails (Non-Negotiable)

- Every batch of changes must be preceded by a formal proposal to the Supervisor (or documented here if Supervisor cycle is complete).
- Run full typecheck + build + demo smoke after every batch.
- Hybrid guards and demo mode must remain 100% untouched.
- Prefer additive + re-export during transition to minimize breakage.

## Next Autonomous Steps (Low-Risk)

- [x] Document exact file-by-file move plan for the TipTapEditor + extensions. (See "Exact Migration Diffs" section below)
- [x] Create the `features/notes/editor/` module with proper barrel exports. (Deeper skeleton + 20+ index.ts barrels across features/ + shared/ completed in safe prep)
- [ ] Submit formal migration proposal (this plan + guard audit) to main thread / Agent 44 for approval before any mv/search_replace on source.
- [ ] Post-approval: Execute editor pilot in smallest batches (move + reexport + import update + verify), then split internals.
- [ ] Subsequent batches: extract from app/page.tsx, lib/utils, etc. (multiple checkpoints).

## Status

- Directory skeleton (top + deep editor/ai/tasks/teams/shared subs): ✅ Created
- Barrel files (index.ts with JSDoc, migration notes, guard warnings): ✅ Created in all target locations (verified clean via `npm run typecheck`)
- Guard audit (hybrid/demo): ✅ Completed (see dedicated section)
- This plan: ✅ Expanded with diffs
- Actual code moves / destructive ops: Not started (per governance; only additive prep + planning executed by Folder-Migration-Recovery-Agent)
- TS baseline: Pre-existing errors remain (2 shown in typecheck post-prep; no new errors introduced). Full hygiene was partial in prior waves.

**Owner**: Folder-Migration-Recovery-Agent (reporting to main thread) under M0 governance.

**Goal**: Have the new structure in place with clean baseline by M0 verification gate.

---

## Guard Audit Summary (Hybrid Guards & Demo Mode — 100% Protected)

**Non-negotiable per Iron Rule + M0 charter**: Zero changes to hybrid/demo invariants in any migration work. All proposals must include explicit matrix.

**Key guard locations audited (via grep + targeted reads, 2026-05-25):**
- `lib/data/hybridStore.ts` (2122 LOC): 
  - `isSupabaseLive = isSupabaseConfigured` (from env in lib/supabase/client.ts)
  - **Every public export** (getTasks, createTask, updateTask, getNotes, createNote, updateNote, delete*, processPendingOperations, subscribeToWorkspaceRealtime, getWorkspace*, activity, notifications, invites, members, templates, recurring, etc. — ~40+ fns) has `if (!isSupabaseLive()) return ...;` **at VERY TOP** (per code comment line 519).
  - Additional explicit demo ID blocks: `["", "w1", "w2"].includes(workspaceId)` in all workspace-scoped paths + queue stripping.
  - Offline queue, LWW, optimistic all respect.
  - **Verdict**: Pristine. **Never edit this file without proposal + full re-audit of every export + call sites.**
- `store/useTaskStore.ts` (2396 LOC): Heavy usage of `isSupabaseLive()`, sample data only in `!isSupabaseLive()`, explicit `["w1","w2"]` filters in add/update/delete/ensureWorkspace/select paths (e.g. lines 574, 688, 698, 730, 739, 775, 881, 945, 1006, 1084, 1087, 1105, 1107, 1145, 1229, 1284, 1343, 1408, 1460+). Sample seeds gated. Init flows guarded. **Verdict**: Strong. No bypasses.
- `app/page.tsx` (3647 LOC): Imports `isSupabaseConfigured`; uses for UI (DEMO badge, conditional), init, PWA, handlers. All paths comment "respects live/demo + role guards". No direct Supabase from page. `isLiveWorkspace` checks include !["w1","w2"]. **Verdict**: Clean usage.
- `middleware.ts`: Skips entirely if !configured (demo mode). Good.
- `components/*` (e.g. SupabaseSetupBanner, CommandPalette, KnowledgeGraph): Use configured for banners/search; no guarded data writes.
- `lib/utils.ts`: AI sims + recurring (pure/demo quality noted); no DB/hybrid bypass.
- `lib/supabase/client.ts`: Pure env check for isSupabaseConfigured. Singleton client.
- Cross-checks (grep for createClient / supabase.from / direct @supabase): All confined to hybridStore internals (with guards) + store init (auth only, guarded) + tests/mocks. No leakage in app/components/features (none yet).

**Risk matrix for any future editor/tasks extraction**:
- Editor (TipTap): Only *reads* `isSupabaseLive()` (for snapshot toast label "LIVE"/"DEMO"). No writes, no workspaceId, no queue, no CRUD. 0 impact.
- Tasks extracts (Kanban etc from page): Will call through hybridStore public APIs (already guarded) or store (guarded). Must preserve all existing ifs.
- Shared/data move (future): Must copy guards verbatim; barrel reexports only.
- **100% protection maintained in this safe prep phase (no code touching guards or hybrid).**

**Continuous**: Every batch proposal MUST re-run full guard grep + manual review of touched call sites + demo smoke (create tasks/notes in !live, verify no w1/w2 pollution in live sim).

---

## Exact Migration Diffs & File-by-File Plan (Editor Pilot — Ready for Formal Proposal)

**Batch 0 (this recovery agent - SAFE PREP ONLY, completed)**:
- Ensured/created full target skeleton (features/notes/{editor/{extensions,commands,ai,collab},components,hooks,api,lib}, features/{ai,tasks,teams}/..., shared/{ui,data,state,types,utils,components,supabase}/...)
- Authored 20+ barrel `index.ts` (with docs, guard warnings, future exports). All additive. Typecheck clean (0 new errors).
- Expanded this plan + guard audit.
- No files moved, no source edited except this plan.md (additive section), no deletes.

**Proposed Batch 1: Editor Extraction (lowest risk, highest value per research + WAVE8 + M0-Folder-Migration-Plan)**

**Rationale**:
- Self-contained (mostly; deps are lucide, tiptap, sonner, @/lib/utils (ai + cn), @/lib/data/hybridStore (1 read-only isSupabaseLive call), React).
- High LOC (1285 lines) removed from flat components/ + future slimming of page (editor is rendered in notes view).
- Colocation win: all slash, Mention bidirectional foundation (refType), AI polish, history, link picker, backlinks panel together.
- Demo/live: 100% identical behavior; no hybrid side effects.
- Page.tsx impact: 1 import site + 1 usage site (in renderNotesView).
- Enables later splits (extensions etc.) inside new home.

**Exact proposed moves (as unified diffs; do NOT apply until approval)**:

```diff
diff --git a/components/TipTapEditor.tsx b/features/notes/editor/TipTapEditor.tsx
similarity index 100%
rename from components/TipTapEditor.tsx
rename to features/notes/editor/TipTapEditor.tsx
--- a/components/TipTapEditor.tsx
+++ b/features/notes/editor/TipTapEditor.tsx
@@ -1,1 +1,1 @@
- (full 1285 LOC file content unchanged at move time)
+ (full 1285 LOC file content — identical after move)
```

(Full content identical on initial move for minimal diff/risk. Refactors to split MentionMark etc. in Batch 1b post-move verification.)

```diff
diff --git a/components/TipTapEditor.tsx b/components/TipTapEditor.tsx
new file mode 100644
--- /dev/null
+++ b/components/TipTapEditor.tsx
@@ -0,0 +1,8 @@
+"use client";
+
+// Backward-compatible re-export during M0 transition (additive, zero breakage).
+// After full verification + import updates across codebase, this shim can be deleted.
+// All consumers (page.tsx + any handoff tests/docs) continue working unchanged.
+
+export { TipTapEditor, type TipTapEditorProps } from "@/features/notes/editor/TipTapEditor";
+
+// (Optional: re-export the MentionMark type if ever externalized)
```

**Import updates (minimal, 1 file)**:

```diff
diff --git a/app/page.tsx b/app/page.tsx
--- a/app/page.tsx
+++ b/app/page.tsx
@@ -60,7 +60,7 @@ import { ... } from ...
-import { TipTapEditor } from "@/components/TipTapEditor";
+import { TipTapEditor } from "@/components/TipTapEditor"; // Still works via shim re-export (or direct: "@/features/notes/editor/TipTapEditor")
```

(Usage at ~line 1618 unchanged. Reexport makes this zero-diff for consumers.)

**Optional immediate enhancement in move (or post in 1b)**: Move MentionMark definition to `features/notes/editor/extensions/mention.ts` and import in editor (clean colocation, no behavior change).

Similar for slashCommandsBase -> commands/slash-registry.ts etc. (can be follow-up small PRs after initial move green).

**Other files touched in Batch 1 (additive only)**:
- Update M0-HYGIENE-RUNBOOK.md, M0-DOCS-RUNBOOKS-PROPOSAL.md, WAVE8-MASTER-PLAN.md references? (minor path notes, post-approval).
- No changes to hybridStore, store, lib/utils (AI stays for now), types, globals.css (mention styles stay or move later).

**Verification gate for Batch 1 (must pass before next)**:
- `npm run typecheck && npm run lint && npm run build`
- Manual demo smoke: Notes view, all /slash commands (incl /task /ai /link), bidirectional pills + panel, history snapshots, AI polish buttons, remote cursor stubs, JSONB roundtrip (create/edit/refresh note in demo + live sim).
- Full existing test suite.
- Guard re-audit grep (no new hybrid calls bypassing).
- Page.tsx LOC delta measured (editor removal ~1285 LOC from monolith surface).
- No regressions in tasks/kanban/AI/palette/dnd/other views.

**Risk**: Extremely low. Editor is UI-only. Reexport + additive ensures rollback trivial (delete new dir, restore old file from git).

**Subsequent batches (high-level, separate proposals)**:
- Batch 2: Extract view shells from app/page.tsx (e.g. renderNotesView, renderTasksKanban etc.) into features/*/components + thin composer in page.
- Batch 3: Recurring + Kanban helpers -> features/tasks/lib/
- Batch 4: AI layer split (utils -> features/ai/ + notes/editor/ai/)
- Batch 5: Zustand slices + types -> shared/state/ + shared/types/
- Batch 6: hybridStore move to shared/data/ (with verbatim guard copy + tests)
- Final: Delete flat components/, old store/ shims, update all imports, full clean.

**Metrics targets for M0 gate**:
- app/page.tsx < 2000 LOC (from 3647)
- features/notes/editor/ owns the rich editor
- All key domains have barrels + colocation
- 0 hybrid guard regressions
- Clean typecheck/build + demo pristine

---

*This recovery completes the safe non-destructive M0 Folder prep per the original pilot intent, architecture research, and M0-Folder-Migration-Plan.md. All work additive, auditable, guard-preserving. Next step requires main thread review + explicit approval for any destructive/structural edit.*

**Report prepared by**: Folder-Migration-Recovery-Agent (subagent role per user delegation). 

*End of expanded plan.*

---

## Post-Plan Addendum: Agent 1 Parallel Support Wave (2026-05-25)
**Charter (narrow)**: Real-time monitor + support for Editor Batch 1 execution (TipTapEditor move + shim).
- Watch for writes begin (target: features/notes/editor/TipTapEditor.tsx + overwrite of components/TipTapEditor.tsx with ~8-line re-export shim).
- Safe parallel prep: Enhanced comments in all 5+ editor/ barrels + notes/ level (migration status, guard reminders, wave tracking). Docs updates in WAVE8-MASTER-PLAN.md.
- Flag issues to supervisor immediately.
- On landing: Immediate guard re-audit (new file locations + shim) using checklist from docs/M0-POST-EDITOR-REGRESSION-SMOKE-CHECKLIST.md (esp. 1.3 guard hygiene + structure).
- Current baseline (latest poll): Migration writes NOT started. Target absent; components/ has full impl (~1285 LOC); imports in app/page.tsx + tests point to components/; barrels (updated) only in editor/. All per plan.
- Guard baseline: Editor touches isSupabaseLive() ONLY for toast mode label (1 read, 0 risk). See grep evidence.
- Strategy: Periodic FS polls (list_dir, read target, terminal Test-Path, grep imports) + reports. Accelerate by having support artifacts ready.

All per Iron Rule, demo/guard protection. This addendum additive only. 

**Agent 1 status tracking**: See todo lists, memory, WAVE8-MASTER-PLAN.md updates, barrel JSDocs for wave notes. Report progress frequently to supervisor.