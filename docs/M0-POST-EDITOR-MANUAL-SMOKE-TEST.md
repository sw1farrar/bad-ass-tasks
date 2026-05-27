# M0 Post-Editor Manual Smoke Test Script

**Agent**: 8 (Parallel Support Wave for M0)  
**Charter**: Prepare detailed, runnable manual smoke test script for **post-Editor verification**.  
**Base**: Exactly M0-HYGIENE-RUNBOOK.md Section 2.4 (Manual Demo Smoke Test Checklist). Expanded with step-by-step actions, explicit **Expected Results**, **Console Error Checks**, **Demo Invariant Verification**, and **post-Editor-Migration specifics** (Batch 1: TipTapEditor move + backward-compatible re-export shim per M0-Folder-Migration-Plan.md).  
**Focus**: CommandPalette, editor flows (Notes + TipTapEditor), persistence, guards, realtime stubs, polish.  
**When to Execute**: Immediately after TS-Final-Fixes + Editor-Migration-Executor completion + full hygiene regression green (per runbook 2.2). Pre-gate or post any editor-impacting change.  
**Evidence Standard**: Screenshots (editor with active slash menu + pills + rich content), console excerpts (clean), terminal outputs (hygiene + greps), notes on data survival post-refresh/refresh. Attach to verification packet / sign-off.  
**Governance**: Protect demo invariant (pure demo mode: no .env.local keys or commented Supabase; w1/w2 isolation). Zero bypasses of hybrid guards. Report ONLY to Supervisor (Agent 44). Use `todo_write` in your own work. Re-run full chain on any failure.

**Companion References** (do not alter):
- `docs/M0-HYGIENE-RUNBOOK.md` (exact §2.4 base + §2.3 Guard Audit + §2.2 commands)
- `docs/M0-VERIFICATION-PACKET.md`
- `docs/M0-VERIFICATION-SIGN-OFF-TEMPLATE.md`
- `M0-Folder-Migration-Plan.md` (Batch 1 shim + import parity)
- `components/TipTapEditor.handoff.md` (slash commands: /heading*, /task, /note, /note-link, /link, /ai, /today, /divider, etc.; bidirectional pills; JSONB roundtrip)

**Automated Complement**: `npm run test:e2e` (demo-tolerant smoke in `tests/e2e/smoke.spec.ts` — covers load, ⌘K, task create/complete). Run before/after manual.

**Time Estimate**: 20-35 min (with evidence capture).

---

## Prerequisites & Environment Setup

- Clean git state (recommended): `git status`
- Fresh `npm install` if deps changed.
- Two browser profiles / incognito windows or tabs (same origin for multi-tab collab sim).
- DevTools open in all tabs (Console tab; filter to Errors + Warnings + Info as needed. Allow known non-fatal Supabase "not configured" in pure demo).
- Hard refresh habit: Ctrl/Cmd + Shift + R after every major action.
- Demo mode ONLY: No live Supabase keys. Confirm `isSupabaseLive()` returns false (visible via DEMO badges).
- Terminal ready for hygiene commands + greps.

**Launch Dev Server** (keep running):
```bash
npm run dev
```
Wait for "Ready" / localhost:3000. App must load without startup errors.

---

## Step 0: Pre-Smoke Full Hygiene + Guard Audit (MANDATORY — Runbook 2.2 + 2.3)

Run from project root (atomic chain). Capture full output.

```bash
npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e
```

**Post-Editor Specific Hygiene** (additive):
```bash
# Verify editor-related imports resolve cleanly post any migration
npm run typecheck 2>&1 | grep -i -E "(tiptap|editor|TipTap|features/notes)" || echo "No editor TS issues"
```

**Guard Audit Greps** (capture output — from runbook 2.3):
```bash
grep -r --include="*.ts" --include="*.tsx" "isSupabaseLive\|isSupabaseConfigured" . --exclude-dir=node_modules --exclude-dir=.next | head -20

grep -r --include="*.ts" --include="*.tsx" '"w1"\|"w2"\|w1\|w2' . --exclude-dir=node_modules --exclude-dir=.next | grep -E "(workspaceId|if|includes|block|strip|guard|demo|note|editor)" | head -30

grep -n "export .*function\|export const .* =" lib/data/hybridStore.ts | head -30
```

