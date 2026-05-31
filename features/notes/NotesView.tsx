"use client";

// NOTE: "noteOps is not defined" crash was caused by stale Turbopack chunks
// after the M2 extraction batch (old (noteOps as any) references inside this file
// and LinkedTasksPanel wiring). Source is now clean — all references removed.
// If you still see the error, you MUST hard-refresh + restart dev server + delete .next.
// Fixed 2026-05-29.

import React, { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Search, Star, Link as LinkIcon, X, History } from "lucide-react";
import { Note, Task } from "@/types";
import { TipTapEditor } from "./editor";
import { LinkedTasksPanel, NoteHeader } from "./components";
import { useNoteSearch, useMentions, useBacklinks, useNoteHistory, getBacklinkCount, getBacklinkNotes } from "./hooks";
import { cn } from "@/lib/utils";

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

  // One-shot flag: when we create a note (top-level or sub), we set this to the new id.
  // NoteHeader receives autoFocusTitle={true} for that id and will focus+select the title input,
  // then call onTitleAutoFocusDone so we can clear the flag. This gives "create → start typing title" UX.
  const [pendingAutoFocusTitleId, setPendingAutoFocusTitleId] = useState<string | null>(null);

  // "Open families" state: which notes currently have their direct children revealed in the list.
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // M2 Version History trigger (increment to tell editor to open panel)
  const [historyOpenTrigger, setHistoryOpenTrigger] = useState(0);
  // M2: bump this when title changes so the editor auto-captures a "Title changed" snapshot
  const [localTitleSnapshotTrigger, setLocalTitleSnapshotTrigger] = useState(0);

  // M2: history count owned internally (extracted from page.tsx orchestration)
  // Editor calls onHistoryChange; we pass count to header. No longer bubbles to monolith.
  const [historyCount, setHistoryCount] = useState(0);

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

  // Ref to the main scroll container of the selected note detail (editor + bottom panels).
  // Used to auto-jump to the very top whenever the user selects a different note.
  const detailScrollRef = React.useRef<HTMLDivElement>(null);

  const isExpanded = (noteId: string) => expandedNotes.has(noteId);

  // Manual toggle for a note's direct children (called from the count badge).
  const toggleExpansion = (noteId: string) => {
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

  // Depth calculator for the 3-level hierarchy limit (parent=0, child=1, grandchild=2).
  // Anything deeper is treated as max-depth for display and creation gating.
  // Memoized on notes so it stays cheap and stable across renders.
  const getNoteDepth = React.useCallback((noteId: string | null): number => {
    if (!noteId) return 0;
    let depth = 0;
    let cur: string | null = noteId;
    const seen = new Set<string>();
    while (cur) {
      if (seen.has(cur)) break;
      seen.add(cur);
      const n = notes.find(nn => nn.id === cur);
      if (!n?.parentNoteId) return depth;
      depth += 1;
      if (depth >= 2) return 2; // hard cap for "parent → child → grandchild only"
      cur = n.parentNoteId;
    }
    return Math.min(depth, 2);
  }, [notes]);

  // Active root for "cohesive family background" treatment.
  // Any note whose root ancestor matches this gets the soft family styling.
  const activeRootId = React.useMemo(() => {
    if (!selectedNoteId) return null;
    let cur: string | null = selectedNoteId;
    const seen = new Set<string>();
    while (cur) {
      if (seen.has(cur)) break;
      seen.add(cur);
      const n = notes.find(nn => nn.id === cur);
      if (!n?.parentNoteId) return cur;
      cur = n.parentNoteId;
    }
    return selectedNoteId;
  }, [selectedNoteId, notes]);

  // Auto-scroll the note detail area (TipTap editor + Linked Tasks/Notes panels) all the way
  // to the top whenever the user selects a different note. This is the expected "I just opened
  // this note, start reading from the top" behavior in world-class apps.
  React.useEffect(() => {
    if (selectedNoteId && detailScrollRef.current) {
      detailScrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [selectedNoteId]);

  // NOTE: getBacklinkCount / getBacklinkNotes now come exclusively from the single-source
  // useBacklinks.ts selectors (imported above). No local duplication remains.

  // Plain row renderer for the notes list (roots + revealed children of open families).
  // No chevrons/arrows. Hierarchy is revealed on selection and stays open within a family.
  // Small count indicator appears to the *right* of the title when a note has children.
  function NoteListItem({
    note,
    isSelected,
    onSelect,
    onDelete,
    depth,
    hasChildren,
    childCount,
    isInActiveFamily,
    onToggleChildren,
    isOpen,
  }: {
    note: Note;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string, e?: React.MouseEvent) => void;
    depth: number;
    hasChildren?: boolean;
    childCount?: number;
    isInActiveFamily?: boolean;
    onToggleChildren?: (noteId: string) => void;
    isOpen?: boolean;
  }) {

    const preview = note.title || "Untitled";

    // Inside an open family the wrapper (in renderItemAndChildren) now provides the cohesive
    // encompassing background. So non-selected rows inside a family get almost no extra bg —
    // they just inherit the container. The selected row still gets its strong prominent highlight.
    const familyRowClass = isInActiveFamily && !isSelected ? "bg-transparent" : "";

    return (
      <div
        className={cn(
          "group flex items-center justify-between gap-3 px-3 py-2.5 sm:py-3 rounded-xl cursor-pointer transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0a0a0f]",
          isSelected
            ? "bg-white/5 border-white/10"
            : "hover:bg-white/5 border-transparent",
          familyRowClass
        )}
        style={{ marginLeft: depth * 18 }}
        role="treeitem"
        aria-selected={isSelected}
        aria-level={depth + 1}
        aria-label={`${preview}${childCount ? `, ${childCount} sub-notes` : ''}${isSelected ? ', selected' : ''}`}
        onClick={() => {
          const wasAlreadySelected = selectedNoteId === note.id;
          const isCurrentlyOpen = expandedNotes.has(note.id);

          onSelect(note.id);

          if (childCount && childCount > 0) {
            if (!isCurrentlyOpen) {
              // Original / first click on a closed parent (children not yet revealed):
              // Expand immediately so the user sees what's below it.
              toggleExpansion(note.id);
            } else if (wasAlreadySelected) {
              // Subtree is already open, and this is a deliberate follow-up click while the row is already selected.
              // This is the moment the user wants to collapse it.
              toggleExpansion(note.id);
            } else {
              // Subtree is already expanded, user is clicking back on this ancestor after having been on another note.
              // Per the rule: do not collapse on this first return click. Just select / view the note.
              // The next click (while it remains selected) will collapse.
            }
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.nativeEvent.isComposing) {
            e.preventDefault();

            const wasAlreadySelected = selectedNoteId === note.id;
            const isCurrentlyOpen = expandedNotes.has(note.id);

            onSelect(note.id);

            if (childCount && childCount > 0) {
              if (!isCurrentlyOpen) {
                // Original / first keyboard activation on a closed parent → expand
                toggleExpansion(note.id);
              } else if (wasAlreadySelected) {
                // Follow-up keyboard toggle on an already-selected open parent → collapse
                toggleExpansion(note.id);
              } else {
                // Returning via keyboard to an already-open ancestor after being elsewhere → select only, preserve open state
              }
            }
          }
        }}
        tabIndex={0}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm whitespace-normal break-words">
              {preview}

              {/* Clickable children count badge.
                  - Shows how many direct children the note has.
                  - Clicking it toggles visibility of those children (manual expand/collapse).
                  - This is the primary way users control subtree visibility now that we removed persistent arrows. */}
              {!!childCount && childCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleChildren?.(note.id);
                  }}
                  className="ml-1 text-[10px] leading-none px-1.5 py-px rounded-full bg-white/5 text-[#71717a]/70 tabular-nums hover:bg-white/10 hover:text-[#c084fc] active:scale-[0.95] transition-all focus-visible:ring-1 focus-visible:ring-[#c084fc]/50"
                  title={`Click to ${isOpen ? 'hide' : 'show'} ${childCount} sub-note${childCount === 1 ? '' : 's'}`}
                >
                  {childCount}
                </button>
              )}

              {/* Inline hover "Sub" button removed per UX request.
                  Sub-note creation is now only available from the prominent button
                  in the main NoteHeader (next to the large title when a note is open). */}
            </div>
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
        setPendingAutoFocusTitleId(newId);
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

  // Renderer for the notes tree (3-level max: parent → child → grandchild).
  // - Top level: only root notes (parentNoteId === null), pure recency sort.
  // - A note's direct children are shown only when that note's id is in expandedNotes.
  //   Expansion behavior:
  //     • First click (or Space/Enter) on a closed parent → selects it AND expands to reveal children.
  //     • When children are already visible and user has been on another note:
  //         – First click back on the ancestor → selects only (does NOT collapse). State stays sticky.
  //         – Next click while it remains selected → toggles/collapses.
  //   The count badge is always an explicit unconditional toggle.
  // - No chevrons/arrows. The small count badge to the right of the title is the direct control.
  // - Grandchildren (depth 2) are always leaves.
  const renderNoteTree = (
    allNotes: Note[],
    selectedId: string | null,
    onSelect: (id: string | null) => void,
    onDelete: (id: string, e?: React.MouseEvent) => void
  ) => {
    // Dedupe + build children map (same cheap work as before)
    const seen = new Set<string>();
    const deduped = allNotes.filter((n) => {
      const k = String(n?.id || "");
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const childrenMap = new Map<string | null, Note[]>();
    deduped.forEach((note) => {
      const parent = note.parentNoteId || null;
      if (!childrenMap.has(parent)) childrenMap.set(parent, []);
      childrenMap.get(parent)!.push(note);
    });

    // Recency within every sibling group
    childrenMap.forEach((list) => {
      list.sort((a, b) => {
        const ta = new Date(a.updatedAt || a.createdAt).getTime();
        const tb = new Date(b.updatedAt || b.createdAt).getTime();
        return tb - ta;
      });
    });

    // Helper: is this note part of the currently active open family?
    const isInActiveFamily = (noteId: string): boolean => {
      if (!activeRootId) return false;
      let cur: string | null = noteId;
      const seen = new Set<string>();
      while (cur) {
        if (seen.has(cur)) break;
        seen.add(cur);
        if (cur === activeRootId) return true;
        const n = notes.find(nn => nn.id === cur);
        cur = n?.parentNoteId || null;
      }
      return false;
    };

    // Render a single note + its direct children (only if the note is "open").
    // When a note has visible children (the family is open), we wrap the parent row
    // + all its revealed descendants in a single cohesive container. This gives the
    // "smoothly encompasses the entire family" effect the user requested.
    const renderItemAndChildren = (note: Note, depth: number): React.ReactNode => {
      if (depth > 2) return null; // hard safety — we only support parent / child / grandchild

      const isSelected = note.id === selectedId;

      // Grandchildren (depth 2) are always leaves — even if legacy data has deeper descendants.
      const rawKids = childrenMap.get(note.id) || [];
      const kids = depth >= 2 ? [] : rawKids;
      const count = kids.length;
      const showChildren = count > 0 && isExpanded(note.id);

      const row = (
        <NoteListItem
          note={note}
          isSelected={isSelected}
          onSelect={onSelect}
          onDelete={onDelete}
          depth={depth}
          hasChildren={count > 0}
          childCount={count}
          isInActiveFamily={isInActiveFamily(note.id)}
          onToggleChildren={toggleExpansion}
          isOpen={isExpanded(note.id)}
        />
      );

      if (!showChildren) {
        return row;
      }

      // Open family → wrap in a soft container so the whole visible branch reads as one unit.
      // The selected note inside will have its stronger highlight and stand out from the other family members.
      return (
        <div
          key={note.id}
          className="rounded-2xl bg-white/[0.02] border border-white/5 py-1 mb-1"
        >
          {row}
          {/* Subtle inset left accent for family cohesion — premium, no left-bias shift.
              The accent sits inside the family container so root-level titles inside the family
              align perfectly with root-level titles outside any family. */}
          <div className="space-y-px pl-2.5 border-l border-white/10 ml-2.5">
            {kids.map(child => (
              <React.Fragment key={child.id}>
                {renderItemAndChildren(child, depth + 1)}
              </React.Fragment>
            ))}
          </div>
        </div>
      );
    };

    // Top level = only roots. Everything else appears inline under its parent when opened.
    const roots = childrenMap.get(null) || [];
    return roots.map(root => (
      <React.Fragment key={root.id}>
        {renderItemAndChildren(root, 0)}
      </React.Fragment>
    ));
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden notes-root">
      {/* Notes List Sidebar — responsive width for mobile + tablet (low-risk polish) */}
      <div className="w-56 sm:w-64 md:w-72 border-r border-white/10 flex flex-col bg-[#0a0a0f] flex-shrink-0 overflow-hidden min-h-0">
        <div className="px-3 py-3 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="font-semibold tracking-tight">Notes</div>
            <div className="text-[10px] text-[#71717a] font-mono">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
              {!isLive && " · demo"}
            </div>
          </div>
          <div className="flex items-center gap-2">
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
        <div className="px-3 py-2 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#52525b]" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111114] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#c084fc]/40 focus:ring-1 focus:ring-[#c084fc]/20 transition-all touch-manipulation"
              aria-label="Search notes"
            />
          </div>
        </div>

        {/* Notes List with Drag & Drop for reparenting + reordering */}
        {/* ARIA tree for keyboard + screen reader support (high-impact a11y polish) */}
        <div
          className="flex-1 overflow-y-auto px-3 py-2 space-y-1 touch-pan-y"
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

          {/* Plain list (no DnD). Search = flat recency list. Normal = recursive tree with pure recency at every level. */}
          {searchQuery ? (
            // Search results: flat, pure recency (already sorted by useNoteSearch), deduped for safety
            (() => {
              const seen = new Set<string>();
              const safe = filteredNotes.filter((n) => {
                const k = String(n?.id || "");
                if (!k || seen.has(k)) return false;
                seen.add(k);
                return true;
              });
              return safe.map((note) => {
                const isSelected = note.id === selectedNoteId;
                // In search we still show a flat list, but we can still show the count badge
                const kids = notes.filter((n) => (n.parentNoteId || null) === note.id);
                return (
                  <NoteListItem
                    key={note.id}
                    note={note}
                    isSelected={isSelected}
                    onSelect={onSelectNote}
                    onDelete={handleDeleteNote}
                    depth={0}
                    hasChildren={kids.length > 0}
                    childCount={kids.length}
                    isInActiveFamily={false}
                    onToggleChildren={toggleExpansion}
                    isOpen={false}
                  />
                );
              });
            })()
          ) : (
            renderNoteTree(filteredNotes, selectedNoteId, onSelectNote, handleDeleteNote)
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedNote ? (
            <div className="flex-1 flex flex-col min-h-0">
            {/* Depth check for the 3-level hierarchy limit (parent=0, child=1, grandchild=2).
                We only offer the "Sub-note" button when the selected note is not already a grandchild. */}
            {(() => {
              const selectedDepth = getNoteDepth(selectedNote.id);
              const canCreateSub = !!onCreateSubNote && selectedDepth < 2;
              return (
                <NoteHeader
                  selectedNote={selectedNote}
                  onTitleChange={(value) => {
                    onUpdateNote(selectedNote.id, { title: value });
                    // Trigger a snapshot in the editor for this title change.
                    // Note: onTitleChange is now only called on blur/Enter (see NoteHeader).
                    // The TipTap body still uses real-time onChange for collaborative editing.
                    setLocalTitleSnapshotTrigger((n) => n + 1);
                  }}
                  onOpenHistory={openHistoryForSelected}
                  onDelete={() => handleDeleteNote(selectedNote.id)}
                  historyCount={historyCount}
                  linkedTaskCount={selectedNote.linkedTaskIds?.length || 0}
                  backlinkCount={getBacklinkCount(notes, selectedNote.id)}
                  onCreateSubNote={canCreateSub ? () => {
                    onCreateSubNote(selectedNote.id).then((newId) => {
                      if (newId) {
                        onSelectNote(newId);
                        setPendingAutoFocusTitleId(newId);
                      }
                    });
                  } : undefined}
                  autoFocusTitle={pendingAutoFocusTitleId === selectedNote.id}
                  onTitleAutoFocusDone={() => setPendingAutoFocusTitleId(null)}
                />
              );
            })()}

            {/* FIX: Single scrollable container for the entire note detail (editor + panels).
                This ensures long content and the Linked Tasks / Links panels are never cut off. */}
            {/* FIX: One scroll container for editor content + bottom panels.
                Long notes and the Linked Tasks / Links sections will now scroll together. */}
            <div ref={detailScrollRef} className="flex-1 overflow-y-auto min-h-0">
              <TipTapEditor
                key={selectedNote.id}
                noteId={selectedNote.id}
                content={selectedNote.content}
                onChange={(newContent) => {
                  // Smart guard: skip only if identical to last known server/client value.
                  // Structural changes (new paragraphs via Enter, pasted images) are always emitted
                  // immediately from the editor, so we must not drop them.
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

              {/* Real Bidirectional Task Linking (Milestone 2) — inside the scroll container so the entire detail view (long editor + linking UI) scrolls together. */}
              <LinkedTasksPanel
                selectedNote={selectedNote}
                tasks={tasks}
                onLinkTaskToNote={onLinkTaskToNote}
                onUnlinkTaskFromNote={onUnlinkTaskFromNote}
                onCreateTaskAndLink={onCreateTaskAndEmbed}
              />
            </div>
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
