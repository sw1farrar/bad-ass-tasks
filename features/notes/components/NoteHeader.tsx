"use client";

import React, { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoteLinkedTaskStats } from "../lib/noteLinkedTaskStats";
import { NoteLinkedTaskBadge } from "./NoteLinkedTaskBadge";

interface NoteHeaderProps {
  selectedNote: any;
  onTitleChange: (value: string) => void;
  onDelete: () => void;
  linkedTaskStats: NoteLinkedTaskStats;
  /** Backlink count from single-source selector (useBacklinks.ts). Optional for non-regression. */
  backlinkCount?: number;

  /**
   * When true, immediately focus the title input and select its entire text.
   * Used after creating a brand new note (top-level or sub) so the user can start typing the title right away.
   * Parent is responsible for clearing this flag after the focus has occurred (via onTitleAutoFocusDone).
   */
  autoFocusTitle?: boolean;

  /** Called once after we have performed the auto-focus + select for a newly created note. */
  onTitleAutoFocusDone?: () => void;

  /** Tighter layout for mobile drawer */
  compact?: boolean;
  /** Mobile drawer: title only — no sub-note, badges, or delete in header */
  drawer?: boolean;
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
  autoFocusTitle,
  onTitleAutoFocusDone,
  compact,
  drawer,
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

  const selectAllTitle = (e: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>) => {
    e.currentTarget.select();
  };

  if (drawer) {
    return (
      <div className="note-header note-header--drawer border-b border-[var(--note-canvas-border,rgba(24,24,27,0.1))] px-3 pt-2 pb-1.5">
        <input
          ref={titleInputRef}
          type="text"
          value={localTitle}
          onChange={(e) => {
            setLocalTitle(e.target.value);
            onTitleChange(e.target.value);
          }}
          onBlur={commitTitle}
          onKeyDown={handleKeyDown}
          onFocus={selectAllTitle}
          onClick={selectAllTitle}
          className="note-title-input w-full bg-transparent text-lg font-semibold tracking-tight text-[var(--note-canvas-text,#18181b)] placeholder:text-[var(--note-canvas-text-muted,#a1a1aa)] focus:outline-none leading-snug caret-[var(--neon-purple-dark,#7c3aed)]"
          placeholder="Untitled Note"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "note-header border-b border-[var(--note-canvas-border,rgba(24,24,27,0.1))] flex flex-wrap items-center justify-between gap-2",
        compact ? "px-3 pt-2.5 pb-1.5 gap-1.5" : "px-4 sm:px-6 pt-4 pb-2 sm:gap-4",
      )}
    >
      <input
        ref={titleInputRef}
        type="text"
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={handleKeyDown}
        onFocus={selectAllTitle}
        onClick={selectAllTitle}
        className={cn(
          "bg-transparent font-semibold tracking-tighter text-[var(--note-canvas-text,#18181b)] placeholder:text-[var(--note-canvas-text-muted,#a1a1aa)] focus:outline-none flex-1 min-w-0",
          compact ? "text-lg leading-snug" : "text-2xl",
        )}
        placeholder="Untitled Note"
      />
      <div className="flex items-center gap-1 shrink-0">
        <NoteLinkedTaskBadge stats={linkedTaskStats} compact={compact} />
        {backlinkCount != null && backlinkCount > 0 && (
          <div
            className={cn(
              "rounded bg-neon-green/10 text-neon-green border border-neon-green/20",
              compact ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
            )}
            title="Incoming backlinks (from centralized selector)"
          >
            ← {backlinkCount}
          </div>
        )}

        <button
          onClick={onDelete}
          className={cn(
            "text-[var(--note-canvas-text-muted,#71717a)] hover:text-[var(--priority-p0)] flex items-center rounded-lg hover:bg-surface-overlay touch-manipulation focus-visible:ring-1 focus-visible:ring-[var(--priority-p0)]/40 focus-visible:outline-none",
            compact
              ? "p-1.5 min-h-0"
              : "text-xs gap-1.5 px-3 py-1.5 sm:py-1 min-h-[40px] sm:min-h-0",
          )}
          aria-label="Delete current note"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {!compact && "Delete"}
        </button>
      </div>
    </div>
  );
}
