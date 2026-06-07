"use client";

// NOTE: "noteOps is not defined" crash was caused by stale Turbopack chunks
// after the M2 extraction batch (old (noteOps as any) references inside this file
// and LinkedTasksPanel wiring). Source is now clean — all references removed.
// If you still see the error, you MUST hard-refresh + restart dev server + delete .next.
// Fixed 2026-05-29.

import React, { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Star, Link as LinkIcon, X, ChevronRight, ChevronDown } from "lucide-react";
import { Note, Task } from "@/types";
import { TipTapEditor } from "./editor";
import { LinkedTasksPanel, NoteHeader } from "./components";
import { useNoteSearch, useMentions, useBacklinks, getBacklinkCount, getBacklinkNotes } from "./hooks";
import { cn } from "@/lib/utils";
import "./notes-workspace.css";

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
  onCreateTaskAndLink?: (noteId: string, title: string) => Promise<string | null>; // Linked Tasks panel
  onToggleTaskStatus?: (taskId: string) => Promise<void>; // Inline status change from embeds
  onUpdateTask?: (taskId: string, updates: Partial<any>) => Promise<void>; // Inline edits from TaskEmbeds

  // Database Blocks (M2 parallel work)
  onOpenNote?: (noteId: string) => void;

  onCreateSubNote?: (parentNoteId: string, title?: string) => Promise<string | null>; // Milestone 2 hierarchy
  isLive: boolean;

  // M2: when a real mention is inserted in the editor, perform the actual link
  onMentionLinked?: (item: { id: string; title: string; type: "task" | "note" }) => void;

  // M2: remove handlers for the (now removed) editor's Links & Backlinks panel — kept for prop compatibility during slim
  onRemoveLinked?: (id: string, type: "task" | "note") => void;
  onRemoveBacklink?: (id: string, type: "task" | "note") => void;

  // Optional override for mention change handling (advanced use)
  onMentionsChanged?: (mentions: Array<{ label: string; refType?: string; refId?: string | null }>) => void;

  // M2 note-to-note bidirectional (now fully wired, no casts)
  onLinkNoteToNote?: (noteId: string, targetNoteId: string) => void | Promise<void>;
  onUnlinkNoteFromNote?: (noteId: string, targetNoteId: string) => void | Promise<void>;

  /** Version history (live mode); wired from noteOps in page shell */
  onPersistSnapshot?: (noteId: string, snapshot: unknown) => Promise<void>;
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
  onCreateTaskAndLink,
  onToggleTaskStatus,
  onUpdateTask,
  onCreateSubNote,
  onOpenNote,
  isLive,
  onMentionLinked,
  onRemoveLinked,
  onRemoveBacklink,
  onMentionsChanged: onMentionsChangedProp,
  onLinkNoteToNote,
  onUnlinkNoteFromNote,
  onPersistSnapshot: _onPersistSnapshot,
  requestSnapshot: _requestSnapshot,
  requestTitleSnapshot: _requestTitleSnapshot,
}: NotesViewProps) {
  const [isCreating, setIsCreating] = useState(false);

  // One-shot flag: when we create a note (top-level or sub), we set this to the new id.
  // NoteHeader receives autoFocusTitle={true} for that id and will focus+select the title input,
  // then call onTitleAutoFocusDone so we can clear the flag. This gives "create → start typing title" UX.
  const [pendingAutoFocusTitleId, setPendingAutoFocusTitleId] = useState<string | null>(null);

  // "Open families" state: which notes currently have their direct children revealed in the list.
  // Persisted so the user's manual expand/collapse choices for each family survive refresh (per request).
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("badass-expanded-notes");
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set();
  });

  // Extracted search logic (M2 extraction)
  const { searchQuery, setSearchQuery, filteredNotes, isSearching } = useNoteSearch(notes);

  // Centralized backlinks computation (task symmetry + mention scanning from other notes)
  const computedBacklinks = useBacklinks(notes, selectedNoteId);

  // Ref to the main scroll container of the selected note detail (editor + bottom panels).
  // Used to auto-jump to the very top whenever the user selects a different note.
  const detailScrollRef = React.useRef<HTMLDivElement>(null);

  const isExpanded = (noteId: string) => expandedNotes.has(noteId);

  // Manual toggle for a note's direct children (called from the count badge and the new indicator next to delete).
  const toggleExpansion = (noteId: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      // Persist immediately so family open/closed state survives hard refresh.
      try {
        localStorage.setItem("badass-expanded-notes", JSON.stringify(Array.from(next)));
      } catch {}
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

  // Shared line colors — 1:1 with the approved family border tokens (border-white/10 normal, /15 active).
  // Using bg- + w-0.5 (2px) instead of hairline 1px so the connectors are actually visible on dark
  // while remaining subtle/calm (Linear/Notion-grade) and satisfying "same color as the family border" + "subtle".
  const TREE_LINE_NORMAL = "bg-white/10";
  const TREE_LINE_ACTIVE = "bg-white/15";

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
    suppressOwnBorder,
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
    /** When true, this row is inside an open family wrapper and should not draw its own border/rounding.
     *  The family container provides the single subtle border around the entire branch. */
    suppressOwnBorder?: boolean;
  }) {

    const preview = note.title || "Untitled";

    // World-class hierarchy: subtle desaturation + weight shift by depth.
    // Parents feel primary, children secondary, grandchildren tertiary.
    // This + the thread lines + indentation makes the tree instantly scannable.
    const titleColor = depth === 0 
      ? "text-[#f4f4f5]" 
      : depth === 1 
        ? "text-[#e5e5e7]" 
        : "text-[#d4d4d8]";

    const metaOpacity = depth === 0 ? "opacity-100" : depth === 1 ? "opacity-90" : "opacity-75";

    // Only the selected note should be light. All other notes in the family (even in the active family)
    // stay dark (transparent) so the selected one pops clearly inside the group.
    const familyRowClass = "";

    // Visual treatment: top-level rows (parents) get the nice rounded treatment.
    // Nested rows (children/grandchildren inside an open family) get a much lighter,
    // chrome-free treatment so we avoid the ugly "box inside box" problem.
    const isNested = depth > 0;

    // Completely rethought row (per user feedback):
    // - Title uses the ENTIRE width of the section on its own block. It can wrap to multiple lines.
    //   No controls share horizontal space with the title.
    // - Below the title: a clean meta/controls bar that splits left (timestamp + links) / right (count+chevron + delete).
    // This makes long titles feel luxurious and uses every pixel.
    return (
      <div
        className={cn(
          "group flex w-full flex-col gap-1 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0a0a0f] min-w-0",
          // When this row is the header of an open family, it should not have its own border/rounding.
          // The family wrapper provides one single subtle border around the entire branch.
          // depth > 0 rows (child / grandchild) must have literally zero border.
          // Only the single outer family wrapper border (the one the user likes) is allowed.
          // Selection rule (per user): the selected note is the light one (bg-white/6 to match other selected state).
          // All non-selected notes inside any family stay dark (transparent).
          depth > 0
            ? `px-3 py-2 border-none relative ${isSelected ? "bg-white/6" : "bg-transparent"}`
            : suppressOwnBorder
              ? `px-3 py-2.5 sm:py-2 rounded-none border-none ${isSelected ? "bg-white/6" : "bg-transparent"}`
              : "px-3 py-2.5 sm:py-2 rounded-xl border " + (isSelected 
                ? "bg-white/6 border-white/10 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]" 
                : "hover:bg-white/4 border-transparent active:bg-white/5"),
          familyRowClass
        )}
        style={{ marginLeft: depth * 20, width: `calc(100% - ${depth * 20}px)` }}
        role="treeitem"
        aria-selected={isSelected}
        aria-level={depth + 1}
        aria-label={`${preview}${childCount ? `, ${childCount} sub-notes` : ''}${isSelected ? ', selected' : ''}`}
        onClick={() => {
          onSelect(note.id);
        }}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSelect(note.id);
          }
        }}
        tabIndex={0}
      >
        {depth > 0 && (
          <div
            className={`absolute h-px pointer-events-none ${isInActiveFamily ? 'bg-white/25' : 'bg-white/20'}`}
            style={{
              left: depth === 1 ? '-16px' : '-12px',
              width: depth === 1 ? '18px' : '14px',
              top: '13px'
            }}
            aria-hidden="true"
          />
        )}

        {/* TITLE — full width, wraps naturally, always shows complete text. Hero of the row. */}
        <div className="w-full min-w-0 pl-3">
          <div className={`font-medium text-[14px] leading-[1.35] tracking-[-0.1px] ${titleColor} whitespace-normal break-words`}>
            {preview}
          </div>
        </div>

        {/* META + CONTROLS BAR — full width below title.
            Clicking anywhere on this bar (timestamp or controls) on an expandable row toggles the family.
            This is the key UX improvement requested. */}
        <div 
          className={cn(
            "flex w-full min-w-0 items-center justify-between gap-2 text-[10px] cursor-pointer active:bg-white/5 rounded-md -ml-3 -mr-3 pl-3 pr-3 py-0.5 -my-0.5 transition-colors",
            // Subtle hover feedback on the entire clickable toggle area (timestamp + collapse controls)
            // Only shown when this note is expandable, so users discover the interaction.
            // Make the entire clickable toggle region (timestamp + collapse controls) visibly highlight on hover
            // so users clearly see that this area expands/collapses the family.
            hasChildren && childCount && childCount > 0 && "hover:bg-white/[0.06]"
          )}
          onClick={(e) => {
            if (hasChildren && childCount && childCount > 0) {
              e.stopPropagation(); // don't also fire the row's "select" handler
              onToggleChildren?.(note.id);
            }
          }}
        >
          {/* Left: timestamp + subtle meta */}
          <div className={`flex items-center gap-2 text-[#71717a] tabular-nums min-w-0 ${metaOpacity}`}>
            {new Date(note.updatedAt || note.createdAt).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}

            {note.linkedTaskIds && note.linkedTaskIds.length > 0 && (
              <span className="text-[#c084fc]/80">↔ {note.linkedTaskIds.length}</span>
            )}
            {getBacklinkCount(notes, note.id) > 0 && (
              <span
                className="text-[#00ff9f]/80 hover:text-[#00ff9f] cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  const backlinkers = getBacklinkNotes(notes, note.id);
                  if (backlinkers.length > 0) onSelectNote(backlinkers[0].id);
                }}
                title="Jump to linking note"
              >
                ← {getBacklinkCount(notes, note.id)}
              </span>
            )}
          </div>

          {/* Right cluster — collapse/expand indicator only (delete removed from list per request) */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Collapse / count indicator — rightmost, now with clear hover highlight on the active clickable area */}
            {hasChildren && childCount && childCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleChildren?.(note.id);
                }}
                className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums
                           text-[#71717a]/70 hover:text-[#c084fc] hover:bg-white/10 active:bg-white/15
                           transition-all focus-visible:ring-1 focus-visible:ring-[#c084fc]/50"
                aria-label={isOpen ? "Collapse sub-notes" : "Expand sub-notes"}
                title={`${childCount} sub-note${childCount === 1 ? '' : 's'} — click to ${isOpen ? 'collapse' : 'expand'}`}
              >
                <span className="font-medium">{childCount}</span>
                {isOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
            )}
          </div>
        </div>
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
    await onDeleteNote(id);
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
    const renderItemAndChildren = (
      note: Note,
      depth: number,
      forceSuppressBorder = false,
      isActiveFamily = false
    ): React.ReactNode => {
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
          // For all root notes (depth 0), suppress the row's own border/rounding.
          // The family wrapper below always provides the single consistent border the user likes.
          suppressOwnBorder={depth === 0 || forceSuppressBorder}
        />
      );

      // Every root note (depth 0) is always wrapped in the nice family border container.
      // This gives every "family" (even a family of 1 / collapsed root) the same treatment.
      // When the family is the active one (contains the selected note), we add a subtle highlight to the wrapper.
      if (depth === 0) {
        const isActiveFamily = activeRootId === note.id;
        const familyWrapperClass = cn(
          "rounded-2xl border overflow-hidden",
          isActiveFamily 
            ? "border-white/15"   // slightly bolder border for the active family (the one containing the selected note)
            : "border-white/10",
          isActiveFamily && "bg-white/[0.02]"   // subtle lighter background inside the border for the active family
        );

        if (!showChildren) {
          // Collapsed root / family of 1 — still gets the nice border
          return (
            <div key={note.id} className={familyWrapperClass}>
              {row}
            </div>
          );
        } else {
          // Expanded family — the single wrapper encloses the parent row + all descendants
          const subtreeContent = (
            <div className="pt-0.5 pb-2 relative overflow-x-hidden" style={{ marginLeft: 0 }}>
              {/* Continuous vertical connector for children — border-l gives clean, gap-free line */}
              <div
                className="absolute w-px pointer-events-none border-l border-white/25"
                style={{ left: '8px', top: '-2px', bottom: '2px' }}
                aria-hidden="true"
              />
              <div className="space-y-px">
                {kids.map(child => (
                  <React.Fragment key={child.id}>
                    {renderItemAndChildren(child, depth + 1, true, isActiveFamily)}
                  </React.Fragment>
                ))}
              </div>
            </div>
          );

          return (
            <div key={note.id} className={familyWrapperClass}>
              {row}
              {subtreeContent}
            </div>
          );
        }
      }

      // For depth > 0 (children / grandchildren): never create extra borders/wrappers.
      // They live inside the single outer family border of their root.
      if (!showChildren) {
        return row;
      }

      const subtreeContent = (
        <div className="pt-0.5 pb-2 relative overflow-x-hidden" style={{ marginLeft: 0 }}>
          {/* Continuous vertical connector for grandchildren */}
          <div
            className="absolute w-px pointer-events-none border-l border-white/25"
            style={{ left: '28px', top: '-2px', bottom: '2px' }}
            aria-hidden="true"
          />
          <div className="space-y-px">
            {kids.map(child => (
              <React.Fragment key={child.id}>
                {renderItemAndChildren(child, depth + 1, true, isActiveFamily)}
              </React.Fragment>
            ))}
          </div>
        </div>
      );

      return (
        <React.Fragment key={note.id}>
          {row}
          {subtreeContent}
        </React.Fragment>
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

  const [mobileLayoutClass, setMobileLayoutClass] = useState("");

  useEffect(() => {
    const update = () => {
      if (typeof window === "undefined" || window.innerWidth >= 768) {
        setMobileLayoutClass("");
        return;
      }
      setMobileLayoutClass(
        selectedNoteId ? "notes-mobile-detail" : "notes-mobile-list"
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [selectedNoteId]);

  return (
    <div className={cn("flex h-full min-h-0 overflow-hidden notes-root", mobileLayoutClass)}>
      <div className="notes-sidebar w-56 sm:w-64 md:w-72 border-r border-white/10 flex flex-col bg-[#0a0a0f] flex-shrink-0 overflow-hidden overflow-x-hidden min-h-0">
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

        {/* Search — clean, no icon, full modern treatment */}
        <div className="px-3 py-2 border-b border-white/10">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111114] border border-white/10 rounded-xl pl-3 pr-3 py-2 text-sm focus:outline-none focus:border-[#c084fc]/40 focus:ring-1 focus:ring-[#c084fc]/20 placeholder:text-[#52525b] transition-all touch-manipulation"
            aria-label="Search notes"
          />
        </div>

        {/* Notes List with Drag & Drop for reparenting + reordering */}
        {/* ARIA tree for keyboard + screen reader support (high-impact a11y polish) */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-1.5 touch-pan-y"
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

      <div className="notes-editor-panel flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedNote ? (
            <div className="flex-1 flex flex-col min-h-0">
            {mobileLayoutClass === "notes-mobile-detail" && (
              <button
                type="button"
                onClick={() => onSelectNote(null)}
                className="md:hidden mx-4 mt-3 mb-0 text-xs text-[#c084fc] hover:underline text-left"
              >
                ← Back to notes
              </button>
            )}
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
                  }}
                  onDelete={() => handleDeleteNote(selectedNote.id)}
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
            <div ref={detailScrollRef} className="notes-editor-scroll flex-1 overflow-y-auto min-h-0">
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
                onLinkNoteToNote={onLinkNoteToNote}
                onOpenNote={onOpenNote}
                notes={notes}
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
                onOpenTask={onOpenTask}
                onCreateTaskAndLink={onCreateTaskAndLink}
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
