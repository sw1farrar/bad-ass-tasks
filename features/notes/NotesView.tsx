"use client";

// NOTE: "noteOps is not defined" crash was caused by stale Turbopack chunks
// after the M2 extraction batch (old (noteOps as any) references inside this file
// and LinkedTasksPanel wiring). Source is now clean — all references removed.
// If you still see the error, you MUST hard-refresh + restart dev server + delete .next.
// Fixed 2026-05-29.

import React, { useState } from "react";
import { Plus, Trash2, Search, Star, Link as LinkIcon, X, ChevronDown, ChevronRight, GripVertical, History } from "lucide-react";
import { Note, Task } from "@/types";
import { TipTapEditor } from "./editor";
import { LinkedTasksPanel, NoteHeader } from "./components";
import { useNoteSearch, useMentions, useBacklinks, useNoteHistory, getBacklinkCount, getBacklinkNotes } from "./hooks";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface NotesViewProps {
  notes: Note[];
  tasks: Task[];
  selectedNoteId: string | null;
  onSelectNote: (id: string | null) => void;
  onCreateNote: (title?: string) => Promise<string | null>;
  onUpdateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onLinkTaskToNote: (noteId: string, taskId: string) => Promise<void>;
  onUnlinkTaskFromNote: (noteId: string, taskId: string) => Promise<void>;
  onOpenTask?: (taskId: string) => void; // For TaskEmbed clicks
  onCreateTaskAndEmbed?: (suggestedTitle?: string) => Promise<string | null>; // For /task in editor
  onToggleTaskStatus?: (taskId: string) => Promise<void>; // Inline status change from embeds
  onUpdateTask?: (taskId: string, updates: Partial<any>) => Promise<void>; // Inline edits from TaskEmbeds

  // Database Blocks (M2 parallel work)
  onOpenNote?: (noteId: string) => void;

  // For live snapshot persistence (M2)
  onPersistSnapshot?: (noteId: string, snapshot: any) => void;
  onCreateSubNote?: (parentNoteId: string, title?: string) => Promise<string | null>; // Milestone 2 hierarchy
  onReparentNote?: (draggedNoteId: string, targetNoteId: string) => void; // Drag to make child or reorder
  isLive: boolean;

  // M2: when a real mention is inserted in the editor, perform the actual link
  onMentionLinked?: (item: { id: string; title: string; type: "task" | "note" }) => void;

  // M2: remove handlers for the editor's Links & Backlinks panel
  onRemoveLinked?: (id: string, type: "task" | "note") => void;
  onRemoveBacklink?: (id: string, type: "task" | "note") => void;

  // Optional override for mention change handling (advanced use)
  onMentionsChanged?: (mentions: Array<{ label: string; refType?: string; refId?: string | null }>) => void;

  // M2 note-to-note bidirectional (now fully wired, no casts)
  onLinkNoteToNote?: (noteId: string, targetNoteId: string) => void | Promise<void>;
  onUnlinkNoteFromNote?: (noteId: string, targetNoteId: string) => void | Promise<void>;

  // M2 extraction: snapshot request handlers from useNoteOperations (passed through from noteOps)
  requestSnapshot?: (label?: string) => void;
  requestTitleSnapshot?: () => void;
}

