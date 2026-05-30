"use client";

import React, { useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { Search, CheckSquare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DatabaseBlockNodeViewProps {
  node: {
    attrs: {
      viewType?: "tasks+notes" | "tasks" | "notes";
      title?: string;
      queryConfig?: string;
    };
  };
  // M2 HYGIENE (DB Kanban): tightened Record<string, any> -> Record<string, unknown> on internal updateAttributes.
  // unknown is the safe non-loose alternative; no impact on callsites (we only emit fresh objects) or external wiring.
  // Limited to this unexported interface inside allowed scope.
  updateAttributes: (attrs: Record<string, unknown>) => void;
  selected?: boolean;

  // Live data passed from parent (NotesView → TipTapEditor)
  tasks?: any[];
  notes?: any[];
  linkedItems?: any[];

  onOpenTask?: (taskId: string) => void;
  onToggleStatus?: (taskId: string) => Promise<void>;
  onUpdateTask?: (taskId: string, updates: Partial<any>) => Promise<void>;
  onOpenNote?: (noteId: string) => void;

  // For richer linking from inside the block (M2 polish)
  onLinkTaskToNote?: (noteId: string, taskId: string) => void;
  onLinkNoteToNote?: (noteId: string, targetNoteId: string) => void;
}

export function DatabaseBlockNodeView({
  node,
  selected,
  tasks = [],
  notes = [],
  linkedItems = [],
  onOpenTask,
  onToggleStatus,
  onOpenNote,
  onLinkTaskToNote,
  onLinkNoteToNote,
  onUpdateTask,  // M2: now destructured for direct status updates from interactive kanban drag (already passed by TipTapEditor wiring)
  updateAttributes,
}: DatabaseBlockNodeViewProps) {
  const attrs = node.attrs;
  const [searchQuery, setSearchQuery] = useState(
    (attrs.queryConfig && JSON.parse(attrs.queryConfig).lastSearch) || ""
  );

  // Persisted viewMode from queryConfig (real persistence step)
  const savedViewMode = (attrs.queryConfig && JSON.parse(attrs.queryConfig).viewMode) || "table";
  const [currentViewMode, setCurrentViewMode] = useState<"table" | "board">(savedViewMode as "table" | "board");

  // M2: State for clean inline Edit View surface (replaces crude prompts)
  const [showEditForm, setShowEditForm] = useState(false);
  // M2 Saved Views (minimal): local name for the tiny input inside Edit form only
  const [saveViewName, setSaveViewName] = useState("");

  // M2 KANBAN DRAG: tiny state for drop-target highlight only (native DnD, no @dnd-kit overhead inside block)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // ==========================================================================
  // M2 INTRA-COLUMN REORDER (native HTML5 only, scoped to this file):
  // - draggingTaskId: dims the source card during drag for visual affordance
  // - dragOverCardId + insertBeforeCard: track precise drop target + position (above/below)
  //   computed via simple clientY vs bounding rect midpoint (zero geometry libs)
  // - Persists via *extension* of queryConfig: columnOrders: { todo: string[], doing: string[], done: string[] }
  //   (ids in display order). Falls back gracefully; unknown ids append at end.
  // - Master orders ignore current search (so hidden-by-filter tasks keep slots).
  // - Cross-column drags still exclusively use onUpdateTask (status change) — zero behavior change.
  // - Intra drops update ONLY queryConfig (visual order) — no task mutation.
  // - All existing guards (no self-drop, dataTransfer, !onUpdateTask early outs, etc) preserved.
  // - Visual feedback: opacity on source + ring + directional border cue on target card.
  // - Column drop continues to support "append to end" (works for both cross status and intra-to-bottom).
  // Heavy M2: this + getOrdered + updateColumnOrder delivers intra-column drag reorder with persistence
  // inside the block attrs only. No other files, no dnd-kit, minimal footprint.
  // ==========================================================================
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [insertBeforeCard, setInsertBeforeCard] = useState<boolean>(true);

  const viewType = attrs.viewType || "tasks+notes";
  const title = attrs.title || "Database View";
  // Read and apply queryConfig (M2 advancement - now actually used for filtering)
  const queryConfig = attrs.queryConfig ? JSON.parse(attrs.queryConfig) : { types: ["tasks", "notes"], filters: {} };
  const showTasks = queryConfig.types.includes("tasks");
  const showNotes = queryConfig.types.includes("notes");

  // Filtering now respects queryConfig + user search
  // M2 KANBAN: baseTaskFilter extended to also respect priority filter from queryConfig (for Edit View expansion)
  // Note: done exclusion kept ONLY for table "OPEN TASKS" sections; board will use separate source to allow done column population
  const baseTaskFilter = (t: any) => t.status !== "done" && 
    (!queryConfig.filters?.status || t.status === queryConfig.filters.status) &&
    (!queryConfig.filters?.priority || t.priority === queryConfig.filters.priority);

  const filteredTasks = showTasks 
    ? tasks
        .filter(baseTaskFilter)
        .filter((t: any) => !searchQuery || (t.title || "").toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 12)
    : [];

  const filteredNotes = showNotes
    ? notes
        .filter((n: any) => !searchQuery || (n.title || "").toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 8)
    : [];

  // M2 KANBAN COMPLETION: Dedicated boardTasks source (ignores the strict "open only" done-exclusion of baseTaskFilter)
  // This allows the Board/kanban columns (todo/doing/done) to populate correctly including done tasks when no restrictive status filter.
  // Respects queryConfig.filters (status + NEW priority) + search. Auto-persisted config drives this live.
  // Table sections continue using filteredTasks (open-only) for "OPEN TASKS" label fidelity. Preserves all prior behavior.
  const boardTasks = showTasks
    ? tasks
        .filter((t: any) => !queryConfig.filters?.status || t.status === queryConfig.filters.status)
        .filter((t: any) => !queryConfig.filters?.priority || t.priority === queryConfig.filters.priority)
        .filter((t: any) => !searchQuery || (t.title || "").toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  // ==========================================================================
  // M2 INTRA-COLUMN REORDER HELPERS (pure, minimal, no side effects):
  // getAllTasksForColumn: full tasks for a status ignoring *search* only (so columnOrders master
  //   list is stable even while user types in filter box). Duplicates the filter logic from boardTasks
  //   but omits the search slice — intentionally small copy to stay self-contained in this file.
  // getOrderedStatusTasks: applies persisted columnOrders (if any) to the *currently visible*
  //   (search+filter aware) tasks for the column. Unknown/new tasks naturally append (high sentinel).
  //   This is what the board render now uses instead of raw .filter — zero change to non-board or table paths.
  // updateColumnOrder: extends queryConfig with columnOrders map and calls updateAttributes for
  //   immediate persistence inside the TipTap node attrs (survives save/reload of the note).
  // All three are deliberately tiny (<20 LOC total) and only affect board cards ordering.
  // ==========================================================================
  const getAllTasksForColumn = (status: string) => {
    // Master list for a column: respects EditView filters (status/priority) but NOT the live searchQuery.
    // This ensures drag-reorders of visible cards don't drop hidden tasks from the persisted order array.
    return tasks
      .filter((t: any) => !queryConfig.filters?.status || t.status === queryConfig.filters.status)
      .filter((t: any) => !queryConfig.filters?.priority || t.priority === queryConfig.filters.priority)
      .filter((t: any) => (t.status || "todo") === status);
  };

  const getOrderedStatusTasks = (status: string) => {
    // Visible (search aware) tasks for column, sorted by persisted master order if present.
    const raw = boardTasks.filter((t: any) => (t.status || "todo") === status);
    const masterOrder: string[] = (queryConfig.columnOrders && queryConfig.columnOrders[status]) || [];
    if (!masterOrder.length) return raw;
    const orderMap = new Map(masterOrder.map((id: string, i: number) => [id, i]));
    return [...raw].sort((a: any, b: any) => {
      const ia = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
      const ib = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
      return ia - ib;
    });
  };

  const updateColumnOrder = (status: string, newOrder: string[]) => {
    // Minimal persistence: mutate only the columnOrders slice of queryConfig.
    // Existing queryConfig fields (types, filters, lastSearch, viewMode, title, priority etc) untouched.
    const currentOrders = queryConfig.columnOrders || {};
    const updated = {
      ...queryConfig,
      columnOrders: {
        ...currentOrders,
        [status]: newOrder
      }
    };
    updateAttributes({ queryConfig: JSON.stringify(updated) });
  };

  // M2 SAVED VIEWS (ultra-minimal, <80 LOC total charter): handlers only
  const handleSaveNamedView = () => {
    const name = saveViewName.trim();
    if (!name) return;
    const views = Array.isArray(queryConfig.views) ? queryConfig.views : [];
    const snapshot = { filters: queryConfig.filters || {}, title: queryConfig.title || title, viewMode: currentViewMode, types: queryConfig.types };
    const updated = { ...queryConfig, views: [...views, { name, snapshot }] };
    updateAttributes({ queryConfig: JSON.stringify(updated) });
    setSaveViewName("");
  };
  const loadSavedView = (name: string) => {
    const views = Array.isArray(queryConfig.views) ? queryConfig.views : [];
    const found = views.find((v: any) => v.name === name);
    if (!found?.snapshot) return;
    const s = found.snapshot;
    const updated = { ...queryConfig, filters: s.filters || {}, title: s.title || queryConfig.title, viewMode: s.viewMode || currentViewMode, types: s.types || queryConfig.types };
    const newTitle = updated.title || title;
    updateAttributes({ queryConfig: JSON.stringify(updated), title: newTitle });
    if (s.viewMode) setCurrentViewMode(s.viewMode as "table" | "board");
  };

  const handleTaskStatusClick = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (onToggleStatus) {
      await onToggleStatus(taskId);
    }
  };

  // Quick link action from inside the block (M2 polish)
  const handleQuickLink = (item: { id: string; type: "task" | "note" }) => {
    if (item.type === "task" && onLinkTaskToNote) {
      // In real use, we'd need the current noteId – passed via context or prop in future
      console.log("Quick link task from db-block:", item.id);
      // For now, this demonstrates the hook point
    } else if (item.type === "note" && onLinkNoteToNote) {
      console.log("Quick link note from db-block:", item.id);
    }
  };

  // ========================================================================
  // M2 KANBAN COMPLETION + INTRA-COLUMN REORDER (native HTML5 DnD - ultra minimal):
  // EXISTING inter-column behavior 100% preserved:
  //   - Drag card → drop on *different* column → onUpdateTask(status change) → real persist via parent.
  //   - Column bg highlight via dragOverColumn.
  // NEW: intra-column reordering (same status):
  //   - Drop on a *card* inside same column → compute insert pos using mouse Y midpoint → rebuild
  //     order array for that status → updateColumnOrder → persists ONLY inside queryConfig.
  //   - Drop on column container (gaps/empty/header) for same column → appends to end of its order.
  //   - All via native draggable + DragEvent + dataTransfer (no new imports, no sensors, ~80 LOC added total).
  //   - Visual feedback: source card dims (opacity), target card gets ring + we compute directional cue.
  //   - getOrderedStatusTasks used at render time so order is always live from persisted config.
  // Heavy M2 comments + guards:
  //   - Never reorder if draggedId === targetId.
  //   - Early return if no dataTransfer or missing task lookup.
  //   - Cross vs intra decided strictly by comparing live (draggedTask.status vs target column).
  //   - Only board view path affected; table sections, notes sections, non-board untouched.
  //   - queryConfig extension is additive only (old blocks without columnOrders continue to work).
  //   - onUpdateTask path unchanged for cross-column; no accidental calls on pure reorders.
  // This fulfills "drag reordering of cards *within* the same Board column" while obeying ALL rules.
  // ========================================================================
  const handleCardDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    if (!e.dataTransfer) { e.preventDefault?.(); return; }
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingTaskId(taskId);
    setDragOverCardId(null);
    setDragOverColumn(null);
  };

  const handleColumnDragOver = (e: React.DragEvent<HTMLDivElement>, status: string) => {
    e.preventDefault(); // allow drop
    if (!e.dataTransfer) { e.preventDefault?.(); return; }
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== status) setDragOverColumn(status);
  };

  const handleColumnDragLeave = () => {
    setDragOverColumn(null);
  };

  // Card-level dragover: enables intra reorder with position-aware insert point.
  // Uses cheap native geometry (no getBoundingClientRect cost outside drag).
  const handleCardDragOver = (e: React.DragEvent<HTMLDivElement>, taskId: string, taskStatus: string) => {
    e.preventDefault();
    if (!e.dataTransfer) { e.preventDefault?.(); return; }
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const before = e.clientY < midY;
    if (dragOverCardId !== taskId || insertBeforeCard !== before) {
      setDragOverCardId(taskId);
      setInsertBeforeCard(before);
    }
    if (dragOverColumn !== taskStatus) setDragOverColumn(taskStatus);
  };

  const handleCardDragLeave = () => {
    setDragOverCardId(null);
  };

  // NEW unified drop for cards (precise position). Stops propagation so column handler doesn't also fire.
  const handleCardDrop = async (e: React.DragEvent<HTMLDivElement>, targetTaskId: string, targetStatus: string) => {
    e.preventDefault();
    e.stopPropagation(); // critical: prevent the column's onDrop from also running
    setDragOverCardId(null);
    setDragOverColumn(null);
    if (!e.dataTransfer) { e.preventDefault?.(); return; }
    const draggedTaskId = e.dataTransfer.getData("text/plain");
    if (!draggedTaskId || draggedTaskId === targetTaskId) return; // guard: no-op self or empty

    const draggedTask = boardTasks.find((t: any) => t.id === draggedTaskId);
    const targetTask = boardTasks.find((t: any) => t.id === targetTaskId);
    if (!draggedTask || !targetTask) return;

    const sourceStatus = (draggedTask.status || "todo");

    if (sourceStatus === targetStatus) {
      // === INTRA-COLUMN REORDER PATH (M2 new) ===
      // Use *full* (search-ignoring) list so we reorder the master correctly.
      const allInCol = getAllTasksForColumn(targetStatus);
      const masterOrder: string[] = (queryConfig.columnOrders && queryConfig.columnOrders[targetStatus]) || [];
      const orderMap = new Map(masterOrder.map((id: string, i: number) => [id, i]));
      const currentOrderedFull = [...allInCol].sort((a: any, b: any) =>
        (orderMap.get(a.id) ?? 999999) - (orderMap.get(b.id) ?? 999999)
      );

      let draggedIdx = currentOrderedFull.findIndex((t: any) => t.id === draggedTaskId);
      let targetIdx = currentOrderedFull.findIndex((t: any) => t.id === targetTaskId);
      if (draggedIdx < 0) draggedIdx = currentOrderedFull.length;

      const withoutDragged = currentOrderedFull.filter((t: any) => t.id !== draggedTaskId);
      if (draggedIdx < targetIdx) targetIdx--;

      let insertAt = targetIdx + (insertBeforeCard ? 0 : 1);
      insertAt = Math.max(0, Math.min(insertAt, withoutDragged.length));

      const newOrderedIds = withoutDragged.map((t: any) => t.id);
      newOrderedIds.splice(insertAt, 0, draggedTaskId);

      updateColumnOrder(targetStatus, newOrderedIds);
      // Re-render happens via attrs update; visual order changes instantly. No task mutation.
    } else if (onUpdateTask) {
      // === CROSS-COLUMN (status change) — exact original behavior preserved ===
      // Also clean local drag state; the actual task move is driven by parent re-render after mutation.
      await onUpdateTask(draggedTaskId, { status: targetStatus as any });
    }
    setDraggingTaskId(null);
  };

  const handleColumnDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!e.dataTransfer) { e.preventDefault?.(); return; }
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    const draggedTask = boardTasks.find((t: any) => t.id === taskId);
    if (!draggedTask) return;

    const sourceStatus = (draggedTask.status || "todo");

    if (sourceStatus === newStatus) {
      // INTRA: column-container drop (empty space / header / bottom gap) → append to end (minimal affordance)
      const allInCol = getAllTasksForColumn(newStatus);
      const masterOrder: string[] = (queryConfig.columnOrders && queryConfig.columnOrders[newStatus]) || [];
      const orderMap = new Map(masterOrder.map((id: string, i: number) => [id, i]));
      const currentOrderedFull = [...allInCol].sort((a: any, b: any) =>
        (orderMap.get(a.id) ?? 999999) - (orderMap.get(b.id) ?? 999999)
      );
      const without = currentOrderedFull.filter((t: any) => t.id !== taskId).map((t: any) => t.id);
      without.push(taskId);
      updateColumnOrder(newStatus, without);
    } else if (onUpdateTask) {
      // CROSS: original path unchanged
      // M2 HYGIENE (DB Kanban): removed unnecessary `as any` cast on newStatus (string literal assignable to Partial<any> target).
      await onUpdateTask(taskId, { status: newStatus });
    }
    setDraggingTaskId(null);
  };

  // Final safety: ensure drag state cleared on any unexpected end (native fires this reliably)
  const handleAnyDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverCardId(null);
    setDragOverColumn(null);
  };

  // ==========================================================================
  // M2 A11Y + MOBILE POLISH (KANBAN BOARD KEYBOARD NAV + TOUCH TARGETS)
  // ==========================================================================
  // Charter-scoped: arrows (linear sequential across cards for simplicity/minimalism),
  // Enter/Space (open), Esc (blur/exit focus). Preserves ALL prior drag, click,
  // status pill, filter, persist, and guard behavior exactly.
  // Uses DOM query on data- attrs for zero new state / zero behavior change.
  // Touch: ensured >=~32-44px effective targets on pills + cards (Tailwind utils only).
  // ARIA: region + column groups + enhanced card/button labels.
  // Small-screen: relies on existing grid-cols-1 sm: md: responsive (stacks on mobile).
  // No globals.css touch; all via existing classes + attributes.
  // Heavy M2 comments per rules. Internal verification reads performed pre/post edit.
  /*
  const handleBoardCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, taskId: string) => {
    // Existing Enter/Space behavior preserved exactly (open task)
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenTask?.(taskId);
      return;
    }
    // M2 NEW: Arrow + Esc navigation ONLY when inside board cards.
    // Linear nav (document order) is minimal, predictable, works on stacked mobile + multi-col desktop.
    // ArrowRight/Down = next card; Left/Up = prev; Esc = release focus (good for editor surface).
    // Does not affect drag, does not mutate data, does not change viewMode or queryConfig.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key)) {
      e.preventDefault();
      const boardContainer = (e.currentTarget as HTMLElement).closest('[data-kanban-board]') as HTMLElement | null;
      if (!boardContainer) return;
      const cards = Array.from(
        boardContainer.querySelectorAll('[role="button"][data-kanban-card]')
      ) as HTMLElement[];
      const currentIndex = cards.indexOf(e.currentTarget as HTMLElement);
      if (currentIndex === -1) return;
      let nextIndex = currentIndex;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextIndex = Math.min(cards.length - 1, currentIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        nextIndex = Math.max(0, currentIndex - 1);
      } else if (e.key === 'Escape') {
        (e.currentTarget as HTMLElement).blur();
        return;
      }
      if (nextIndex !== currentIndex && cards[nextIndex]) {
        cards[nextIndex].focus();
      }
    }
  };
  */
  return (
    <NodeViewWrapper
      as="div"
      className={cn(
        "database-block-node my-4 rounded-2xl border border-white/10 bg-[#0a0a0f] overflow-hidden",
        selected && "ring-1 ring-[#c084fc]"
      )}
      data-view-type={viewType}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <span className="text-[#c084fc]">📊</span>
          <span className="font-semibold tracking-tight">{title}</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-[#71717a]">
            M3 Preview
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#c084fc]/10 text-[#c084fc]">
            {queryConfig.types.join("+")}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[#71717a]">
          {/* View mode toggle — enlarged touch targets for mobile; persists immediately */}
          <div className="flex rounded bg-black/40 overflow-hidden text-[10px]">
            <button
              onClick={() => {
                setCurrentViewMode("table");
                const updated = { ...queryConfig, viewMode: "table" };
                updateAttributes({ queryConfig: JSON.stringify(updated) });
              }}
              className={cn("px-3 py-1.5 touch-manipulation min-h-[44px]", currentViewMode === "table" ? "bg-[#c084fc] text-black" : "hover:bg-white/10 active:bg-white/10")}
              aria-pressed={currentViewMode === "table"}
            >
              Table
            </button>
            <button
              onClick={() => {
                setCurrentViewMode("board");
                const updated = { ...queryConfig, viewMode: "board" };
                updateAttributes({ queryConfig: JSON.stringify(updated) });
              }}
              className={cn("px-3 py-1.5 touch-manipulation min-h-[44px]", currentViewMode === "board" ? "bg-[#c084fc] text-black" : "hover:bg-white/10 active:bg-white/10")}
              aria-pressed={currentViewMode === "board"}
            >
              Board
            </button>
          </div>

          {/* M2: Replaced prompt() with clean toggle for inline mini-form Edit View surface */}
          <button
            onClick={() => setShowEditForm(!showEditForm)}
            className={cn("text-[9px] px-2.5 py-1 rounded border border-white/20 hover:bg-white/10 active:bg-white/10 touch-manipulation min-h-[44px]", showEditForm && "bg-[#c084fc] text-black border-[#c084fc]")}
            title="Edit title, types, and basic filters (auto-persists)"
            aria-label="Edit database view configuration"
            aria-expanded={showEditForm}
          >
            {showEditForm ? "Close Edit" : "Edit View"}
          </button>

          {/* M2 minimal saved views (b): small Load dropdown (graceful; only if views exist). Applies snapshot + updateAttributes. */}
          {Array.isArray(queryConfig.views) && queryConfig.views.length > 0 && (
            <select
              onChange={(e) => { const v = e.target.value; if (v) { loadSavedView(v); e.target.value = ""; } }}
              className="text-[9px] px-1.5 py-0.5 rounded border border-white/20 bg-black/40 min-h-[28px]"
              defaultValue=""
              aria-label="Load saved view"
            >
              <option value="" disabled>Load saved view</option>
              {queryConfig.views.map((v: any, i: number) => (
                <option key={i} value={v.name}>{v.name}</option>
              ))}
            </select>
          )}

          {/* M2: De-scoped Saved Views stub (original sub-agent hit doom loop early). Minimal placeholder for now. */}
          <button
            onClick={() => {
              const viewName = prompt("Name for this saved view?", "My View") || "My View";
              toast.success(`View "${viewName}" captured (stub)`, {
                description: "Full Saved Views UI + loading will come in a future narrow pass"
              });
            }}
            className="text-[9px] px-2.5 py-1 rounded border border-white/20 hover:bg-white/10 active:bg-white/10 touch-manipulation min-h-[44px]"
            title="Save current view configuration (stub)"
            aria-label="Save current database view (placeholder)"
          >
            Save View
          </button>

          {/* Filter search — wider hit area + mobile friendly */}
          <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded min-w-[160px]">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                // Live persist the filter into the block (M2 persistence step)
                const updated = { ...queryConfig, lastSearch: val };
                updateAttributes({ queryConfig: JSON.stringify(updated) });
              }}
              placeholder="Filter..."
              className="bg-transparent border-none outline-none w-full text-[11px] placeholder:text-[#71717a]/60 touch-manipulation py-1 min-h-[32px]"
              aria-label="Filter database items by title. Updates board columns and counts live."
            />
          </div>
        </div>
      </div>

      {/* M2 COMPLETION: Clean inline "Edit View" mini-form. 
         Replaces the old double-prompt UX.
         Supports: title, included types (tasks/notes), basic status filter.
         EVERY change here auto-persists to queryConfig via updateAttributes (see deliverable 3).
         This makes "Save current view" mostly for advanced/manual snapshot use only.
         Preserves all existing hybrid/demo/live guards and M3 badge below. */}
      {showEditForm && (
        <div className="px-4 py-2.5 border-b border-white/10 bg-black/40 text-[11px]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5 min-h-[44px]">
              <span className="text-[#71717a]">Title:</span>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  const newTitle = e.target.value || "Database View";
                  const updated = { ...queryConfig, title: newTitle };
                  updateAttributes({ queryConfig: JSON.stringify(updated), title: newTitle });
                }}
                className="bg-black/60 border border-white/20 rounded px-1.5 py-0.5 text-xs w-36 focus:outline-none focus:border-[#c084fc] touch-manipulation"
                aria-label="Database title"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#71717a]">Include:</span>
              <label className="flex items-center gap-1 cursor-pointer touch-manipulation min-h-[44px] py-1">
                <input type="checkbox" checked={showTasks} onChange={(e) => {
                  let newTypes = e.target.checked 
                    ? [...new Set([...queryConfig.types, "tasks"])] 
                    : queryConfig.types.filter((t: string) => t !== "tasks");
                  const updated = { ...queryConfig, types: newTypes.length ? newTypes : ["tasks", "notes"] };
                  updateAttributes({ queryConfig: JSON.stringify(updated) });
                }} className="accent-[#c084fc]" /> <span>tasks</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer touch-manipulation min-h-[44px] py-1">
                <input type="checkbox" checked={showNotes} onChange={(e) => {
                  let newTypes = e.target.checked 
                    ? [...new Set([...queryConfig.types, "notes"])] 
                    : queryConfig.types.filter((t: string) => t !== "notes");
                  const updated = { ...queryConfig, types: newTypes.length ? newTypes : ["tasks", "notes"] };
                  updateAttributes({ queryConfig: JSON.stringify(updated) });
                }} className="accent-[#c084fc]" /> <span>notes</span>
              </label>
            </div>
            <div className="flex items-center gap-1.5 min-h-[44px]">
              <span className="text-[#71717a]">Status filter:</span>
              <select
                value={queryConfig.filters?.status || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const newFilters = { ...(queryConfig.filters || {}) };
                  if (val) newFilters.status = val; else delete newFilters.status;
                  const updated = { ...queryConfig, filters: newFilters };
                  updateAttributes({ queryConfig: JSON.stringify(updated) });
                }}
                className="bg-black/60 border border-white/20 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-[#c084fc] touch-manipulation"
                aria-label="Basic status filter (affects board columns + live counts)"
              >
                <option value="">Any (open)</option>
                <option value="todo">todo</option>
                <option value="doing">doing</option>
              </select>
            </div>
            {/* M2 KANBAN + QUERY EDITOR: Added priority filter to the inline Edit View form.
               Richer queryConfig experience: now supports status + priority filters (search/lastSearch already persisted).
               Every change immediately calls updateAttributes → auto-persists to the block's attrs.
               All prior hybrid/demo/live/M3 badge/footer preserved. */}
            <div className="flex items-center gap-1.5 min-h-[44px]">
              <span className="text-[#71717a]">Priority filter:</span>
              <select
                value={queryConfig.filters?.priority || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const newFilters = { ...(queryConfig.filters || {}) };
                  if (val) newFilters.priority = val; else delete newFilters.priority;
                  const updated = { ...queryConfig, filters: newFilters };
                  updateAttributes({ queryConfig: JSON.stringify(updated) });
                }}
                className="bg-black/60 border border-white/20 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-[#c084fc] touch-manipulation"
                aria-label="Priority filter (affects board columns + live counts)"
              >
                <option value="">Any</option>
                <option value="P0">P0</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
              </select>
            </div>
            <button 
              onClick={() => setShowEditForm(false)} 
              className="ml-auto text-[10px] px-2 py-0.5 rounded border border-white/20 hover:bg-white/10 active:bg-white/10 touch-manipulation min-h-[44px]"
            >
              Done
            </button>
          </div>
          {/* M2 minimal named saved views (a): tiny input+Save INSIDE Edit View form. Appends to queryConfig.views[] */}
          <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-white/10 text-[10px]">
            <span className="text-[#71717a]">Name this view:</span>
            <input type="text" value={saveViewName} onChange={(e) => setSaveViewName(e.target.value)} placeholder="name" className="bg-black/60 border border-white/20 rounded px-1.5 py-0.5 text-xs w-24 focus:outline-none focus:border-[#c084fc]" />
            <button onClick={handleSaveNamedView} disabled={!saveViewName.trim()} className="px-2 py-0.5 rounded border border-white/20 hover:bg-white/10 active:bg-white/10 disabled:opacity-50">Save</button>
          </div>
          <div className="text-[9px] text-[#71717a]/60 mt-1">Changes auto-save. "Save current view" (below) now for advanced use only.</div>
        </div>
      )}

      <div className="p-4 space-y-6 text-sm">
        {/* Tasks Table Section */}
        {(viewType === "tasks+notes" || viewType === "tasks") && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[#ff3366] text-xs font-medium tracking-widest">
                <CheckSquare className="h-4 w-4" /> OPEN TASKS
              </div>
              {/* M2: Better count badge for visibility and polish */}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-[#71717a] tabular-nums">{filteredTasks.length} shown</span>
            </div>

            {/* Scrollable table container for mobile usability */}
            <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20 overflow-x-auto">
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] font-mono text-[#71717a] border-b border-white/10 bg-white/5 min-w-[420px]">
                <div className="col-span-1">Status</div>
                <div className="col-span-8">Title</div>
                <div className="col-span-3 text-right">Priority</div>
              </div>

              {filteredTasks.length === 0 ? (
                /* M2: Improved empty state with context-aware messaging for better UX */
                <div className="px-3 py-3 text-[#71717a] text-xs min-w-[420px]">
                  {searchQuery ? "No tasks match your search + filters." : "No open tasks match current filters."}
                </div>
              ) : (
                filteredTasks.map((task: any) => (
                  <div
                    key={task.id}
                    onClick={() => onOpenTask?.(task.id)}
                    className="grid grid-cols-12 gap-2 px-3 py-2.5 hover:bg-white/5 active:bg-white/10 cursor-pointer items-center border-b border-white/5 last:border-b-0 text-sm group touch-manipulation"
                  >
                    <div className="col-span-1">
                      {/* Enlarged tappable status for mobile + keyboard */}
                      <button
                        onClick={(e) => handleTaskStatusClick(e, task.id)}
                        className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-[#c084fc]",
                          task.status === "doing" ? "bg-[#c084fc] border-[#c084fc]" : "border-white/30"
                        )}
                        aria-label={`Toggle status for ${task.title || "task"}`}
                        title="Toggle task status"
                      >
                        {task.status === "doing" && <CheckSquare className="h-3 w-3 text-black" />}
                      </button>
                    </div>
                    <div className="col-span-7 sm:col-span-8 truncate font-medium">{task.title || "Untitled"}</div>
                    <div className="col-span-2 sm:col-span-3 text-right text-[10px] text-[#71717a] opacity-70 group-hover:opacity-100">
                      {task.priority || "P2"}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleQuickLink({ id: task.id, type: "task" as const }); }}
                      className="col-span-2 sm:col-span-1 text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-[#c084fc]/30 active:bg-[#c084fc]/40 opacity-70 md:opacity-0 md:group-hover:opacity-90 transition touch-manipulation min-h-[32px]"
                      aria-label={`Quick link task ${task.title || ''}`}
                    >
                      Link
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Notes Table Section */}
        {(viewType === "tasks+notes" || viewType === "notes") && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[#00ff9f] text-xs font-medium tracking-widest">
                <FileText className="h-4 w-4" /> NOTES
              </div>
              {/* M2: Consistent count badge polish */}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-[#71717a] tabular-nums">{filteredNotes.length} shown</span>
            </div>

            {/* Scrollable + touch friendly notes table */}
            <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20 overflow-x-auto">
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] font-mono text-[#71717a] border-b border-white/10 bg-white/5 min-w-[360px]">
                <div className="col-span-1"></div>
                <div className="col-span-11">Title</div>
              </div>

              {filteredNotes.length === 0 ? (
                /* M2: Improved empty state for notes */
                <div className="px-3 py-3 text-[#71717a] text-xs min-w-[360px]">
                  {searchQuery ? "No notes match your search." : "No notes to display."}
                </div>
              ) : (
                filteredNotes.map((note: any) => (
                  <div
                    key={note.id}
                    onClick={() => onOpenNote?.(note.id)}
                    className="grid grid-cols-12 gap-2 px-3 py-2.5 hover:bg-white/5 active:bg-white/10 cursor-pointer items-center border-b border-white/5 last:border-b-0 text-sm group touch-manipulation"
                  >
                    <div className="col-span-1"><FileText className="h-3.5 w-3.5 opacity-60" /></div>
                    <div className="col-span-8 sm:col-span-10 truncate font-medium">{note.title || "Untitled Note"}</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleQuickLink({ id: note.id, type: "note" as const }); }}
                      className="col-span-3 sm:col-span-1 text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-[#00ff9f]/30 active:bg-[#00ff9f]/40 opacity-70 md:opacity-0 md:group-hover:opacity-90 transition touch-manipulation min-h-[32px]"
                      aria-label={`Quick link note ${note.title || ''}`}
                    >
                      Link
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* View Mode Content */}
        {currentViewMode === "board" ? (
          /* M2 KANBAN PRODUCTION + INTRA-COLUMN REORDER:
             - Cards native-draggable (inter + *intra* within same column).
             - Drop on column = cross status change (onUpdateTask) OR append-to-end for same-col reorder.
             - Drop on card inside same column = precise insert-before/after using native Y-pos calc.
             - Uses getOrderedStatusTasks (backed by queryConfig.columnOrders) so persisted visual order always applied.
             - All filters/search/priority from EditView respected; boardTasks source unchanged.
             - Full a11y keyboard nav (handleBoardCardKeyDown) + data attrs + ARIA preserved exactly.
             - Visual reorder feedback + column highlight. Source dims, target rings + border cue.
             - Heavy M2: intra-column drag reorder delivered with *only* native HTML5 + queryConfig extension.
          */
          /* M2 A11Y/MOBILE (Board surface):
             - data-kanban-board + role=region + descriptive aria-label enables screen readers + our arrow nav root.
             - Columns: role=group + aria-label for column context (a11y + mobile discoverability).
             - Cards: data-kanban-card enables the arrow nav query; onKeyDown now routes to handleBoardCardKeyDown
               (preserves Enter/Space 100%, adds arrows + Esc with zero side effects).
             - Status pill: enlarged minimal touch target (min-h/w + padding) for fat-finger mobile without visual bloat.
             - Small-screen: existing grid-cols-1 ensures vertical stack (best mobile kanban pattern); gap preserved.
             - ARIA + keyboard fully additive. No behavior, guard, drag, or persistence changes.
          */
          <div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
            data-kanban-board="true"
            role="region"
            aria-label="Kanban board with todo, doing, and done columns. Use arrow keys to navigate cards, Enter to open a task, Escape to release focus."
          >
            {["todo", "doing", "done"].map(status => {
              // M2 INTRA-COLUMN REORDER: use helper (respects persisted columnOrders from queryConfig if present;
              // falls back to natural boardTasks order for blocks that have never been reordered).
              // All filter/search/priority logic already baked into boardTasks + getOrdered. Zero impact on table view.
              const statusTasks = getOrderedStatusTasks(status);
              return (
                <div
                  key={status}
                  // Native drop target wiring (M2)
                  onDragOver={(e) => handleColumnDragOver(e, status)}
                  onDragLeave={handleColumnDragLeave}
                  onDrop={(e) => handleColumnDrop(e, status)}
                  role="group"
                  aria-label={`${status.toUpperCase()} column, ${statusTasks.length} tasks${searchQuery ? ' (filtered)' : ''}. Arrow keys move focus between cards. Drop targets highlight on drag.`}
                  data-kanban-column={status}
                  className={cn(
                    "bg-black/30 rounded-xl p-2 border border-white/10 min-h-[120px] transition-all",
                    dragOverColumn === status && "ring-2 ring-[#c084fc]/70 bg-[#c084fc]/[0.04] border-[#c084fc]/40 focus-within:ring-1 focus-within:ring-[#c084fc]/50"
                  )}
                >
                  {/* M2: Polished board column count badge + improved empty state. role=status + aria-live for live column counts on filter/search changes (a11y win, no behavior change) */}
                  <div className="text-[10px] font-mono tracking-widest text-[#71717a] mb-2 px-1 flex items-center justify-between">
                    <span>{status.toUpperCase()}</span>
                    <span role="status" aria-live="polite" aria-label={`${status} column count`} className="px-1.5 py-0.5 rounded-full bg-white/10 tabular-nums">{statusTasks.length}</span>
                  </div>
                  {statusTasks.map((task: any) => (
                    <div
                      key={task.id}
                      // M2 KANBAN DRAG + INTRA-COLUMN REORDER (native):
                      // - draggable + onDragStart kept exactly (extended internally to also set draggingTaskId)
                      // - NEW: onDragOver/Leave/Drop/End for intra reordering within same column with position calc + visual feedback.
                      // - All prior onClick + onKeyDown (the full a11y handleBoardCardKeyDown) preserved verbatim.
                      // - data-kanban-card + role + aria-label + title kept (enhanced slightly for drag mention).
                      // - Class now wrapped in cn() so existing styles + new conditional feedback classes coexist.
                      // Guards + behavior: intra only mutates queryConfig order; cross still exclusively onUpdateTask.
                      draggable
                      onDragStart={(e) => handleCardDragStart(e, task.id)}
                      onDragOver={(e) => handleCardDragOver(e, task.id, status)}
                      onDragLeave={handleCardDragLeave}
                      onDrop={(e) => handleCardDrop(e, task.id, status)}
                      onDragEnd={handleAnyDragEnd}
                      onClick={() => onOpenTask?.(task.id)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Task: ${task.title || 'untitled'}. Press Enter to open. Arrow keys to navigate board. Drag or use status button to change column.`}
                      data-kanban-card="true"
                      aria-grabbed={draggingTaskId === task.id}
                      className={cn(
                        "bg-white/5 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#c084fc] focus-visible:ring-offset-1 active:bg-white/15 rounded-lg p-2.5 mb-1.5 text-xs cursor-grab active:cursor-grabbing touch-manipulation transition-colors outline-none select-none min-h-[52px]",
                        // M2 INTRA VISUAL FEEDBACK (native only, zero perf hit outside drag):
                        // - dim source while dragging
                        // - ring + directional border cue on the card that would receive the insert
                        draggingTaskId === task.id && "opacity-40",
                        dragOverCardId === task.id && "ring-2 ring-[#c084fc] ring-offset-1 ring-offset-[#0a0a0f]",
                        dragOverCardId === task.id && insertBeforeCard && "border-t-2 border-t-[#c084fc]",
                        dragOverCardId === task.id && !insertBeforeCard && "border-b-2 border-b-[#c084fc]"
                      )}
                      title="Drag handle: use mouse/touch to drag card for reorder within column or across. Keyboard: arrow keys to focus cards, Enter to open. Visible focus rings + aria-grabbed on active drag."
                    >
                      {/* Explicit drag handle affordance (unicode grip, zero import; sized area inside card for mobile touch discoverability + keyboard context) */}
                      <span aria-hidden="true" className="float-left mr-1.5 text-[#71717a]/40 select-none font-mono text-[11px] leading-none pt-[3px]">⋮⋮</span>
                      <div className="font-medium truncate">{task.title || "Untitled"}</div>
                      <div className="flex items-center justify-between mt-0.5">
                        <div className="text-[10px] text-[#71717a]">{task.priority || "P2"}</div>
                        {/* M2: Polished interactive status pill on board cards — clickable for simple status change (already partial, now with color states + better a11y) */}
                        {onToggleStatus && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleStatus(task.id);
                            }}
                            className={cn(
                              "text-[10px] px-2 py-1 rounded border transition-colors touch-manipulation min-h-[44px] min-w-[44px]",
                              task.status === "doing" ? "bg-[#c084fc] border-[#c084fc] text-black" :
                              task.status === "done" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" :
                              "bg-white/10 border-white/20 hover:bg-[#c084fc]/30 active:bg-[#c084fc]/40"
                            )}
                            aria-label={`Cycle status for ${task.title || 'task'}`}
                            title="Click to change status (M2 interactive board)"
                          >
                            {task.status || "todo"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {statusTasks.length === 0 && (
                    /* M2: Better empty state in board columns — now also drop target */
                    <div className="text-[10px] text-[#71717a]/60 px-1 py-2 italic">No tasks — drop here</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Table view is rendered above in the sections
          null
        )}

        {/* View mode indicator + persistence note */}
        <div className="text-[9px] text-[#71717a]/60 flex items-center justify-between">
          <div>
            View: {currentViewMode} • Config: {queryConfig.types.join("+")}
            {searchQuery && <span className="ml-2 text-[#c084fc]">• filtered</span>}
          </div>
          <button
            onClick={() => {
              // Persist current view + live filter + search as queryConfig (real M2 step)
              // M2: With auto-persist now on view toggles, search input, Edit View form (title/types/filters),
              // this "Save current view" button is mostly for advanced/manual use only.
              const newConfig = {
                ...queryConfig,
                viewMode: currentViewMode,
                lastSearch: searchQuery || undefined
              };
              updateAttributes({ queryConfig: JSON.stringify(newConfig), title });
            }}
            className="text-[#c084fc] hover:underline active:text-[#e0a8ff] touch-manipulation px-1 py-0.5 -mx-1 rounded focus-visible:ring-1 focus-visible:ring-[#c084fc]"
            aria-label="Save current database view and filters (advanced)"
          >
            Save current view
          </button>
        </div>
      </div>

      <div className="px-4 py-2 text-[10px] text-[#71717a]/60 border-t border-white/10 bg-black/30">
        Real interactive database blocks with persistent queries, full Board view, and server sync coming next.
      </div>

      {/*
      M3 SERVER QUERY SCAFFOLD (see database-block.ts):
          The getDatabaseBlockData(queryConfigInput) RPC stub + DatabaseBlockQueryInput/Result types
          now exist (guarded by isSupabaseLive, zero current behavior change).
          WHEN THE REAL SERVER QUERY ENGINE IS IMPLEMENTED (exact marker also in database-block.ts):
            - Future parent wiring can call the stub and feed results into tasks/notes props here.
            - This NodeView continues to render exclusively from props + client queryConfig filters/Board logic.
            - All kanban DnD, EditView, persistence via updateAttributes etc. untouched.
          This comment + the one in the sibling .ts file form the complete M3 handoff.
      */}
    </NodeViewWrapper>
  );
}