**Expected**:
- All hygiene commands exit 0 (green).
- No new editor/hybrid/TS errors introduced by Editor migration.
- Guard greps show top-of-function `if (!isSupabaseLive()) return ...` on all public hybrid exports (createNote, updateNote, getNotes, etc. at their definitions ~868+, 913+, etc.).
- No direct Supabase calls bypassing hybrid in editor paths.
- Demo ID ("w1"/"w2") stripping logic present in queue/persistence.

**If any failure**: Halt. Do not proceed to manual. Fix via new proposal. Re-run.

**Demo Invariant Check**: Confirm via code or runtime (see Step 8) that editor never bypasses guards. Editor only *reads* `isSupabaseLive()` for "DEMO"/"LIVE" label (pure UI).

---

## Step 1: Pre-Launch / Environment (Runbook 2.4 Base)

1. **Action**: Navigate to http://localhost:3000 (fresh tab). Hard refresh (Ctrl/Cmd+Shift+R). Open DevTools → Console (clear it). Note any "DEMO" indicators or SupabaseSetupBanner.

   **Expected Result**: App loads cleanly. Sidebar (Today/Tasks/Notes/Calendar/Teams), main content (default Today view), no white screen / crashes. "DEMO • local only" or equivalent badges visible (e.g. in Notes header). SupabaseSetupBanner may appear (dismissible, non-blocking).

   **Console Verification**: Filter "error". Zero *new* errors on load related to TipTap, React, hybridStore, Supabase client, or network. Tolerate only pre-existing demo "not configured" warnings (filter them out; confirm none fatal like Uncaught TypeError / ReferenceError in editor modules).

   **Demo Invariant Verification**: Pure demo mode active. No attempts to connect to live Supabase on initial load. localStorage may contain demo data for w1/w2 but no leakage to real workspaces.

2. **Action**: Switch to Notes view (click "Notes" in sidebar or use keyboard nav if mapped).

   **Expected Result**: Notes list renders (grid of cards or empty state). "DEMO • local only" badge + note count visible. "New note" button present. Sample notes (if any) show plain-text previews extracted from JSONB content.

   **Console**: Still clean (no TipTap render errors on view switch).

---

## Step 2: Editor Migration Artifacts Verification (Post-Executor Specific)

**This section is mandatory for post-Editor verification.** (Assumes Editor-Migration-Executor Batch 1 executed: move + shim.)

1. **Action**: In your editor/IDE or via terminal, inspect files (do not edit):
   ```bash
   # Quick file size / head check (post-move: shim thin, real impl in features/)
   wc -l components/TipTapEditor.tsx features/notes/editor/TipTapEditor.tsx 2>/dev/null || echo "Inspect manually"
   head -20 components/TipTapEditor.tsx
   head -5 features/notes/editor/TipTapEditor.tsx
   cat components/TipTapEditor.tsx | head -15
   ```
   Also verify barrel:
   ```bash
   cat features/notes/editor/index.ts
   ```

   **Expected Result**:
   - `components/TipTapEditor.tsx`: Thin backward-compatible re-export shim (~8-15 lines): `"use client"; export { TipTapEditor, type TipTapEditorProps } from "@/features/notes/editor/TipTapEditor";` (plus comments).
   - `features/notes/editor/TipTapEditor.tsx`: Full original implementation (1285+ LOC, identical behavior: useEditor, slashCommandsBase with categories, MentionMark, onUpdate JSON emit, aiTransform, etc.).
   - Barrels present (even if `export {}` placeholders with migration JSDoc + guard warnings: "This module must never import or call hybridStore functions bypassing isSupabaseLive()... Editor is pure client UI.").
   - `app/page.tsx` import remains: `import { TipTapEditor } from "@/components/TipTapEditor";` (resolves via shim, zero code change required).
   - No duplicate logic. No import resolution errors.

   **Console / Build Check**: Re-run `npm run typecheck` (or full build) from Step 0 if not done. Zero errors from editor paths.

   **Demo Invariant**: Migration touches *only* UI/editor files. Zero changes to `lib/data/hybridStore.ts`, `store/useTaskStore.ts` (notes wiring), or any guard. Confirmed via prior greps.

   **If migration not yet executed**: Note "Pre-migration state — full impl still monolithic in components/. Script still valid for core flows; re-execute this section post-Executor."

