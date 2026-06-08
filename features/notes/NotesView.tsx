"use client";

// NOTE: "noteOps is not defined" crash was caused by stale Turbopack chunks
// after the M2 extraction batch (old (noteOps as any) references inside this file
// and LinkedTasksPanel wiring). Source is now clean — all references removed.
// If you still see the error, you MUST hard-refresh + restart dev server + delete .next.
// Fixed 2026-05-29.

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Star, ChevronRight, ChevronDown, Paperclip, Loader2 } from "lucide-react";
import { Note, Task } from "@/types";
import { TipTapEditor } from "./editor";
import {
  NotesSidebarHeader,
  LinkedTasksPanel,
  NoteAttachmentsPanel,
  NoteHeader,
  NoteLinkedTaskBadge,
  NoteTreeGutter,
  NoteMobileDrawer,
} from "./components";
import {
  useNoteSearch,
  useMentions,
  useBacklinks,
  getBacklinkCount,
  getBacklinkNotes,
  useNoteAttachmentCounts,
} from "./hooks";
import { cn } from "@/lib/utils";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import {
  ensureAncestryExpanded,
  ensureMobileTreeContext,
  loadExpandedNotesFromStorage,
  persistExpandedNotes,
} from "./lib/noteTreeExpansion";
import {
  getNoteLinkedTaskStats,
  sortNotesByOpenTaskUrgency,
} from "./lib/noteLinkedTaskStats";
import { buildNoteSubtreeCounts } from "./lib/noteSubtreeCount";
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
  onToggleTaskComplete?: (taskId: string) => Promise<void>; // Linked tasks list checkbox
  onUpdateTask?: (taskId: string, updates: Partial<any>) => Promise<void>; // Inline edits from TaskEmbeds

  // Database Blocks (M2 parallel work)
  onOpenNote?: (noteId: string) => void;

  onCreateSubNote?: (parentNoteId: string, title?: string) => Promise<string | null>; // Milestone 2 hierarchy
  /** Current workspace id — used for attachment counts even when notes[] is still empty */
  workspaceId?: string;
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
  /** When detail-only, parent shell (Files view) owns list + tag rail. */
  shellMode?: "full" | "detail-only";
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
  onToggleTaskComplete,
  onUpdateTask,
  onCreateSubNote,
  onOpenNote,
  workspaceId: workspaceIdProp,
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
  shellMode = "full",
}: NotesViewProps) {
  const detailOnly = shellMode === "detail-only";
  const [isCreating, setIsCreating] = useState(false);
  const [showOpenTasksOnly, setShowOpenTasksOnly] = useState(false);

  // One-shot flag: when we create a note (top-level or sub), we set this to the new id.
  // NoteHeader receives autoFocusTitle={true} for that id and will focus+select the title input,
  // then call onTitleAutoFocusDone so we can clear the flag. This gives "create → start typing title" UX.
  const [pendingAutoFocusTitleId, setPendingAutoFocusTitleId] = useState<string | null>(null);
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState<string | null>(null);
  const [mobileDraft, setMobileDraft] = useState<{ title: string; content: string } | null>(null);
  const [isSavingMobileNote, setIsSavingMobileNote] = useState(false);
  const openedNoteSnapshotRef = useRef<{
    noteId: string;
    title: string;
    content: string;
  } | null>(null);

  // "Open families" state: which notes currently have their direct children revealed in the list.
  // Persisted so the user's manual expand/collapse choices for each family survive refresh (per request).
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(() =>
    loadExpandedNotesFromStorage(),
  );

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  useEffect(() => {
    const update = () => {
      setIsMobile(typeof window !== "undefined" && window.innerWidth < 768);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Extracted search logic (M2 extraction)
  const { searchQuery, setSearchQuery, filteredNotes, isSearching } = useNoteSearch(notes);

  const workspaceId = workspaceIdProp || notes[0]?.workspaceId;
  const {
    counts: attachmentCounts,
    loading: attachmentCountsLoading,
    setNoteCount,
    refresh: refreshAttachmentCounts,
  } = useNoteAttachmentCounts(workspaceId);

  useEffect(() => {
    if (isLive) refreshAttachmentCounts();
  }, [isLive, notes.length, refreshAttachmentCounts]);

  const displayNotes = useMemo(() => {
    if (!showOpenTasksOnly) return filteredNotes;
    const withOpenTasks = filteredNotes.filter(
      (note) => getNoteLinkedTaskStats(note, tasks).hasOpen,
    );
    return sortNotesByOpenTaskUrgency(withOpenTasks, tasks);
  }, [filteredNotes, showOpenTasksOnly, tasks]);

  const openTasksNoteCount = useMemo(
    () => notes.filter((note) => getNoteLinkedTaskStats(note, tasks).hasOpen).length,
    [notes, tasks],
  );

  const hasOverdueOpenTaskNotes = useMemo(
    () => notes.some((note) => getNoteLinkedTaskStats(note, tasks).hasOverdue),
    [notes, tasks],
  );

  const subtreeCounts = useMemo(() => buildNoteSubtreeCounts(notes), [notes]);

  const useFlatNoteList = isSearching || showOpenTasksOnly;

  // Centralized backlinks computation (task symmetry + mention scanning from other notes)
  const computedBacklinks = useBacklinks(notes, selectedNoteId);

  // Ref to the main scroll container of the selected note detail (editor + bottom panels).
  // Used to auto-jump to the very top whenever the user selects a different note.
  const detailScrollRef = React.useRef<HTMLDivElement>(null);

  const isExpanded = (noteId: string) => expandedNotes.has(noteId);

  // Manual toggle for a note's direct children (chevron count badge only).
  const toggleExpansion = React.useCallback((noteId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      persistExpandedNotes(next);
      return next;
    });
  }, []);

  /**
   * Desktop sticky disclosure (row click):
   * - First click on a branch: select + expand direct children.
   * - Reselect while selected: toggle collapse.
   */
  const handleNoteRowSelect = React.useCallback(
    (noteId: string, hasChildren?: boolean) => {
      const isReselect = selectedNoteId === noteId;
      const branch = hasChildren === true;

      if (isReselect) {
        if (branch) toggleExpansion(noteId);
        return;
      }

      onSelectNote(noteId);
      setExpandedNotes((prev) => {
        const next = new Set(prev);
        ensureAncestryExpanded(noteId, notes, next);
        if (branch && !next.has(noteId)) {
          next.add(noteId);
        }
        persistExpandedNotes(next);
        return next;
      });
    },
    [selectedNoteId, notes, onSelectNote, toggleExpansion],
  );

  /**
   * Mobile row tap (drawer-first):
   * - Tap note: open drawer + reveal ancestor path + direct children behind sheet.
   * - Tap same note again: close drawer only (preserve tree expansion).
   * - Chevron is the sole expand/collapse control (see NoteListItem).
   */
  const handleMobileNoteRowSelect = React.useCallback(
    (noteId: string) => {
      if (selectedNoteId === noteId) {
        onSelectNote(null);
        return;
      }

      onSelectNote(noteId);
      setExpandedNotes((prev) => {
        const next = new Set(prev);
        ensureMobileTreeContext(noteId, notes, next);
        persistExpandedNotes(next);
        return next;
      });
    },
    [selectedNoteId, notes, onSelectNote],
  );

  const handleListNoteSelect = React.useCallback(
    (noteId: string, hasChildren?: boolean) => {
      if (isMobile) {
        handleMobileNoteRowSelect(noteId);
        return;
      }
      handleNoteRowSelect(noteId, hasChildren);
    },
    [isMobile, handleMobileNoteRowSelect, handleNoteRowSelect],
  );

  // Deep links (search pick, backlink jump, new sub-note): reveal path; mobile adds branch context.
  React.useEffect(() => {
    if (!selectedNoteId) return;
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      const sizeBefore = next.size;
      if (isMobile) {
        ensureMobileTreeContext(selectedNoteId, notes, next);
      } else {
        ensureAncestryExpanded(selectedNoteId, notes, next);
      }
      if (next.size === sizeBefore) return prev;
      persistExpandedNotes(next);
      return next;
    });
  }, [selectedNoteId, notes, isMobile]);

  // Inbound email notes: auto-expand parent branch so new children are visible immediately.
  const seenInboundNoteIdsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    const newcomers = notes.filter((n) => !seenInboundNoteIdsRef.current.has(n.id));
    newcomers.forEach((n) => seenInboundNoteIdsRef.current.add(n.id));
    const inboundChildren = newcomers.filter(
      (n) => n.parentNoteId && (n.tags || []).includes("from-email"),
    );
    if (!inboundChildren.length) return;

    setExpandedNotes((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const child of inboundChildren) {
        const sizeBefore = next.size;
        ensureAncestryExpanded(child.id, notes, next);
        if (next.size !== sizeBefore) changed = true;
      }
      if (!changed) return prev;
      persistExpandedNotes(next);
      return next;
    });
  }, [notes]);

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
    if (!selectedNoteId) return;
    if (detailScrollRef.current) {
      detailScrollRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
    const drawerBody = document.querySelector(".notes-drawer-body");
    drawerBody?.scrollTo({ top: 0, behavior: "auto" });
  }, [selectedNoteId]);

  // NOTE: getBacklinkCount / getBacklinkNotes now come exclusively from the single-source
  // useBacklinks.ts selectors (imported above). No local duplication remains.

  // Plain row renderer for the notes list (roots + revealed children of open families).
  // Hierarchy is revealed on selection and stays open within a family.
  // Subtree count (including this note) + chevron sit flush right on the title row.

  function NoteListItem({
    note,
    isSelected,
    onSelect,
    onDelete,
    depth,
    hasChildren,
    directChildCount = 0,
    subtreeCount,
    isInActiveFamily,
    onToggleChildren,
    isOpen,
    suppressOwnBorder,
    isLastSibling,
    linkedTaskStats,
    attachmentCount = 0,
    isMobile = false,
  }: {
    note: Note;
    isSelected: boolean;
    onSelect: (id: string, hasChildren?: boolean) => void;
    onDelete: (id: string, e?: React.MouseEvent) => void;
    depth: number;
    hasChildren?: boolean;
    directChildCount?: number;
    subtreeCount?: number;
    isInActiveFamily?: boolean;
    onToggleChildren?: (noteId: string) => void;
    isOpen?: boolean;
    /** When true, this row is inside an open family wrapper and should not draw its own border/rounding.
     *  The family container provides the single subtle border around the entire branch. */
    suppressOwnBorder?: boolean;
    isLastSibling?: boolean;
    linkedTaskStats: ReturnType<typeof getNoteLinkedTaskStats>;
    attachmentCount?: number;
    /** Mobile: row tap selects only; chevron is the only expand/collapse affordance. */
    isMobile?: boolean;
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

    // Completely rethought row (per user feedback):
    // - Title uses the ENTIRE width of the section on its own block. It can wrap to multiple lines.
    //   No controls share horizontal space with the title.
    // - Below the title: a clean meta/controls bar that splits left (timestamp + links) / right (count+chevron + delete).
    // This makes long titles feel luxurious and uses every pixel.
    const bodyClass = cn(
      "group note-tree-body cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0a0a0f]",
      depth > 0
        ? `px-3 py-2 border-none rounded-lg ${isSelected ? "bg-white/6 ring-1 ring-[#c084fc]/20" : "bg-transparent"}`
        : suppressOwnBorder
          ? `px-3 py-2.5 sm:py-2 rounded-none border-none ${isSelected ? "bg-white/6 ring-1 ring-[#c084fc]/20" : "bg-transparent"}`
          : "px-3 py-2.5 sm:py-2 rounded-xl border " + (isSelected
            ? "bg-white/6 border-white/10 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] ring-1 ring-[#c084fc]/20"
            : "hover:bg-white/4 border-transparent active:bg-white/5"),
      familyRowClass,
    );

    return (
      <div
        className={cn("note-tree-row", `note-tree-row--depth-${depth}`)}
        role="treeitem"
        aria-selected={isSelected}
        aria-level={depth + 1}
        aria-label={`${preview}${subtreeCount && subtreeCount > 1 ? `, ${subtreeCount} notes in branch` : ''}${isSelected ? ', selected' : ''}`}
        onClick={() => {
          // Mobile: never pass hasChildren — row opens drawer only; chevron handles tree disclosure.
          onSelect(note.id, isMobile ? false : !!hasChildren);
        }}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSelect(note.id, isMobile ? false : !!hasChildren);
          }
        }}
        tabIndex={0}
      >
        <NoteTreeGutter
          depth={depth}
          isLastSibling={isLastSibling}
          isInActiveFamily={isInActiveFamily}
        />

        <div className={bodyClass}>
        {/* TITLE ROW — title left; subtree count + chevron flush right */}
        <div className="flex w-full min-w-0 items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className={`font-medium text-[14px] leading-[1.35] tracking-[-0.1px] ${titleColor} whitespace-normal break-words`}>
              {preview}
            </div>
          </div>

          {hasChildren &&
            (isMobile ? directChildCount > 0 : subtreeCount && subtreeCount > 1) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleChildren?.(note.id);
              }}
              className={cn(
                "note-tree-subtree-toggle ml-auto flex shrink-0 items-center rounded-md transition-all focus-visible:ring-1 focus-visible:ring-[#c084fc]/50",
                isMobile
                  ? "note-tree-subtree-toggle--mobile gap-1 px-2 py-1 text-[11px] font-medium"
                  : "gap-0.5 px-1.5 py-0.5 text-[10px] tabular-nums text-[#71717a]/70 hover:text-[#c084fc] hover:bg-white/10 active:bg-white/15",
              )}
              aria-label={
                isOpen
                  ? "Hide sub-notes"
                  : isMobile
                    ? `Show ${directChildCount} sub-note${directChildCount === 1 ? "" : "s"}`
                    : "Expand sub-notes"
              }
              title={
                isMobile
                  ? isOpen
                    ? "Hide sub-notes"
                    : `Show ${directChildCount} sub-note${directChildCount === 1 ? "" : "s"}`
                  : `${subtreeCount} note${subtreeCount === 1 ? "" : "s"} in branch — click to ${isOpen ? "collapse" : "expand"}`
              }
            >
              {isMobile ? (
                <>
                  <span className="note-tree-subtree-toggle__label">
                    {isOpen ? "Hide" : `Show ${directChildCount}`}
                  </span>
                  {isOpen ? (
                    <ChevronDown className="note-tree-subtree-toggle__chevron h-4 w-4" />
                  ) : (
                    <ChevronRight className="note-tree-subtree-toggle__chevron h-4 w-4" />
                  )}
                </>
              ) : (
                <>
                  <span className="font-medium">{subtreeCount}</span>
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </>
              )}
            </button>
          )}
        </div>

        {/* META BAR — timestamp and links only */}
        <div className="flex w-full min-w-0 items-center gap-2 text-[10px] -ml-3 -mr-3 pl-3 pr-3 py-0.5 -my-0.5">
          <div className={`flex items-center gap-2 text-[#71717a] tabular-nums min-w-0 ${metaOpacity}`}>
            {new Date(note.updatedAt || note.createdAt).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}

            <NoteLinkedTaskBadge stats={linkedTaskStats} compact />
            {attachmentCount > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-[#c084fc]/85"
                title={`${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}`}
              >
                <Paperclip className="h-3 w-3 shrink-0" aria-hidden />
                {attachmentCount > 1 ? (
                  <span className="tabular-nums">{attachmentCount}</span>
                ) : null}
              </span>
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
  //   The chevron count badge is an explicit unconditional toggle.
  // - Grandchildren (depth 2) are always leaves.
  const renderNoteTree = (
    allNotes: Note[],
    selectedId: string | null,
    onSelect: (id: string, hasChildren?: boolean) => void,
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
      isLastSibling = false,
    ): React.ReactNode => {
      if (depth > 2) return null; // hard safety — we only support parent / child / grandchild

      const isSelected = note.id === selectedId;

      // Grandchildren (depth 2) are always leaves — even if legacy data has deeper descendants.
      const rawKids = childrenMap.get(note.id) || [];
      const kids = depth >= 2 ? [] : rawKids;
      const directChildCount = kids.length;
      const showChildren = directChildCount > 0 && isExpanded(note.id);

      const row = (
        <NoteListItem
          note={note}
          isSelected={isSelected}
          onSelect={onSelect}
          onDelete={onDelete}
          depth={depth}
          hasChildren={directChildCount > 0}
          directChildCount={directChildCount}
          subtreeCount={subtreeCounts.get(note.id) ?? 1}
          isInActiveFamily={isInActiveFamily(note.id)}
          onToggleChildren={toggleExpansion}
          isOpen={isExpanded(note.id)}
          // For all root notes (depth 0), suppress the row's own border/rounding.
          // The family wrapper below always provides the single consistent border the user likes.
          suppressOwnBorder={depth === 0 || forceSuppressBorder}
          isLastSibling={isLastSibling}
          linkedTaskStats={getNoteLinkedTaskStats(note, tasks)}
          attachmentCount={attachmentCounts[note.id] ?? 0}
          isMobile={isMobile}
        />
      );

      const renderChildList = () => (
        <div className="note-tree-children space-y-1" role="group">
          {kids.map((child, index) => (
            <React.Fragment key={child.id}>
              {renderItemAndChildren(
                child,
                depth + 1,
                true,
                index === kids.length - 1,
              )}
            </React.Fragment>
          ))}
        </div>
      );

      // Every root note (depth 0) is always wrapped in the family border container.
      if (depth === 0) {
        const familyIsActive = activeRootId === note.id;
        const familyWrapperClass = cn(
          "note-tree-family",
          familyIsActive && "note-tree-family--active",
        );

        return (
          <div key={note.id} className={familyWrapperClass}>
            {row}
            {showChildren && renderChildList()}
          </div>
        );
      }

      if (!showChildren) {
        return <React.Fragment key={note.id}>{row}</React.Fragment>;
      }

      return (
        <React.Fragment key={note.id}>
          {row}
          {renderChildList()}
        </React.Fragment>
      );
    };

    // Top level = only roots. Everything else appears inline under its parent when opened.
    const roots = childrenMap.get(null) || [];
    return roots.map((root, index) => (
      <React.Fragment key={root.id}>
        {renderItemAndChildren(root, 0, false, index === roots.length - 1)}
      </React.Fragment>
    ));
  };

  const mobileLayoutClass = isMobile ? "notes-mobile-list" : "";

  useEffect(() => {
    if (!isMobile || !selectedNoteId) {
      openedNoteSnapshotRef.current = null;
      setMobileDraft(null);
      return;
    }

    if (openedNoteSnapshotRef.current?.noteId === selectedNoteId) {
      return;
    }

    const note = notes.find((n) => n.id === selectedNoteId);
    if (!note) return;

    const snapshot = {
      noteId: note.id,
      title: note.title || "",
      content: note.content || "",
    };
    openedNoteSnapshotRef.current = snapshot;
    setMobileDraft({ title: snapshot.title, content: snapshot.content });
  }, [isMobile, selectedNoteId, notes]);

  const handleDrawerCancel = useCallback(async () => {
    const snapshot = openedNoteSnapshotRef.current;
    if (snapshot) {
      await onUpdateNote(snapshot.noteId, {
        title: snapshot.title,
        content: snapshot.content,
      });
    }
    openedNoteSnapshotRef.current = null;
    setMobileDraft(null);
    onSelectNote(null);
  }, [onUpdateNote, onSelectNote]);

  const handleDrawerSave = useCallback(async () => {
    if (!selectedNoteId || !mobileDraft) return;
    setIsSavingMobileNote(true);
    try {
      await onUpdateNote(selectedNoteId, {
        title: mobileDraft.title,
        content: mobileDraft.content,
      });
      openedNoteSnapshotRef.current = null;
      setMobileDraft(null);
      onSelectNote(null);
    } finally {
      setIsSavingMobileNote(false);
    }
  }, [selectedNoteId, mobileDraft, onUpdateNote, onSelectNote]);

  const renderNoteDetail = (compact?: boolean) => {
    if (!selectedNote) return null;

    const selectedDepth = getNoteDepth(selectedNote.id);
    const canCreateSub = !!onCreateSubNote && selectedDepth < 2;
    const draftNote =
      compact && mobileDraft
        ? { ...selectedNote, title: mobileDraft.title, content: mobileDraft.content }
        : selectedNote;

    return (
      <div
        ref={compact ? undefined : detailScrollRef}
        className={cn(
          "notes-editor-scroll",
          compact
            ? "notes-editor-scroll--drawer notes-drawer-content"
            : "flex-1 overflow-y-auto min-h-0",
        )}
      >
        <div
          className={cn(
            "note-content-card w-full overflow-x-hidden flex flex-col",
            compact ? "rounded-none border-0 mb-0" : "rounded-xl border mb-4",
          )}
        >
          <NoteHeader
            selectedNote={draftNote}
            onTitleChange={(value) => {
              if (compact) {
                setMobileDraft((prev) => (prev ? { ...prev, title: value } : prev));
                return;
              }
              onUpdateNote(selectedNote.id, { title: value });
            }}
            onDelete={() => handleDeleteNote(selectedNote.id)}
            linkedTaskStats={getNoteLinkedTaskStats(selectedNote, tasks)}
            backlinkCount={getBacklinkCount(notes, selectedNote.id)}
            onCreateSubNote={
              canCreateSub
                ? () => {
                    onCreateSubNote(selectedNote.id).then((newId) => {
                      if (newId) {
                        onSelectNote(newId);
                        setPendingAutoFocusTitleId(newId);
                      }
                    });
                  }
                : undefined
            }
            autoFocusTitle={pendingAutoFocusTitleId === selectedNote.id}
            onTitleAutoFocusDone={() => setPendingAutoFocusTitleId(null)}
            compact={compact}
            drawer={compact}
          />
          <TipTapEditor
            key={selectedNote.id}
            noteId={selectedNote.id}
            className="!rounded-none !border-0 bg-transparent"
            content={draftNote.content}
            onChange={(newContent) => {
              if (compact) {
                setMobileDraft((prev) =>
                  prev && newContent !== prev.content ? { ...prev, content: newContent } : prev,
                );
                return;
              }
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
            linkedItems={(selectedNote.linkedTaskIds || [])
              .map((taskId) => {
                const t = tasks.find((tt) => tt.id === taskId);
                return t ? { id: t.id, title: t.title, type: "task" as const } : null;
              })
              .filter(Boolean) as Array<{ id: string; title: string; type: "task" | "note" }>}
            linkableItems={[
              ...notes
                .filter((n) => n.id !== selectedNote.id)
                .map((n) => ({ id: n.id, title: n.title || "Untitled Note", type: "note" as const })),
              ...tasks.map((t) => ({ id: t.id, title: t.title, type: "task" as const })),
            ]}
            backlinks={computedBacklinks}
            onMentionLinked={
              onMentionLinked ||
              ((item) => {
                if (item.type === "task") {
                  onLinkTaskToNote?.(selectedNote.id, item.id);
                } else if (item.type === "note") {
                  onLinkNoteToNote?.(selectedNote.id, item.id);
                }
              })
            }
            onMentionsChanged={onMentionsChangedProp || onMentionsChanged}
            onRemoveLinked={onRemoveLinked}
            onRemoveBacklink={onRemoveBacklink}
            compactToolbar={compact}
            belowToolbar={
              isLive ? (
                <NoteAttachmentsPanel
                  embedded
                  compact={compact}
                  selectedNote={selectedNote}
                  countHint={attachmentCounts[selectedNote.id]}
                  countsReady={!attachmentCountsLoading}
                  onCountChange={setNoteCount}
                />
              ) : undefined
            }
          />
        </div>

        <LinkedTasksPanel
          selectedNote={selectedNote}
          tasks={tasks}
          onLinkTaskToNote={onLinkTaskToNote}
          onUnlinkTaskFromNote={onUnlinkTaskFromNote}
          onOpenTask={onOpenTask}
          onToggleTaskComplete={onToggleTaskComplete}
          onCreateTaskAndLink={onCreateTaskAndLink}
          compact={compact}
        />

        {compact && (
          <div className="notes-drawer-delete px-0 pt-2 pb-4">
            <button
              type="button"
              onClick={() => setPendingDeleteNoteId(selectedNote.id)}
              className={cn(
                "w-full min-h-[50px] rounded-xl text-sm font-semibold tracking-tight",
                "text-white bg-gradient-to-r from-[#9f1239] via-[#be123c] to-[#e11d48]",
                "border border-[#fb7185]/35 shadow-[0_8px_24px_rgba(190,18,57,0.28)]",
                "hover:from-[#881337] hover:via-[#9f1239] hover:to-[#be123c]",
                "active:scale-[0.98] transition",
              )}
              aria-label="Delete note"
            >
              Delete note
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("flex h-full min-h-0 overflow-hidden notes-root", mobileLayoutClass)}>
      {!detailOnly && (
      <div className="notes-sidebar w-56 sm:w-64 md:w-72 border-r border-white/10 flex flex-col bg-[#0a0a0f] flex-shrink-0 overflow-hidden overflow-x-hidden min-h-0">
        <NotesSidebarHeader
          showOpenTasksOnly={showOpenTasksOnly}
          onToggleOpenTasksOnly={() => setShowOpenTasksOnly((prev) => !prev)}
          hasOverdueOpenTaskNotes={hasOverdueOpenTaskNotes}
          openTasksNoteCount={openTasksNoteCount}
          onCreateNote={handleCreateNote}
          isCreating={isCreating}
        />

        {/* Search — clean, no icon, full modern treatment */}
        <div className="notes-sidebar-search px-3 py-2 border-b border-white/10">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111114] border border-white/10 rounded-xl pl-3 pr-3 py-2 text-sm focus:outline-none focus:border-[#c084fc]/40 focus:ring-1 focus:ring-[#c084fc]/20 placeholder:text-[#52525b] transition-all touch-manipulation"
            aria-label="Search notes"
          />
        </div>

        {isLive && attachmentCountsLoading && displayNotes.length > 0 && (
          <div
            className="flex items-center gap-1.5 border-b border-white/5 px-3 py-1.5 text-[10px] text-[#71717a]"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#c084fc]/70" aria-hidden />
            <span>Loading attachment indicators for {displayNotes.length} note{displayNotes.length === 1 ? "" : "s"}…</span>
          </div>
        )}

        {/* Notes List with Drag & Drop for reparenting + reordering */}
        {/* ARIA tree for keyboard + screen reader support (high-impact a11y polish) */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-1.5 touch-pan-y"
          role="tree"
          aria-label="Notes tree"
          aria-multiselectable="false"
          data-notes-tree
        >
          {displayNotes.length === 0 && (
            <div className="px-4 py-8 text-center text-[#71717a] text-sm">
              {showOpenTasksOnly
                ? searchQuery
                  ? "No notes with open tasks match your search."
                  : "No notes with open linked tasks."
                : searchQuery
                  ? "No notes match your search."
                  : "No notes yet. Create your first one."}
            </div>
          )}

          {/* Plain list (no DnD). Search / open-tasks filter = flat list. Normal = recursive tree. */}
          {useFlatNoteList ? (
            // Search results: flat, pure recency (already sorted by useNoteSearch), deduped for safety
            (() => {
              const seen = new Set<string>();
              const safe = displayNotes.filter((n) => {
                const k = String(n?.id || "");
                if (!k || seen.has(k)) return false;
                seen.add(k);
                return true;
              });
              return safe.map((note) => {
                const isSelected = note.id === selectedNoteId;
                // In search we still show a flat list, but we can still show the count badge
                const kids = notes.filter((n) => (n.parentNoteId || null) === note.id);
                const hasChildren = kids.length > 0;
                return (
                  <NoteListItem
                    key={note.id}
                    note={note}
                    isSelected={isSelected}
                    onSelect={handleListNoteSelect}
                    onDelete={handleDeleteNote}
                    depth={0}
                    hasChildren={hasChildren}
                    directChildCount={kids.length}
                    subtreeCount={subtreeCounts.get(note.id) ?? 1}
                    isInActiveFamily={false}
                    onToggleChildren={toggleExpansion}
                    isOpen={false}
                    linkedTaskStats={getNoteLinkedTaskStats(note, tasks)}
                    attachmentCount={attachmentCounts[note.id] ?? 0}
                    isMobile={isMobile}
                  />
                );
              });
            })()
          ) : (
            renderNoteTree(displayNotes, selectedNoteId, handleListNoteSelect, handleDeleteNote)
          )}
        </div>
      </div>
      )}

      <div className={cn(
        "notes-editor-panel relative flex-1 flex flex-col min-w-0 overflow-hidden",
        detailOnly ? "flex" : "hidden md:flex",
      )}>
        {selectedNote ? (
          <div className="flex-1 flex flex-col min-h-0">{renderNoteDetail()}</div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-12">
            <div>
              <div className="text-[#c084fc] mb-4">
                <Star className="h-10 w-10 mx-auto" />
              </div>
              <div className="text-xl font-semibold tracking-tight mb-2">
                {detailOnly ? "No file selected" : "No note selected"}
              </div>
              <div className="text-[#71717a] max-w-xs mx-auto">
                {detailOnly
                  ? "Select a file from the list or open Review to approve incoming records."
                  : "Select a note from the list or create a new one to start writing with the full TipTap editor."}
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

      {isMobile && (
        <NoteMobileDrawer
          open={!!selectedNote && !!mobileDraft}
          onSave={() => void handleDrawerSave()}
          onCancel={() => void handleDrawerCancel()}
          isSaving={isSavingMobileNote}
        >
          {renderNoteDetail(true)}
        </NoteMobileDrawer>
      )}

      <ConfirmationModal
        open={!!pendingDeleteNoteId}
        onOpenChange={(open) => !open && setPendingDeleteNoteId(null)}
        title="Delete this note?"
        highlight={selectedNote?.title || "Untitled Note"}
        description="This note and its content will be permanently removed. Linked tasks will stay in your workspace."
        confirmText="Delete note"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDeleteNoteId) return;
          await handleDeleteNote(pendingDeleteNoteId);
          setPendingDeleteNoteId(null);
          onSelectNote(null);
        }}
      />
    </div>
  );
}
