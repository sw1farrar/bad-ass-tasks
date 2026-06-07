"use client";

import React, { useState, useEffect } from "react";
import { Trash2, Plus } from "lucide-react";
import type { NoteLinkedTaskStats } from "../lib/noteLinkedTaskStats";
import { NoteLinkedTaskBadge } from "./NoteLinkedTaskBadge";

interface NoteHeaderProps {
  selectedNote: any;
  onTitleChange: (value: string) => void;
  onDelete: () => void;
  linkedTaskStats: NoteLinkedTaskStats;
  /** Backlink count from single-source selector (useBacklinks.ts). Optional for non-regression. */
  backlinkCount?: number;

  /** Optional: create a direct child under the currently viewed note (wired from the notes list header area). */
  onCreateSubNote?: () => void;

  /**
   * When true, immediately focus the title input and select its entire text.
   * Used after creating a brand new note (top-level or sub) so the user can start typing the title right away.
   * Parent is responsible for clearing this flag after the focus has occurred (via onTitleAutoFocusDone).
   */
  autoFocusTitle?: boolean;

  /** Called once after we have performed the auto-focus + select for a newly created note. */
  onTitleAutoFocusDone?: () => void;
}

/**
 * Extracted Note header (title + actions) - M2 extraction for cleanliness.
 *
 * Title editing behavior (2026-05-30):
 * - Uses local state while typing so the user can finish their edit without constant saves.
 * - Only commits to the store/database (via onTitleChange) on blur or Enter.
 * - This is intentional and different from the TipTap body, which keeps real-time
 *   onChange for collaborative editing (other users see live keystrokes).
 */
export function NoteHeader({
  selectedNote,
  onTitleChange,
  onDelete,
  linkedTaskStats,
  backlinkCount,
  onCreateSubNote,
  autoFocusTitle,
  onTitleAutoFocusDone,
}: NoteHeaderProps) {
  const [localTitle, setLocalTitle] = useState(selectedNote.title);
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  // Sync local state when the selected note changes externally
  // (e.g. realtime collab from another user, or switching notes)
  useEffect(() => {
    setLocalTitle(selectedNote.title);
  }, [selectedNote.id, selectedNote.title]);

  // Auto-focus + fully select the title input right after a new note is created.
  // This lets the user immediately start typing a meaningful title without clicking.
  useEffect(() => {
    if (autoFocusTitle && titleInputRef.current) {
      const rafId = requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
        // Signal the parent that we're done so it can clear the one-shot flag.
        onTitleAutoFocusDone?.();
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [autoFocusTitle, selectedNote.id, onTitleAutoFocusDone]);

  const commitTitle = () => {
    if (localTitle !== selectedNote.title) {
      onTitleChange(localTitle);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTitle();
      // Blur so the user gets clear feedback that the change is locked in
      e.currentTarget.blur();
    }
  };

  return (
    <div className="note-header px-4 sm:px-6 pt-4 pb-2 border-b border-[var(--note-canvas-border,rgba(24,24,27,0.1))] flex flex-wrap items-center justify-between gap-2 sm:gap-4">
      <input
        ref={titleInputRef}
        type="text"
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={handleKeyDown}
        className="bg-transparent text-2xl font-semibold tracking-tighter text-[var(--note-canvas-text,#18181b)] placeholder:text-[var(--note-canvas-text-muted,#a1a1aa)] focus:outline-none flex-1 min-w-0"
        placeholder="Untitled Note"
      />
      <div className="flex items-center gap-2 shrink-0">
        {onCreateSubNote && (
          <button
            onClick={onCreateSubNote}
            className="text-xs text-[#7c3aed] hover:text-[#5b21b6] flex items-center gap-1.5 px-3 py-1.5 sm:py-1 rounded-lg hover:bg-[#7c3aed]/10 border border-[#7c3aed]/25 touch-manipulation min-h-[40px] sm:min-h-0 focus-visible:ring-1 focus-visible:ring-[#7c3aed]/40 focus-visible:outline-none font-medium"
            title="Create a new sub-note under this note"
            aria-label="Create sub-note"
          >
            <Plus className="h-3.5 w-3.5" />
            Sub-note
          </button>
        )}

        <NoteLinkedTaskBadge stats={linkedTaskStats} />
        {backlinkCount != null && backlinkCount > 0 && (
          <div className="text-xs px-2 py-1 rounded bg-[#00ff9f]/10 text-[#00ff9f] border border-[#00ff9f]/20" title="Incoming backlinks (from centralized selector)">
            ← {backlinkCount}
          </div>
        )}

        <button
          onClick={onDelete}
          className="text-xs text-[var(--note-canvas-text-muted,#71717a)] hover:text-[#dc2626] flex items-center gap-1.5 px-3 py-1.5 sm:py-1 rounded-lg hover:bg-black/5 touch-manipulation min-h-[40px] sm:min-h-0 focus-visible:ring-1 focus-visible:ring-[#dc2626]/40 focus-visible:outline-none"
          aria-label="Delete current note"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}