2. **Action**: Hard refresh app. Open a note (create one if needed — see Step 5). Confirm editor renders identically to pre-migration expectations (toolbar, editable area, placeholder).

   **Expected Result**: Full TipTap functionality present with no regression. (This proves shim + move parity.)

---

## Step 3: Command Palette Flows (Runbook 2.4 — Core Entry Point)

1. **Action**: Press ⌘K (Mac) or Ctrl+K (Win/Linux). Palette opens. Type partial task title or use search. Try natural language create: select/create action or type/prompt "Ship report P0 @me tomorrow" via the create flow (prompt in handleCreateTask).

   **Expected Result**: Palette opens instantly (cmdk dialog visible, glass styling). Live filter/search works across tasks/notes. Create task succeeds (via prompt or direct). New task appears in list with parsed priority/due/assignee if natural lang parsing active in addTask. Toast confirmation. Data visible immediately (optimistic).

   **Console Verification**: No errors on open/filter/create (no cmdk, store, or hybrid errors). Any semantic search (`getHybridSearchResults`) silent in demo.

   **Demo Invariant**: Create uses `addTask` (delegates to hybridStore with top-level `!isSupabaseLive()` guard + w1/w2 block). WorkspaceId for current demo ws only. No cross-ws pollution.

2. **Action**: From palette, create a Note (if action available) or switch to Notes + create. Use palette to focus P0s or clear filters (power actions).

   **Expected Result**: Note create succeeds, view switches to Notes. Filters apply cleanly.

   **Console**: Clean.

3. **Action**: Close palette (Esc or select). Re-open and verify recent activity / semantic results update after prior creates.

   **Expected Result**: Delightful keyboard-first experience. No layout shift or perf hit.

---

## Step 4: Core Task Views (Brief — Supports Editor Context)

(Keep brief per charter focus on Editor; full per runbook 2.4.)

1. **Action**: Tasks List: Add task (quick input or palette), edit title, toggle complete (Space or checkbox). Set priority/tag/due. Kanban: Drag between columns. Today view: Verify smart briefing/focus score updates.

   **Expected Result**: All CRUD optimistic + persist. Confetti + toast on complete. Drag smooth (no shift). Data survives hard refresh. Priorities etc functional.

   **Console**: Zero errors (store/hybrid/dnd).

   **Demo Invariant + Persistence**: All via guarded hybrid paths. local demo data isolated.

2. **Action**: Switch views (sidebar clicks or keys 1/2/3 if implemented). Return to Notes.

   **Expected Result**: State preserved, smooth.

---

## Step 5: Notes + Editor Flows (EXPANDED — Primary Post-Editor Focus)

**Critical for post-Editor verification.** Exercise every slash command category, linking, roundtrip, callbacks.

1. **Action**: In Notes view, click "New note" (or use palette/⌘N equiv). Note created + auto-selected into detail (inline editor). Give it a title (e.g. "Post-Editor Smoke Test Note").

   **Expected Result**: New card appears in grid with title. Detail pane opens with TipTapEditor (keyed by id). Toolbar visible (bold/italic/heading/list/etc icons from lucide). Editable area focused, placeholder text. "DEMO • local only" + "TIP TAP • RICH JSONB • AUTO-SAVE" footer. Backlinks panel stub (demo samples or empty).

   **Console**: On mount/render: No TipTap/React errors, no failed imports. `isSupabaseLive()` call (for mode label) silent.

2. **Action**: Type rich content:
   - Plain paragraphs + **bold** / *italic* (via toolbar or markdown).
   - Headings (H1/H2 via toolbar or type then /).
   - Bullet/numbered/checklist.
   - Blockquote, code block, horizontal rule.
   - Save happens on every keystroke (auto via onChange → updateNote).

   **Expected Result**: Formatting applies live (ProseMirror). No lag. Editor 60fps feel.

