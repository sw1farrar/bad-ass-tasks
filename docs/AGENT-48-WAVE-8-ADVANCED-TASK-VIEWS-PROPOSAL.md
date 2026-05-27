# AGENT-48: Wave 8 Advanced Task Views — Proposal for Sequencing & Scope

**Agent 48: Advanced Task Views Lead**  
**To: Agent 44 (Supervisor)**  
**Date:** 2026-05-25  
**Wave:** 8  
**Status:** Audit Complete — Awaiting Scope/Sequencing Approval Before Any Major Implementation

## Executive Summary

Per delegation and the **Critical Rule** ("Before major implementation on new or significantly expanded views, submit a proposal to Agent 44 (the Supervisor) for sequencing and scope approval"), this document delivers:

1. **Full audit** of current Calendar, recurring logic, and advanced views state (based on exhaustive exploration of codebase, prior handoffs, memory, schema, engine, UI, and tests).
2. **Gap analysis** against original vision (docs/bad-ass-tasks-prompt.md) + Wave 8 goals (full Calendar w/ drag-reschedule, Timeline/Gantt, Table/Notion-style DB views w/ properties, saved smart views).
3. **Recommended proposal**: Phased, low-risk sequencing with clear gates, minimal schema impact initially, full leverage of existing production foundations (esp. Agent 25 recurring/calendar engine + drag).
4. **Detailed plan** for approval: scope per phase, files impacted (absolute paths), tech approach, risks/mitigations, success criteria, verification steps.

**No implementation work on new/expanded views has begun or will begin** until explicit approval. Polish-only or bugfix on *existing* calendar/recurring (if any) would be separate and minimal.

**Key Finding from Audit**: 
- Calendar + Recurring engine is already **production-quality and advanced** (Agent 25 delivered days ago): intelligent native-drag reschedule (series vs one-off), virtual instances, full RRULE (COUNT/UNTIL/YEARLY/raw), skips/exceptions, month/week + *basic* timeline. 
- **Major gaps remain exactly in Wave 8 targets**: No standalone/full Timeline/Gantt, no Day view, no Table/Notion DB (custom or even fixed properties), no saved smart views/presets. Existing "Tasks" list is rich row cards + filters (not spreadsheet DB style); Timeline is calendar submode with simple bars.
- Strong foundations (dnd-kit installed+used in Kanban, date-fns, framer-motion, hybridStore, pure engine in lib/utils.ts, virtual-only recurring design) make this highly feasible incrementally without breaking demo/live/realtime/PWA/mobile.

**Recommendation**: Approve **3-phase incremental delivery** starting with high-ROI Calendar completion (leveraging existing drag/engine), then Table (fixed props first), then full custom props + saved smart views. This matches "audit-first" culture from Phase 1 memory and Agent 25 handoff.

## 1. Audit Methodology & Sources