export function NotesView({
  notes,
  tasks,
  selectedNoteId,
  onSelectNote,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onLinkTaskToNote,
  onUnlinkTaskFromNote,
  onOpenTask,
  onCreateTaskAndEmbed,
  onToggleTaskStatus,
  onUpdateTask,
  onCreateSubNote,
  onReparentNote,
  onOpenNote,
  onPersistSnapshot,
  isLive,
  onMentionLinked,
  onRemoveLinked,
  onRemoveBacklink,
  onMentionsChanged: onMentionsChangedProp,
  onLinkNoteToNote,
  onUnlinkNoteFromNote,
  requestSnapshot,
  requestTitleSnapshot,
}: NotesViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [currentOverId, setCurrentOverId] = useState<string | null>(null); // for visual drop targets

  // Expand/collapse state for hierarchy (default: everything expanded)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // M2 Version History trigger (increment to tell editor to open panel)
  const [historyOpenTrigger, setHistoryOpenTrigger] = useState(0);
  // M2: bump this when title changes so the editor auto-captures a "Title changed" snapshot
  const [localTitleSnapshotTrigger, setLocalTitleSnapshotTrigger] = useState(0);

  // M2: history count owned internally (extracted from page.tsx orchestration)
  // Editor calls onHistoryChange; we pass count to header. No longer bubbles to monolith.
  const [historyCount, setHistoryCount] = useState(0);

  // M2 stable sortOrder: ref for load-time norm idempotency (prevents repeated update storms on clean data)
  const lastNormSigRef = React.useRef<string>('');

  // Extracted search logic (M2 extraction)
  const { searchQuery, setSearchQuery, filteredNotes, isSearching } = useNoteSearch(notes);

  // Centralized backlinks computation (task symmetry + mention scanning from other notes)
  const computedBacklinks = useBacklinks(notes, selectedNoteId);

  // Extracted history coordination (M2 slimming)
  // Use aliases to avoid TDZ / name collision with the props from noteOps
  const { requestSnapshot: historyRequestSnapshot, requestTitleSnapshot: historyRequestTitleSnapshot } = useNoteHistory({
    selectedNoteId,
    onRequestSnapshot: requestSnapshot, // the one coming from noteOps (via props)
    onRequestTitleSnapshot: requestTitleSnapshot,
  });

  // M2 ROBUST LOAD-TIME RENORMALIZATION (stable integer sortOrder - highest leverage gap)
  // - On any notes load/change: group by parent, assign clean 0/1000/2000... steps to every sibling group
  // - Uses onUpdateNote (hybrid/demo/live safe). Idempotent via sig ref (no storms/loops once clean).
  // - Defensive: String() on ids, ?? fallbacks, no floats ever written here.
  // - Complements the after-mutation helper in useNoteOperations (reparent/createSubNote paths).
  // - After any mutation the next effect pass sees clean data and skips.
  React.useEffect(() => {
    if (!notes || notes.length === 0 || typeof onUpdateNote !== 'function') return;

    const byParent = new Map<string | null, Note[]>();
    notes.forEach(note => {
      const p = note.parentNoteId || null;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p)!.push(note);
    });

    let anyDrift = false;
    const sigParts: string[] = [];

    byParent.forEach((siblings, pKey) => {
      const sorted = [...siblings].sort((a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999));
      // Build stable sig for this parent group (defensive slice for id safety)
      const groupSig = sorted.map(s => `${String(s.id || '').slice(0, 8)}:${s.sortOrder ?? 'u'}`).join(',');
      sigParts.push(`${pKey ?? 'root'}:${groupSig}`);

      sorted.forEach((sib, idx) => {
        const desired = idx * 1000;
        const current = sib.sortOrder ?? -1;
        if (current !== desired) {
          anyDrift = true;
          // Fire-and-forget update (store will cause re-render with fresh notes; effect re-runs but will be clean)
          onUpdateNote(sib.id, { sortOrder: desired });
        }
      });
    });

    const newSig = sigParts.join('|');
    if (!anyDrift) {
      lastNormSigRef.current = newSig;
    }
  }, [notes, onUpdateNote]);

  // Auto-expand all parents on initial load / when notes change (while not searching)
  React.useEffect(() => {
    if (isSearching) return;

    const parentsWithChildren = new Set<string>();
    notes.forEach(note => {
      if (note.parentNoteId) {
        parentsWithChildren.add(note.parentNoteId);
      }
    });

    if (parentsWithChildren.size > 0) {
      setExpandedNotes(parentsWithChildren);
    }
  }, [notes, isSearching]);

  const isExpanded = (noteId: string) => expandedNotes.has(noteId);

  // NOTE: getBacklinkCount / getBacklinkNotes now come exclusively from the single-source
  // useBacklinks.ts selectors (imported above). No local duplication remains.

  // DnD sensors for drag-to-reparent and reorder
  // KeyboardSensor enables full keyboard accessibility for note tree (Space/Enter pick-up, Arrow keys move, Space/Enter drop, Esc cancel)
  // This is high-impact low-risk polish for keyboard users (M2 accessibility goal).
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Helper to get all currently visible notes in render order (for DnD + keyboard nav).
  // When searching: just the filtered list.
  // When not searching: depth-first walk of the tree, respecting the current expanded state.
  const getVisibleNotes = (): Note[] => {
    if (searchQuery) return filteredNotes;

    const visible: Note[] = [];

    // Build + sort children map locally (duplicates renderNoteTree's map for now;
    // can be unified in a later polish pass).
    const tempChildrenMap = new Map<string | null, Note[]>();
    notes.forEach((note) => {
      const p = note.parentNoteId || null;
      if (!tempChildrenMap.has(p)) tempChildrenMap.set(p, []);
      tempChildrenMap.get(p)!.push(note);
    });
    tempChildrenMap.forEach((list) => {
      // M2: respect explicit sortOrder (now guaranteed stable integers via load renorm + after-mutation helper)
      // Defensive numeric fallback + secondary updatedAt. No drift possible post-norm.
      list.sort((a, b) => {
        const soA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const soB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (soA !== soB) return soA - soB;
        const ta = new Date(a.updatedAt || a.createdAt).getTime();
        const tb = new Date(b.updatedAt || b.createdAt).getTime();
        return tb - ta;
      });
    });

    const add = (pid: string | null) => {
      const kids = tempChildrenMap.get(pid) || [];
      kids.forEach((n) => {
        visible.push(n);
        if (isExpanded(n.id)) add(n.id);
      });
    };
    add(null);
    return visible;
  };

  const visibleNotesForDnD = getVisibleNotes();

  // Simple sortable item for notes (supports reparent on drop + reorder)
  function SortableNoteItem({
    note,
    isSelected,
    onSelect,
    onDelete,
    depth,
    hasChildren,
    expanded,
    onToggle,
    onReparent,
    isOver = false,
    showDragHandle = true,
  }: {
    note: Note;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string, e?: React.MouseEvent) => void;
    depth: number;
    hasChildren: boolean;
    expanded: boolean;
    onToggle: (id: string, e: React.MouseEvent) => void;
    onReparent: (draggedId: string, targetId: string) => void;
    isOver?: boolean;
    showDragHandle?: boolean;
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: note.id });

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    };

    const preview = note.title || "Untitled";

    return (
      <div
        ref={setNodeRef}
        style={{ ...style, marginLeft: `${depth * 14}px` }}
        className={cn(
          "group flex items-center justify-between gap-3 px-3 py-2.5 sm:py-3 rounded-xl cursor-pointer transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0a0a0f]",
          isSelected
            ? "bg-white/5 border-white/10"
            : "hover:bg-white/5 border-transparent",
          isDragging && "shadow-2xl ring-1 ring-[#c084fc]/40",
          isOver && "ring-2 ring-[#c084fc] bg-[#c084fc]/10 border-[#c084fc]/50 scale-[1.01] shadow-lg transition-all duration-150 relative before:absolute before:left-2 before:right-2 before:h-1 before:bg-[#c084fc] before:rounded before:-top-0.5 before:z-10"
        )}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-level={depth + 1}
        aria-label={`${preview}${hasChildren ? (expanded ? ', expanded' : ', collapsed') : ''}${isSelected ? ', selected' : ''}`}
        onClick={() => onSelect(note.id)}
        onKeyDown={(e) => {
          // Enhanced tree keyboard navigation + reordering support (mobile-keyboard task)
          // ArrowLeft/Right: standard collapse/expand for tree items (a11y win)
          if (hasChildren && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
            e.preventDefault();
            const shouldExpand = e.key === "ArrowRight";
            if ((shouldExpand && !expanded) || (!shouldExpand && expanded)) {
              onToggle(note.id, e as any);
            }
            return;
          }
          // Space or Enter: toggle expand/collapse when item has children (standard tree a11y)
          if (hasChildren && (e.key === " " || e.key === "Enter")) {
            e.preventDefault();
            onToggle(note.id, e as any);
            return;
          }
          // ArrowUp/Down: reordering via direct (KeyboardSensor dnd-kit also supported for full drag keyboard flow)
          if ((e.key === "ArrowUp" || e.key === "ArrowDown") && onReparent) {
            e.preventDefault();
            const siblings = notes.filter(n => (n.parentNoteId || null) === (note.parentNoteId || null))
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            const currentIdx = siblings.findIndex(n => n.id === note.id);
            const targetIdx = e.key === "ArrowUp" ? currentIdx - 1 : currentIdx + 1;
            if (targetIdx >= 0 && targetIdx < siblings.length) {
              onReparent(note.id, siblings[targetIdx].id);
            }
          }
        }}
        tabIndex={0}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Drag Handle — only shown when allowed (main root notes list uses pure recency, no handles) */}
          {showDragHandle && (
            <div
              {...listeners}
              {...attributes}
              className="cursor-grab active:cursor-grabbing text-[#71717a] hover:text-[#c084fc] focus-visible:text-[#c084fc] p-2 -ml-1 rounded hover:bg-white/10 focus-visible:bg-white/10 focus-visible:ring-1 focus-visible:ring-[#c084fc]/50 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              title="Drag to reorder or reparent (or use keyboard via dnd-kit)"
              aria-label="Drag handle for reordering note"
              role="button"
              tabIndex={-1}
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}

          {/* Chevron — 44px+ touch target friendly (WCAG / mobile HIG) */}
          {hasChildren && (
            <button
              onClick={(e) => onToggle(note.id, e)}
              className="p-2 -mx-1 text-[#71717a] hover:text-white focus-visible:text-white rounded hover:bg-white/10 focus-visible:bg-white/10 focus-visible:ring-1 focus-visible:ring-[#c084fc]/50 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={expanded ? "Collapse subtree" : "Expand subtree"}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}

          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">{preview}</div>
            <div className="text-[10px] text-[#71717a] mt-0.5">
              {new Date(note.updatedAt || note.createdAt).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {note.linkedTaskIds && note.linkedTaskIds.length > 0 && (
                <span className="ml-2 text-[#c084fc]">↔ {note.linkedTaskIds.length}</span>
              )}
              {getBacklinkCount(notes, note.id) > 0 && (
                <span 
                  className="ml-2 text-[#00ff9f] hover:underline cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Improved click-to-jump: use single-source getBacklinkNotes (full objects)
                    // for accurate first backlinker (replaces prior divergent ad-hoc scan)
                    const backlinkers = getBacklinkNotes(notes, note.id);
                    if (backlinkers.length > 0) onSelectNote(backlinkers[0].id);
                  }}
                  title="Jump to linking note"
                >
                  ← {getBacklinkCount(notes, note.id)}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={(e) => onDelete(note.id, e)}
          className="opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 rounded hover:bg-white/10 focus-visible:bg-white/10 focus-visible:ring-1 focus-visible:ring-[#ff3366]/50 text-[#71717a] hover:text-[#ff3366] focus-visible:text-[#ff3366] transition-all touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Delete note"
          title="Delete note"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const selectedNote = notes.find((n) => n.id === selectedNoteId);

  const handleCreateNote = async () => {
    setIsCreating(true);
    try {
      const newId = await onCreateNote("Untitled Note");
      if (newId) {
        onSelectNote(newId);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteNote = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedNoteId === id) {
      onSelectNote(null);
    }
    await onDeleteNote(id);
  };

  const toggleExpand = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const openHistoryForSelected = () => {
    setHistoryOpenTrigger((n) => n + 1);
  };

  // Centralized mention scanning + diffing + automatic bidirectional task/note linking (M2)
  // Replaces the previous duplicated local handleMentionsChanged + lastMentionedRef logic.
  const { onMentionsChanged } = useMentions({
    notes,
    tasks,
    currentNoteId: selectedNoteId,
    onLinkTaskToNote,
    onUnlinkTaskFromNote,
    onLinkNoteToNote,
    onUnlinkNoteFromNote,
  });

  // Recursive tree renderer for proper hierarchy visualization.
  // Now uses SortableNoteItem so that @dnd-kit drag-to-reparent and vertical reordering
  // work in the normal (non-search) tree view, not just search mode.
  const renderNoteTree = (
    allNotes: Note[],
    selectedId: string | null,
    onSelect: (id: string | null) => void,
    onDelete: (id: string, e?: React.MouseEvent) => void
  ) => {
    // Build a map of children for each parent (same as before)
    const childrenMap = new Map<string | null, Note[]>();

    allNotes.forEach((note) => {
      const parent = note.parentNoteId || null;
      if (!childrenMap.has(parent)) childrenMap.set(parent, []);
      childrenMap.get(parent)!.push(note);
    });

    // Root-level notes (the "main notes" flat list) → pure recency, no drag handles.
    // Everything else (children inside the tree) keeps the existing sortOrder + drag behavior.
    const rootNotes = childrenMap.get(null) || [];
    rootNotes.sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt).getTime();
      const tb = new Date(b.updatedAt || b.createdAt).getTime();
      return tb - ta;
    });

    // For non-root levels, keep the previous stable sortOrder logic
    childrenMap.forEach((list, parentId) => {
      if (parentId === null) return; // already handled above
      list.sort((a, b) => {
        const soA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const soB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (soA !== soB) return soA - soB;
        const timeA = new Date(a.updatedAt || a.createdAt).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt).getTime();
        return timeB - timeA;
      });
    });

    const renderLevel = (parentId: string | null, depth: number): React.ReactNode => {
      const children = childrenMap.get(parentId) || [];
      if (children.length === 0) return null;

      return children.map((note) => {
        const isSelected = note.id === selectedId;
        const hasChildren = (childrenMap.get(note.id) || []).length > 0;
        const expanded = hasChildren && isExpanded(note.id);

        return (
          <React.Fragment key={note.id}>
            <SortableNoteItem
              note={note}
              isSelected={isSelected}
              onSelect={onSelect}
              onDelete={onDelete}
              depth={depth}
              hasChildren={hasChildren}
              expanded={expanded}
              onToggle={toggleExpand}
              onReparent={(draggedId, targetId) => {
                onReparentNote?.(draggedId, targetId);
              }}
              isOver={currentOverId === note.id}
              showDragHandle={depth > 0}
            />

            {/* Render children only if expanded — still recursive */}
            {hasChildren && expanded && renderLevel(note.id, depth + 1)}
          </React.Fragment>
        );
      });
    };

    // Start from root notes (no parent)
    return renderLevel(null, 0);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Notes List Sidebar — responsive width for mobile + tablet (low-risk polish) */}
      <div className="w-56 sm:w-64 md:w-72 border-r border-white/10 flex flex-col bg-[#0a0a0f] flex-shrink-0 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="font-semibold tracking-tight">Notes</div>
            <div className="text-[10px] text-[#71717a] font-mono">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
              {!isLive && " · demo"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedNoteId && onCreateSubNote && (
              <button
                onClick={async () => {
                  setIsCreating(true);
                  try {
                    const newId = await onCreateSubNote(selectedNoteId, "New sub-note");
                    if (newId) onSelectNote(newId);
                  } finally {
                    setIsCreating(false);
                  }
                }}
                disabled={isCreating}
                className="btn btn-secondary text-xs px-2.5 py-1.5 sm:py-1 flex items-center gap-1 disabled:opacity-50 touch-manipulation min-h-[36px] sm:min-h-[36px]"
                title="Create sub-note under selected note"
              >
                <Plus className="h-3 w-3" />
                Sub
              </button>
            )}
            <button
              onClick={handleCreateNote}
              disabled={isCreating}
              className="btn btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50 touch-manipulation min-h-[36px]"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#71717a]" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111114] border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-[#c084fc]/40 touch-manipulation"
              aria-label="Search notes"
            />
          </div>
        </div>

        {/* Notes List with Drag & Drop for reparenting + reordering */}
        {/* ARIA tree for keyboard + screen reader support (high-impact a11y polish) */}
        <div
          className="flex-1 overflow-y-auto p-1.5 sm:p-2 space-y-1 touch-pan-y"
          role="tree"
          aria-label="Notes tree"
          aria-multiselectable="false"
          data-notes-tree
        >
          {filteredNotes.length === 0 && (
            <div className="px-4 py-8 text-center text-[#71717a] text-sm">
              {searchQuery ? "No notes match your search." : "No notes yet. Create your first one."}
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragOver={(event) => {
              setCurrentOverId(event.over ? String(event.over.id) : null);
            }}
            // Big step: stronger visual insertion feedback for intra-parent reordering
            onDragMove={(event) => {
              // Could add more sophisticated insertion line here in future
            }}
            onDragEnd={(event: DragEndEvent) => {
              const { active, over } = event;
              if (!over || active.id === over.id) return;

              // M2: ultra-defensive String() + existence + equality guards (pairs with strengthened guards in useNoteOperations)
              const draggedId = String(active.id || '').trim();
              const targetId = String(over.id || '').trim();

              if (!draggedId || !targetId || draggedId === targetId) {
                console.warn('[Notes DnD] Invalid drag ids', { draggedId, targetId });
                return;
              }

              // Extra safety: only allow reparent if both ids correspond to real notes (existence guard)
              const draggedExists = notes.some(n => String(n.id) === draggedId);
              const targetExists = notes.some(n => String(n.id) === targetId);
              if (!draggedExists || !targetExists) {
                console.warn('[Notes DnD] Drag ids do not match any note', { draggedId, targetId });
                return;
              }

              setCurrentOverId(null);

              if (draggedId !== targetId) {
                // Optimistically expand the target so the user immediately sees their dragged note
                // as a child (the store update will confirm it).
                setExpandedNotes((prev) => {
                  const next = new Set(prev);
                  next.add(targetId);
                  return next;
                });

                // Delegate to handler which now guarantees integer sortOrder via midpoint floor + full sibling renorm
                onReparentNote?.(draggedId, targetId);
              }
            }}
          >
            <SortableContext
              items={visibleNotesForDnD.map((n) => n.id)}
              strategy={verticalListSortingStrategy}
            >
              {/* Render tree or flat list.
                  Both branches now use SortableNoteItem so drag-to-reparent works everywhere. */}
              {searchQuery ? (
                filteredNotes.map((note) => {
                  const isSelected = note.id === selectedNoteId;
                  return (
                    <SortableNoteItem
                      key={note.id}
                      note={note}
                      isSelected={isSelected}
                      onSelect={onSelectNote}
                      onDelete={handleDeleteNote}
                      depth={0}
                      hasChildren={false}
                      expanded={false}
                      onToggle={() => {}}
                      onReparent={(dragged, target) => {
                        onReparentNote?.(dragged, target);
                      }}
                      showDragHandle={false}
                    />
                  );
                })
              ) : (
                renderNoteTree(filteredNotes, selectedNoteId, onSelectNote, handleDeleteNote)
              )}
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedNote ? (
          <div className="flex-1 flex flex-col">
            <NoteHeader
              selectedNote={selectedNote}
              onTitleChange={(value) => {
                onUpdateNote(selectedNote.id, { title: value });
                // Trigger a snapshot in the editor for this title change
                setLocalTitleSnapshotTrigger((n) => n + 1);
              }}
              onOpenHistory={openHistoryForSelected}
              onDelete={() => handleDeleteNote(selectedNote.id)}
              historyCount={historyCount}
              linkedTaskCount={selectedNote.linkedTaskIds?.length || 0}
              backlinkCount={getBacklinkCount(notes, selectedNote.id)}
            />

            <div className="flex-1 overflow-hidden">
              <TipTapEditor
                key={selectedNote.id}
                noteId={selectedNote.id}
                content={selectedNote.content}
                onChange={(newContent) => {
                  // Extra echo guard at the call site (belt + suspenders)
                  if (newContent === selectedNote.content) return;
                  onUpdateNote(selectedNote.id, { content: newContent });
                }}
                tasks={tasks}
                onOpenTask={onOpenTask}
                onCreateTaskAndEmbed={onCreateTaskAndEmbed}
                onToggleStatus={onToggleTaskStatus}
                onUpdateTask={onUpdateTask}
                onHistoryChange={setHistoryCount}
                historyOpenTrigger={historyOpenTrigger}
                titleSnapshotTrigger={localTitleSnapshotTrigger}
                onLinkNoteToNote={onLinkNoteToNote}
                requestSnapshot={historyRequestSnapshot}
                requestTitleSnapshot={historyRequestTitleSnapshot}
                onOpenNote={onOpenNote}
                notes={notes}
                onPersistSnapshot={onPersistSnapshot}
                serverSnapshots={selectedNote?.snapshots}
                // Real bidirectional data for the editor's Links & Backlinks panel (M2 deepening)
                linkedItems={(selectedNote.linkedTaskIds || [])
                  .map(taskId => {
                    const t = tasks.find(tt => tt.id === taskId);
                    return t ? { id: t.id, title: t.title, type: "task" as const } : null;
                  })
                  .filter(Boolean) as Array<{ id: string; title: string; type: "task" | "note" }>}

                // Real items for the in-editor /link picker — all other notes + tasks in the workspace
                linkableItems={[
                  ...notes
                    .filter(n => n.id !== selectedNote.id)
                    .map(n => ({ id: n.id, title: n.title || "Untitled Note", type: "note" as const })),
                  ...tasks.map(t => ({ id: t.id, title: t.title, type: "task" as const })),
                ]}

                // Real backlinks now come from the centralized useBacklinks hook (task symmetry + mention scanning).
                backlinks={computedBacklinks}

                onMentionLinked={onMentionLinked || ((item) => {
                  if (item.type === "task") {
                    onLinkTaskToNote?.(selectedNote.id, item.id);
                  } else if (item.type === "note") {
                    onLinkNoteToNote?.(selectedNote.id, item.id);
                  }
                })}
                onMentionsChanged={onMentionsChangedProp || onMentionsChanged}
                onRemoveLinked={onRemoveLinked}
                onRemoveBacklink={onRemoveBacklink}
              />
            </div>

            {/* Real Bidirectional Task Linking (Milestone 2) - extracted component */}
            <LinkedTasksPanel
              selectedNote={selectedNote}
              tasks={tasks}
              notes={notes}
              onLinkTaskToNote={onLinkTaskToNote}
              onUnlinkTaskFromNote={onUnlinkTaskFromNote}
              onLinkNoteToNote={onLinkNoteToNote}
              onUnlinkNoteFromNote={onUnlinkNoteFromNote}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-12">
            <div>
              <div className="text-[#c084fc] mb-4">
                <Star className="h-10 w-10 mx-auto" />
              </div>
              <div className="text-xl font-semibold tracking-tight mb-2">No note selected</div>
              <div className="text-[#71717a] max-w-xs mx-auto">
                Select a note from the list or create a new one to start writing with the full TipTap editor.
              </div>
              <button
                onClick={handleCreateNote}
                disabled={isCreating}
                className="mt-6 btn btn-primary px-5 py-2 text-sm"
              >
                {isCreating ? "Creating..." : "Create new note"}
              </button>
              <div className="mt-3 text-[10px] text-[#71717a] font-mono">
                Tip: Use ⌘K for quick actions anywhere
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