3. **Action**: Trigger slash menu: In empty paragraph, type `/` then letters (e.g. `/hea`, `/tas`, `/ai`, `/lin`). Use ↑↓ arrows + Enter/Tab to select. Test categories (Formatting, Lists & Structure, Smart Embeds & Actions, Utilities & AI).

   Specific executions:
   - `/heading1` → H1 inserted.
   - `/task` → Task embed placeholder + triggers `onCreateTaskFromSlash` (real task created + auto-linked back to this note).
   - `/note-link` or `/link` → Link picker floats (demo samples: "🔥 Launch v2" task, "📓 Meeting Notes", custom). Pick one → neon "mention-pill" inserted (✅ / 📝 / 🔗 prefix + data attrs + title tooltip). Pill styled per globals.css.
   - `/ai` (or `/ai expand` etc.) → Selected text or para rewritten via local `aiTransformText` (demo mode). Result inserted + ✨ marker + success toast with explanation. No network.
   - `/today`, `/divider`, `/quote`, `/checklist`, etc. → Inserts structured content.
   - `/embed` → Prompt for URL, inserts rich placeholder.

   **Expected Result**: Floating glass slash menu appears instantly at caret (positioned correctly). Live filter + scoring (title priority). Keyboard nav perfect (Esc closes). Command executes: formatting changes, embeds inserted, callbacks fire (task created + toast "Task created & linked via slash", bidirectional chips update in header). Mention pill renders beautifully (hover, neon). No menu stuck or duplicate triggers.

   **Console Verification**: On slash trigger/filter/execute: Zero errors (no useEditor, cmdk conflicts, or onUpdate crashes). AI slash: no xAI config errors (falls back gracefully; `isXAIConfigured` false in demo). Toast fires cleanly (Sonner).

4. **Action**: Exercise bidirectional:
   - From editor /link or header +LINK: Create link to existing task/note.
   - Use "Extract Tasks" button (AI action items from note content → real tasks + auto backlinks).
   - In header: Remove a linked chip (×) → both sides updated (note.linkedTaskIds and task.linkedNoteIds).

   **Expected Result**: Chips update live. Links survive. "✎ N live" presence stubs if multi-tab. Conflict UI (if simulated) graceful.

5. **Action**: Version snapshot: Click "History" (or call capture if exposed). Edit more, snapshot again.

   **Expected Result**: Toast "Snapshot captured (DEMO)". localStorage `note-history-${noteId}` populated (client-only; survives demo refresh). Panel stub shows entries.

6. **Action**: Close editor detail (Close button). Re-open same note from grid. Then hard refresh (Ctrl+Shift+R) whole app. Re-select note.

   **Expected Result**:
   - On re-open (pre-refresh): Rich content + formatting + pills + links fully restored (JSON roundtrip via `prepareInitialContent` + `noteContentToJson`/`jsonToNoteContent` in hybrid).
   - Post hard refresh: Identical (persisted via updateNote → hybrid demo local state or localStorage patterns).
   - Card preview shows clean plain-text extract (no JSON leakage).

   **Console**: No hydration or parse errors on reload. onChange fires cleanly post-restore.

7. **Action**: Delete note (header Delete, confirm). Or archive if present.

   **Expected Result**: Removed from list + detail. No ghosts on refresh.

**Editor-Specific Demo Invariant**: All writes (updateNote calls) go through store → hybridStore `updateNote` (which guards `if (isSupabaseLive())` then delegates; optimistic always in demo). Editor itself never calls Supabase or hybrid writes directly. w1/w2 notes isolated (create in w1 never appears in w2).

---

## Step 6: Persistence, Offline & Resilience (Critical — Include Editor Content)

1. **Action**: With note open + rich content (with slash inserts + links), simulate offline: DevTools → Network → Offline. Edit more in editor (add paragraphs, another /ai). Create/edit a task via palette or list. Note pending queue indicators (if exposed via logger or UI).

   **Expected Result**: Edits optimistic (visible immediately). Editor continues typing. Queue builds for pending ops (hybrid internal). No crashes. "Offline" state may show in UI/sync indicator.