- **Project structure**: Root + app/page.tsx (monolithic UI host for *all* views), components/ (TaskModal with full RecurrenceEditor, no dedicated Calendar comp), lib/{utils.ts (engine), data/hybridStore.ts (recurring scaffolds + CRUD forwarding)}, store/useTaskStore.ts (currentView limited, filters, no advanced view state), types/{index.ts, supabase.ts}, supabase/schema.sql.
- **Tools used**: list_dir (multiple levels), read_file (full + offset/limited on key files: page.tsx ~3400+ LOC sections for views/calendar/renderTaskRow/etc., utils.ts engine, hybridStore, store, schema partials, TaskModal, README, prompt.md, handoffs), grep (broad + targeted regex on calendar/timeline/drag/recurring/table/Notion/smart/preset/properties across *.ts* + *.sql + *.md; limited to source), memory_search + memory_get patterns (Phase 1 + session logs), package.json (deps).
- **Key prior artifacts**:
  - docs/AGENT-25-RECURRING-CALENDAR-HANDOFF.md (today's delivery: full audit of prior state, what was extended, remaining gaps explicitly list "Calendar day view + drag between views, Timeline polish").
  - docs/bad-ass-tasks-prompt.md (original vision: exact 5 views including "Table View (Notion database style with properties)", "Timeline View (Gantt-style)", "Calendar View (month + week + day, drag...)", "Saved searches / smart views").
  - Memory: Audit-first approach, targeted recurring_rule extensions, "Drag-to-reschedule and calendar view enhancements (week, timeline, Gantt) added incrementally", centralized hybrid layer.
  - Other: AGENT-27 mobile (calendar as "heavy stub" in roadmap), AGENT-32 semantic (graph integration points for views incl calendar), tests/utils.test.ts (recurring coverage), README (current status lists List/Kanban/Today/CmdK but defers full vision to prompt).
- **No unsolicited docs created**; this proposal created explicitly per task delegation + "prepare your plan" + "document ... in appropriate format (e.g. proposal doc)".
- **Build artifacts / node_modules ignored** for searches.

**All findings reproducible** via `npm run typecheck`, `npm run dev`, manual flows + tests.

## 2. Current State Audit — Detailed Findings

### 2.1 Recurring Logic (lib/utils.ts + callers)
- **Production ready (Agent 25)**: Full RRULE-ish engine (no rrule.js dep, pure date-fns). 
  - RecurrencePattern: freq (DAILY/WEEKLY/MONTHLY/YEARLY), interval, byDay, until (YYYY-MM-DD norm), count (new in 25).
  - parseRecurringRule / generateRecurringRule: robust roundtrips, COUNT/UNTIL handling (mutually exclusive noted), improved parsing (ISO/compact/NaN-safe).
  - getOccurrencesInRange, getNextRecurringDue, getRecurringLabel, getRecurrenceEndDescription ("Ends after 5×", "Ends 2026-12-31", "Never").
  - **generateRecurringInstances(task, range, max)**: Returns rich `RecurringInstanceInfo[]` (dateKey, isException, seriesLabel) — explicitly "ready for future views/exports/overrides".
  - Exceptions: normalizeExceptionKey, isOccurrenceException, filter via exceptionDates[] (client YYYY-MM-DD; hybrid + GIN in schema).
  - Bounded/perf: safety max loops, early COUNT/UNTIL exits, "suitable for 100s of recurring tasks". Pure funcs = perfect demo/live sep.
- **Schema/hybrid/store**:
  - tasks.recurring_rule TEXT, exception_dates TIMESTAMPTZ[] (or string[] client).
  - hybridStore.ts: map/forward in buildTaskDbPayload, mapTaskRow, scaffolds (computeNextExceptionsForSkip, processRecurringSeriesForWorkspace stub, breakRecurringSeries), updateTask supports full fields + offline queue/LWW.
  - useTaskStore.ts: setRecurringRule delegate, recurring filter ("all/only/none"), SAMPLE_TASKS with rules + exceptions (never leaks to live).
  - Task type (types/index.ts): recurringRule?, exceptionDates? + parentTaskId (non-breaking).
- **UI integration**: TaskModal RecurrenceEditor (full: presets incl Yearly, segmented Never/After N/On date driving count/until, local state no jank, raw RRULE textarea + Apply, previews, skip-next/unskip list, end desc + actual RRULE shown). Calendar + complete logic use engine.
- **Tests**: vitest in tests/utils.test.ts covers parse/generate roundtrips, labels, next-due + exceptions + ends (COUNT/weekly etc.).
- **Gaps noted in Agent 25 handoff (still open)**: Deeper instance overrides (e.g. per-date title edits — scaffolding via RecurringInstanceInfo ready), server RPCs/cron for reminders/materialized, more RRULE (BYMONTHDAY etc.), dedicated tests expansion, mobile long-press on chips.

**Verdict**: Recurring is **not a blocker** — Wave 8 can build directly on it for advanced views. Virtual design (no materialization) is excellent for scale/offline.

### 2.2 Calendar (app/page.tsx primary; "full" with drag?)
- **Implementation location**: Monolithic in renderCalendarView() (~lines 1666–2050+), state: calendarMonth, calendarMode ("month"|"week"|"timeline"). Integrated with global currentView="calendar", taskFilter (recurring affects lists but engine drives calendar), openTask (TaskModal), add/update via store/hybrid.
- **Strengths (matches much of "full Calendar with drag-reschedule")**:
  - **3 modes**: Month grid (full weeks), Week, Timeline (4-wk span).
  - **Virtual recurring everywhere**: dayMap built with getOccurrencesInRange (exceptions passed), chips marked isRecurringInstance (dashed borders), rich titles with occurrence + getRecurrenceEndDescription.
  - **Intelligent native HTML5 drag-reschedule** (handleDragStart/Over/Drop): 
    - Non-rec: simple dueDate update.
    - Rec instance: window.confirm choice — OK= move series anchor (update rule's due), Cancel= add exception to original + create standalone one-off duplicate (copy title/priority/tags/desc/estimate) at target. Toasts explain. Uses normalize + hybrid update + addTask. Reversible. Time-of-day preserved.
    - Works on month/week chips + timeline bars. Payload encodes instance date.
  - Skips: × buttons on chips call handleSkipOccurrence (adds exception, optimistic). Unskip in modal.
  - Badges, recurring filters (in other views), complete auto-advance (skips ex), legend/hints updated for Agent 25 features (COUNT/UNTIL, one-off support).
  - Perf: bounded per task, responsive even with 50+ recurring.
  - Keyboard nav, PWA deep links (?view=calendar), mobile responsive (part of broader PWA).
  - Uses date-fns heavily (startOfWeek etc.), framer for other gestures.
- **Timeline/Gantt submode (basic)**: Horizontal bars (title + rough timeEstimate-derived width + anchor pos), limited slice(0,12), draggable (non-rec focus in code), recurring label. "Basic but delightful" per code comment + handoff. No deps, no resize, no swimlanes, limited zoom/range.
- **Missing for "full"**:
  - **No dedicated Day view** (vision: month+week+day; week is closest).
  - No drag *between* views/modes (handoff calls out as gap).
  - Calendar drag still native HTML5 (Kanban uses @dnd-kit for 60fps/overlay/keyboard — inconsistency).
  - No multi-select, no keyboard drag, limited virtualization for huge calendars.
  - Day chips simple; no time-of-day grid or precise positioning (dueDate is date-ish).
  - Integration points (e.g. semantic graph from Agent 32) exist but basic.
- **State/UI**: All local to page + shared store. No persisted calendar prefs (e.g. default mode, week start).
- **Files touched historically**: app/page.tsx (major), lib/utils.ts (engine), components/TaskModal.tsx (editor), types + hybrid + schema (forwards only).

**Verdict on "full Calendar with drag-reschedule"**: ~70-80% there for core UX (drag is smart/premium). "Full" requires Day view + polish/cross-drag + perhaps dnd-kit migration for consistency. Timeline inside it is the weakest link.

### 2.3 Existing "Advanced" Views
- **currentView** (store + sidebar + keyboard 1-5 + bottom nav PWA + cmd palette + deep links): "today" | "tasks" | "notes" | "calendar" | "teams". **No "timeline" or "table" top-level**.
- **Tasks view** (renderTasksView): Toggle "list" | "board" (kanbanView local state).
  - **List**: renderTaskRow (rich cards/rows: title, due (formatDueDate), priority color, tags, status, time est, swipe-to-complete (framer-motion + haptics, mobile-first), click opens modal, filters/search (global semantic hybrid + legacy taskFilter: status/priority/search/recurring), count badges. Sortable? Limited (Kanban has dnd). Not a true table/grid of properties.
  - **Board/Kanban**: Full production @dnd-kit (DndContext, useSortable per task + columns, sensors/keyboard, DragOverlay, collision, optimistic via store.kanbanReorder + hybrid). Fixed columns (backlog/todo/doing/done); vision mentioned " + custom columns" — not present. Beautiful glass/neon, handles.
- **Today**: Smart briefing (due today/overdue, priority surfacing, AI daily briefing stub, natural add). Uses getFiltered + engine for recurring.
- **Notes/Teams**: Separate (TipTap partial in notes, admin/collabs in teams). No task table embedding yet.
- **No Table/Notion-style DB view**:
  - No spreadsheet UI (resizable columns, visible/hidden props, inline cell edit for multiple fields, add/remove columns).
  - No property system: Task has fixed fields only (no custom props JSONB even). Schema has no task_properties or prop_defs tables. UI hardcodes priority/due/tags/status/assignee/estimate/etc.
  - Filters are global/simple + semantic search (Agent 32 upgrade); no per-view column filters, groups, sorts persisted.
  - renderTaskRow is list, not rows-as-DB-records.
- **No dedicated/full Timeline/Gantt** (see Calendar above; vision calls for separate "Gantt-style").
- **Saved smart views / presets**: 
  - **Absent**. taskFilter is ephemeral in-memory (zustand, no persist beyond basic).
  - Templates exist (Agent 18: saveCurrentAsTemplate, apply, ADMIN_TEMPLATE_LIBRARY, log "saved") — but for *task/note content*, not *views/filters*.
  - Saved searches mentioned in vision + semantic work; "Recently edited" etc. via activity but no named view manager (e.g. "My P0s this sprint" with its own sort/group/visible props, shareable, switchable tabs like Notion DB views).
  - Command palette + filters powerful but not savable as "smart views".
- **Other polish present**: KnowledgeGraph (for links), CommandPalette (⌘K view switch + actions + filters), natural lang parse (creates with due/recurring hints), offline/hybrid full, realtime collab (cursors/presence across views), PWA/mobile bottom nav/FAB/gestures (some calendar chips benefit), TipTap in places.

**Files for views**: Primarily app/page.tsx (all render*View + state + handlers), store/useTaskStore.ts (currentView, taskFilter, getFilteredTasks etc.), components/TaskModal.tsx (detail + recurrence), lib/utils (format/due + engine for calendar), globals.css (neon/glass).

**Verdict**: List + Kanban solid and delightful. Advanced DB-style + saved views + full Gantt = **0% implemented**. Calendar sub-timeline is placeholder for the vision's Timeline View.

### 2.4 Cross-Cutting / Foundations Relevant to Wave 8
- **Drag**: @dnd-kit fully wired for Kanban (production); calendar native (reliable but less rich). Framer for swipes/gestures. Vision: "Drag tasks between ... calendars, and even between workspaces".
- **Data model**: Task minimal vs vision (no subtasks explicit array, no dependencies/blockers, no reminders separate, description text vs full rich in all places, no custom props). parentTaskId present. Hybrid forwards everything safely.
- **Schema**: Solid for current (GIN on exception_dates/tags/assignees, due_date idx, RLS, triggers, invites, activity, notifs). No extensible props or view_presets tables. Realtime pubs noted in schema comments.
- **State/Perf**: Zustand + persist (demo), hybrid for live (queue, LWW). No view config persisted. Calendar O(n tasks * bounded) fine.
- **Mobile/PWA**: Strong (Agent 27/others): bottom nav (includes calendar), FAB, swipes, install, SW. Calendar chips need long-press menu per handoff.
- **AI/Other**: Chat, extraction, semantic, graph — can feed advanced views later (e.g. AI-suggested smart views).
- **Tests/E2E**: Engine tests good; UI view tests minimal (playwright config exists).
- **No breakage risk high**: Additive patterns proven (Agent 25 added features w/ zero core CRUD rewrite).

**Overall Current vs Vision (prompt.md lines ~74-79)**: 2/5 views strong (List/Kanban inside tasks + Calendar partial). Timeline/Gantt/Table/smart views = gaps. Drag/reschedule on calendar = advanced already.

## 3. Gap Analysis vs. Wave 8 Goals

**Wave 8 Focus (per delegation)**: "Complete the advanced task views (full Calendar with drag-reschedule, Timeline/Gantt, Table/Notion-style database views with properties and saved smart views)."

- **Full Calendar w/ drag**: Enhance existing (add Day view, polish timeline into stronger Gantt component usable standalone or embedded, cross-mode drag, upgrade calendar drag to dnd-kit for parity/keyboard/multi, more instance viz, perf for 1000s tasks, mobile gestures on chips). High reuse of Agent 25 code.
- **Timeline/Gantt**: Promote/enhance the basic calendar timeline or new dedicated view. Add: dependency lines (requires new model?), bar resize/drag (dnd), swimlanes (assignee/tag/status), zoom/pan, milestones, critical path basics, today marker, better time est viz, virtual scrolling. Integrate recurring virtual instances.
- **Table/Notion-style DB views w/ properties**: New major surface. 
  - UI: Tabular grid (virtualized rows), resizable/reorderable columns, inline editing (many fields), row selection, density toggle, quick filters per col.
  - Properties: Start with "fixed" mirroring Task (title, status, priority, due, tags, assignee, time est, recurring badge, parent). Then custom: support common Notion types (text, select/multi, number, date, checkbox, person, relation/links, formula?).
  - Storage: Recommend JSONB `custom_properties` on tasks (or separate normalized table for query perf) + workspace-level `property_definitions` table (id, name, type, config, order). Hybrid forward + migration safe.
- **Saved smart views**: New system.
  - Model: New table `saved_views` (or JSON in workspaces.settings/profiles): name, filters (status/priority/search/recurring + semantic?), sort, groupBy, visibleProps/cols, density, calendarMode?, owner/ shared.
  - UI: View switcher/tabs (like Notion DB header: "All / P0 This Week / My Assigned"), "Save current as..." , manage modal (rename/delete/share), apply instantly (update store filters + local view state).
  - Persist: Zustand + hybrid CRUD + realtime. Command palette integration ("Apply smart view X").
  - Bonus: Default system views + user-created.

**Dependencies on other waves**: Minimal (use existing TipTap for desc, AI for suggestions, collab for shared views, PWA for mobile table). But:
- Task model expansion or custom props may touch many places (modal, list row, natural lang parser, import/export, templates, graph).
- Schema migration required for new tables/cols (non-breaking additive).
- Store needs viewConfig state (currentView + activeSmartViewId + per-view overrides?).

**Risks if not phased**:
- Over-scope: Trying full custom props + Gantt deps + saved views at once → schema churn, perf surprises, mobile complexity.
- Breaking demo/live or realtime.
- Inconsistent UX (drag libs, mobile gestures).
- Query perf on custom props without indexes/plans.
- User confusion without good onboarding for new views.

## 4. Proposed Plan & Sequencing (for Approval)

**High-level Recommendation**: **Phased 3-wave-within-Wave8** (or 3 sub-phases). Each phase delivers *shippable value* independently, with explicit "done" criteria + handoff. Start with Calendar (leverages most existing code + recent Agent 25 investment + handoff gaps). Defer heavy custom props/schema until Table phase.

**Phase 1: Complete "Full Calendar" + Enhanced Timeline/Gantt Basics** (1-2 sub-agents or focused effort; lowest risk, highest delight reuse)
- Scope:
  - Add **Day view** mode (calendarMode="day"; single-day grid or list + time slots if due has time; engine for recurring).
  - **Promote/upgrade Timeline**: Extract/refine into stronger Gantt (standalone or promoted in nav as "Timeline" view? Or keep as calendar sub + add dedicated toggle). Add basic deps viz (stub lines if parentTaskId), bar drag/resize (use dnd-kit or framer), swimlanes (group by assignee/tag), zoom levels (day/wk/mo), virtual scroll for many bars, today line, better est calc.
  - Polish existing Calendar: Migrate calendar drag to @dnd-kit (for overlay, keyboard, multi?), enable cross-mode drag (e.g. week chip to timeline), keyboard shortcuts for nav/drag, perf (useMemo dayMap + virtualization hints), mobile long-press context (skip/reschedule choices per Agent25 gap), instance overrides stub (edit one via modal hinting "this occurrence only").
  - Drag between views (e.g. from Tasks list/Kanban to Calendar drop zones; from Calendar to Kanban status).
  - Integrate saved? No — simple presets (e.g. "This Month Recurring") as buttons.
  - Update store: calendarPrefs (defaultMode, etc.), extend currentView if Timeline promoted.
  - Docs/tests: Expand engine tests if needed; e2e for new day/timeline interactions; update handoff.
- **Files (est.)**: app/page.tsx (heavy but incremental on renderCalendar + new renderDay/renderGantt), lib/utils.ts (minor helpers), store/useTaskStore.ts (prefs + actions), components/TaskModal (minor for overrides), globals.css (Gantt styles), perhaps new components/CalendarGantt.tsx or inline.
- **Schema**: None (reuse existing).
- **Deps**: None new.
- **Success**: All Agent25 "next steps" for calendar addressed + "full" feels complete per vision (m/w/d + strong Gantt). Demo flows: create rec, drag series/one-off in all modes, day view, Gantt bars interactive. Mobile parity. Typecheck + existing tests pass + new manual cases.
- **Gate**: After Phase 1, quick review w/ Agent44 before Phase 2.

**Phase 2: Table/Notion-style Database View (Fixed Properties First)**
- Scope:
  - New top-level view "Table" (add to VIEWS, sidebar, keys, bottom nav, cmd palette, deep links).
  - UI: Virtualized table (react-window or native + CSS for simplicity; or TanStack Table if lightweight — avoid bloat). Columns for core Task props (title inline edit, status dropdown, priority, due (date picker), tags multi, recurring badge + quick set, time est, links count). Resizable cols (CSS/JS), reorder, hide/show, sort (multi), filter chips per col or global, group by (status/priority), row density, selection (bulk actions).
  - Leverage existing: renderTaskRow logic + filters + dnd-kit patterns + semantic search + openTask.
  - "Notion-like": Click cell to edit (optimistic hybrid), add row inline, "properties" header (for now fixed; "Customize columns" menu stubs custom later).
  - Recurring/timeline awareness: Due columns show virtual next or badges.
  - Mobile: Horizontal scroll + bottom sheet for row details or compact cards fallback.
- **Files**: app/page.tsx (new renderTableView + state), store (tableViewState: visibleCols, sort, group), new? components/TaskTable.tsx or inline, perhaps extend TaskModal.
- **Schema**: None or minor (e.g. add jsonb if needed later).
- **Success**: Usable Table view with all current props editable inline in grid. Filters/sorts/groups persist in session. Matches "Notion database style" for fixed set. Integrates drag (e.g. to Kanban).
- **Gate**: Approval for custom props phase.

**Phase 3: Custom Properties + Saved Smart Views (Full Power)**
- Scope:
  - **Properties system**: Workspace prop defs (new table or JSON in workspace.settings: [{id, name, type: 'select'|'multi'|'date'|'text'|'number'|'checkbox'|'relation', options?, formula?}]). Per-task custom_properties JSONB (or normalized values table for perf).
    - Hybrid + store + types updates (non-breaking; old tasks get {}).
    - UI in Table + TaskModal + List: "Add property" (type picker), edit cells for custom, color/options for selects.
    - Update natural lang parser, import/export, templates, graph to respect customs.
    - Query/filter support (client for demo; server later via RPC or GIN).
  - **Saved Smart Views**: New `saved_views` table (id, workspace_id, name, config: {filters, sort, groupBy, visibleProps, viewType:'table'|'kanban'|'calendar'?, ...}, isDefault, created_by).
    - CRUD in hybrid/store (optimistic + realtime).
    - UI: In Table/Calendar/Tasks header: View tabs or dropdown (system defaults + user saved). "Save view...", "Edit views" manager (list, delete, share via link?).
    - Apply: Hydrate all relevant state (taskFilter + table/calendar specific + props visibility).
    - Command palette: "Apply smart view: Foo".
    - Persist across refresh/login (live via DB, demo local).
  - Polish: Bulk edit in table, formulas stub, relations to notes/tasks, AI suggest views/props.
- **Files**: supabase/schema.sql (new tables + indexes + RLS + RPCs if needed), types (new interfaces), lib/data/hybridStore.ts (new CRUD + mappers), store/useTaskStore.ts (heavy: view management), app/page.tsx (integrate everywhere), TaskModal + new PropertyEditor comp, CommandPalette updates, export/import.
- **Risk mitigation**: Phase behind gate; start with client-only custom in demo + JSONB additive; full server after.
- **Success**: Users create custom props (e.g. "Effort:select"), save "My Q3 P0s + custom" view, switch instantly, table shows/ filters them, recurring/calendar respect. Full vision parity.

**Overall Sequencing Rationale**:
- Calendar-first: Builds on *just-completed* Agent 25 work + explicit remaining gaps in its handoff. Delivers "full Calendar + Timeline/Gantt" early with minimal new surface area.
- Table fixed next: Introduces the DB metaphor safely (no schema risk).
- Custom + Smart last: Highest value + complexity (model + persistence + UI everywhere).
- **Alternative (if preferred)**: Single "Wave 8" with strict internal milestones + weekly gates. Or Calendar + basic Table in one go (if scope small).
- **Non-goals for Wave 8** (to control scope): Full server materialized recurring, advanced formulas, mobile bottom-sheet overhaul for table, pgvector for smart views, custom columns in Kanban (defer), full instance overrides.
- **Parallelizable?** Low (shared store/state/model changes).

**Effort Estimate (rough, post-approval)**: Phase 1: 4-8 focused sessions. Phase 2: 6-10. Phase 3: 10-15 + schema review. Total Wave: significant but phased.

## 5. Risks, Mitigations, Dependencies

- **Scope creep / "Notion complete"**: Mit: Strict per-phase defs + approval gates. "MVP Table" = fixed props grid with core interactions.
- **Schema / data model churn**: Mit: Additive only (JSONB for customs first). Provide migration SQL in proposal follow-up. Hybrid guards preserve old data.
- **Perf (large datasets in table/Gantt)**: Mit: Virtualization (existing patterns + react-window if added; dnd-kit scales). Engine already bounded. Profile early.
- **Mobile / PWA parity**: Mit: Design mobile-first (Agent 27 foundations: bottom sheets, gestures, FAB). Test on narrow + e2e.
- **Realtime / collab / offline for new entities (views/props)**: Mit: Follow proven hybrid + subscribe patterns (Agent 14/30/31). Views as JSON config easy.
- **Drag consistency**: Mit: Prefer dnd-kit for new surfaces; unify calendar if time.
- **Breaking existing**: Mit: Audit-first (this doc), incremental PRs (if multi-agent), full typecheck + manual + tests per phase. Demo samples updated carefully.
- **Deps**: None new recommended (stay lightweight; date-fns/dnd-kit/framer sufficient. Avoid heavy table libs if possible).
- **Tests**: Expand vitest for new pure logic (prop utils); playwright for view switches/drag.
- **Other waves**: Coordinate w/ AI (smart view suggestions), collab (shared views), admin/export (include views/props in exports).

**Blockers to start**: Only this approval. All code/tech ready.

## 6. Success Criteria & Verification (per Phase)

- **Common**: `npm run typecheck && npm run test && npm run lint && npm run dev` (manual flows + mobile sim). No regression in existing List/Kanban/Calendar/recurring/complete/drag/PWA/realtime/demo-live. Handoff MD updated + new proposal follow-up.
- **Phase 1 specific**: Day view functional + beautiful. Gantt has interactive bars + basic deps/swimlanes. All calendar drags (incl cross) intelligent. 100% of Agent 25 calendar gaps closed. "Feels full premium calendar".
- **Phase 2**: Table view in nav, renders 100+ tasks fast, all fixed props visible/editable inline, sorts/groups/filters work + combine w/ global semantic, drag in/out. "Notion-lite DB for core fields".
- **Phase 3**: Custom props creatable/usable across views (Table primary), saved views CRUD + apply (5+ examples), persist live + demo, used in calendar/table. "True Notion power + smart views".
- **Overall Wave**: Original prompt views vision + "advanced task views" goal met at high fidelity. Users can do everything in multiple beautiful surfaces w/ saved configs. Delight + speed preserved.

## 7. Next Steps (Pending Approval)

1. Agent 44 reviews this proposal → approve/reject/scope adjust (e.g. "do Phase 1 only for now", "include custom props in Phase 2", "use specific lib X").
2. On approval: Agent 48 (or sub-agents) begins **Phase 1 only** (audit-first micro-audits per file before edits; use search_replace for precision; todo lists per phase).
3. Mid-phase check-ins + final handoff per phase (following AGENT-25 style: detailed what/why/gaps).
4. Update relevant memory, README status, bad-ass-tasks-prompt if needed (minimal).
5. Coordinate w/ other active agents (e.g. via shared context).

**Files to Create/Edit in Wave (high-level, approval-dependent)**: Primarily the ones listed per phase above. Absolute paths:
- C:\Grok Build Projects\bad ass tasks\app\page.tsx
- C:\Grok Build Projects\bad ass tasks\lib\utils.ts
- C:\Grok Build Projects\bad ass tasks\store\useTaskStore.ts
- C:\Grok Build Projects\bad ass tasks\lib\data\hybridStore.ts
- C:\Grok Build Projects\bad ass tasks\supabase\schema.sql (Phase 3+)
- C:\Grok Build Projects\bad ass tasks\types\index.ts (and supabase.ts)
- C:\Grok Build Projects\bad ass tasks\components\TaskModal.tsx
- C:\Grok Build Projects\bad ass tasks\docs\AGENT-48-...-HANDOFF.md (post each phase)
- Possibly new: components/ for extracted views (to keep page.tsx manageable).

**Confidence**: High (90) — audit exhaustive, foundations rock-solid, phasing conservative per project culture.

---

**This proposal is the official submission.** 

Ready for your review, Agent 44. Approve sequencing/scope (or counter-propose), and I will execute precisely — nothing more, nothing less — starting with the agreed first phase only.

Built for bad ass productivity.  
— Agent 48

**References** (all in workspace):
- Audit sources: app/page.tsx:1656 (calendar header), 1995 (timeline comment), 1141 (tasks), 913 (renderTaskRow); lib/utils.ts:91 (engine header), 443 (generateRecurringInstances); docs/AGENT-25-RECURRING-CALENDAR-HANDOFF.md (full prior audit + gaps); docs/bad-ass-tasks-prompt.md:74 (exact vision views); supabase/schema.sql:76 (recurring cols); etc.
- Memory: Phase 1 Calendar/Recurring decisions.

(End of proposal)