2. **Action**: Toggle back Online (Network → No throttling / Online). Wait for sync. Hard refresh. Switch workspaces (w1 ↔ w2) and back.

   **Expected Result**: Auto-sync via pending queue + LWW (no data loss, no dups, timestamps respected). Editor content + all links intact post-reconnect + refresh. Workspace switch: Notes/tasks isolate perfectly (w1 content gone in w2 view; no cross-contamination). Reconnect shows consistent state.

   **Console**: During offline: Possible benign "network" warnings (filter). On reconnect: No hybrid errors, no duplicate key or constraint violations. Queue processing silent in demo (guards prevent real enqueues for !live).

   **Demo Invariant + Guard Check**: In offline demo, no real Supabase calls attempted (guards at enqueue/createNote etc. short-circuit). "w1"/"w2" ops stripped from any queue. Data survives only via optimistic + client storage (localStorage for history, store state for session).

3. **Action**: Mid-edit crash sim: Hard kill tab or refresh while typing in editor + mid-task drag.

   **Expected Result**: On reload: Data survives (optimistic UI state + hybrid local fallbacks + JSONB roundtrip for notes).

---

## Step 7: Realtime / Collab Simulation (Demo Mode Stubs — Editor Focus)

1. **Action**: Open two tabs (same demo workspace, e.g. w1). In Tab A: Select/create note, start typing in editor + trigger /link or presence edit. In Tab B: Observe list/cards + (if open) the same note detail.

   **Expected Result**: Tab A changes optimistic visible. Tab B sees updates (optimistic broadcast via store listeners or localStorage? — demo stubs). Presence: "✎ N live" or editing badges appear in other tab (no full pub/sub in pure demo, but no errors/crashes). Cursors (remoteCursors prop) stub if wired.

2. **Action**: In one tab trigger conflict timing (rapid concurrent edits on same note if UI allows) or just rapid changes.

   **Expected Result**: LWW resolution graceful (last write visible post-sync). Conflict UI banner (if triggered) offers "Take theirs / Keep mine". No data corruption.

   **Console**: Zero realtime/subscription errors (demo paths are no-op guarded). No "channel" or Supabase realtime warnings in pure demo.

   **Demo Invariant**: All collab in demo is stubbed/optimistic/local. No real broadcast. Guards prevent any live channel setup for w1/w2.

---

## Step 8: Demo Invariant & Guard Verification (UI + Manual Review)

1. **Action**: Throughout (especially editor): Observe all "DEMO" badges (Notes header, snapshots toasts, etc.). Switch to w1/w2 via workspace switcher (if exposed in UI or store debug). Create note/task in w1 only.

   **Expected Result**: "DEMO • local only" always when !live. w1 data invisible in w2 (and vice versa). No leakage on refresh or tab switch.

2. **Action**: (Optional deep) In DevTools Console, evaluate (after import or via exposed):
   - `/* conceptually */ isSupabaseLive()` behavior (or inspect store state).
   - Or simply confirm via UI labels + absence of live-only features.

   **Expected**: Consistent with guards. Editor badge toasts show "(DEMO)".

3. **Re-run key greps** (from Step 0) post all manual actions. Confirm no new bypass code introduced (even in temp test state).

**Failure = Halt + rollback per runbook 2.5.**

---

## Step 9: Polish, Keyboard, Non-Regression & UX Delight

1. **Action**: Full keyboard tour (everywhere, including editor):
   - ⌘K everywhere.
   - Arrows/Enter/Esc in lists, palette, slash menu.
   - Space to complete tasks.
   - Tab / focus in editor toolbar + content.
   - View switches.

2. **Action**: Visual/aesthetic: Scroll, resize, dark theme, glassmorphism, confetti (complete task), toasts (Sonner), Framer Motion (if any drags/modals), 60fps in editor typing + slash.

3. **Action**: ErrorBoundary test (safe): Intentionally bad action if exposed (or just confirm global-error.tsx present). Force JS error in console? (use cautiously).

   **Expected Result**: Keyboard-first delightful (no dead ends). Neon aesthetic perfect, no layout shift (CLS=0), smooth animations. Graceful error recovery. Command Palette + editor end-to-end magical.

   **Console**: No warnings for motion, sonner, prose, or unhandled in editor.

---

## Step 10: Final Console Error Sweep + Cross-Flow Validation

**Action** (after all steps, in all tabs):
- Clear Console.
- Perform rapid tour: Open palette → create via NL → switch to Notes → create note → rich editor + 5+ slash commands (incl /ai + /task + /link) → link + extract → offline edit → reconnect → hard refresh ×2 → workspace switch ×2 → multi-tab presence sim → complete some tasks (confetti).
- Filter Console: Errors + Warnings. Also check Network tab for unexpected calls (should be none to Supabase in demo).

**Expected**:
- **Zero critical/fatal console errors or new warnings** attributable to:
  - TipTap / @tiptap/* (useEditor, extensions, MentionMark, slash detection)
  - Editor callbacks or onChange JSON parse/stringify
  - Hybrid/store updates for notes (updateNote, linked*Ids)
  - AI transforms (local fallback)
  - Presence/cursors/conflicts
  - Persistence/queue (demo paths)
- Tolerated only: Pre-existing demo Supabase "not configured" / optional auth noise (explicitly filtered in e2e too).
- No React hydration mismatches, key warnings, or prop errors post-migration shim.
- Network: No Supabase POST/WS in demo mode.

**If any editor-related error appears**: Note exact message + stack + reproduction step. Reproduce in fresh tab. This blocks post-Editor sign-off.

---

## Success Gate & Evidence Collection (Runbook 2.4)

**All items must pass**:
- Zero data loss (notes content, links, tasks, history snapshots survive all refreshes/offline/reconnect/ws switch).
- Zero guard violations or demo pollution (w1/w2 isolation perfect; no live calls in demo).
- Editor migration artifacts verified (shim + full impl parity; imports unchanged; no behavior regression).
- Full rich editor UX (all documented slash commands + bidirectional + JSONB roundtrip + toolbar + AI local) delightful and functional.
- Keyboard + polish perfect.
- Console 100% clean (post-sweep, per criteria).
- Full hygiene + guard audit green before/after.

**Capture & Attach** (minimum):
- Screenshots:
  - Notes view + open editor with rich content + active slash menu (grouped categories visible).
  - /link or /note-link picker + resulting mention-pill(s) in editor.
  - /ai result + toast.
  - /task from editor + resulting linked task + bidirectional chips.
  - Post-hard-refresh note detail (rich formatting preserved).
  - Console (clean, with filter applied).
  - DEMO badges + workspace switcher showing isolation.
  - Multi-tab (one editing, one observing presence badge).
- Terminal: Full hygiene output + guard grep outputs (pre/post).
- Notes: Any edge (e.g. "slash /ai on empty para fell back gracefully").
- Optional: Store state dump (via React DevTools or console) showing notes array with rich `content` JSON strings + linked* arrays.

**Post-Smoke**:
1. Re-run full hygiene chain (Step 0).
2. Re-run guard audit greps.
3. Update M0-VERIFICATION-PACKET.md / sign-off template with evidence + "Post-Editor Smoke: PASSED (Agent 8)" + date/time + links to artifacts.
4. If any regression: Invoke rollback (runbook 2.5) + re-verify.

**Success Declaration Example** (for your report):
> "Post-Editor Manual Smoke (Agent 8, based exactly on runbook §2.4): All 10 sections + migration artifacts + editor flows + console clean + demo invariants GREEN. Evidence attached. Full regression re-executed. Ready for gate."

---

**End of Script**

*This script is the authoritative, copy-paste-ready expansion of M0-HYGIENE-RUNBOOK.md Section 2.4 for the post-Editor verification phase. It was prepared directly from the runbook text + cross-referenced implementation details (TipTapEditor slash registry, hybrid note guards, store wiring, migration plan diffs, e2e patterns) without altering any source. Always re-execute full regression + this smoke after Editor changes. Protect the hybrid guards in lib/data/hybridStore.ts at all times.*

**Usage in Wave**: Run by support agents / Executor post-change. Feed results into Status-Synthesizer / Risk agents / final M0 gate.

---

*Generated for M0 parallel support wave — 2026-05-25 (PT). Exact fidelity to charter.*