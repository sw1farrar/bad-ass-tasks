"use client";

import React, { useState, useEffect } from "react";
import { Star, History, Trash2 } from "lucide-react";

interface NoteHeaderProps {
  selectedNote: any;
  onTitleChange: (value: string) => void;
  onOpenHistory: () => void;
  onDelete: () => void;
  historyCount: number;
  linkedTaskCount: number;
  /** Backlink count from single-source selector (useBacklinks.ts). Optional for non-regression. */
  backlinkCount?: number;
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
  onOpenHistory,
  onDelete,
  historyCount,
  linkedTaskCount,
  backlinkCount,
}: NoteHeaderProps) {
  const [localTitle, setLocalTitle] = useState(selectedNote.title);

  // Sync local state when the selected note changes externally
  // (e.g. realtime collab from another user, or switching notes)
  useEffect(() => {
    setLocalTitle(selectedNote.title);
  }, [selectedNote.id, selectedNote.title]);

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
    <div className="px-4 sm:px-6 pt-4 pb-2 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
      <input
        type="text"
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={handleKeyDown}
        className="bg-transparent text-2xl font-semibold tracking-tighter focus:outline-none flex-1 min-w-0"
        placeholder="Untitled Note"
      />
      <div className="flex items-center gap-2 shrink-0">
        {linkedTaskCount > 0 && (
          <div className="text-xs px-2 py-1 rounded bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/20">
            {linkedTaskCount} linked task{linkedTaskCount > 1 ? "s" : ""}
          </div>
        )}
        {backlinkCount != null && backlinkCount > 0 && (
          <div className="text-xs px-2 py-1 rounded bg-[#00ff9f]/10 text-[#00ff9f] border border-[#00ff9f]/20" title="Incoming backlinks (from centralized selector)">
            ← {backlinkCount}
          </div>
        )}

        <button
          onClick={onOpenHistory}
          className="text-xs text-[#c084fc] hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 rounded-lg hover:bg-white/5 border border-[#c084fc]/20 touch-manipulation min-h-[40px] sm:min-h-0 focus-visible:ring-1 focus-visible:ring-[#c084fc]/60 focus-visible:outline-none"
          title="View version history for this note"
          aria-label="Open version history"
        >
          <History className="h-3.5 w-3.5" />
          {historyCount > 0 ? `${historyCount}` : "History"}
        </button>

        <button
          onClick={onDelete}
          className="text-xs text-[#71717a] hover:text-[#ff3366] flex items-center gap-1.5 px-3 py-1.5 sm:py-1 rounded-lg hover:bg-white/5 touch-manipulation min-h-[40px] sm:min-h-0 focus-visible:ring-1 focus-visible:ring-[#ff3366]/50 focus-visible:outline-none"
          aria-label="Delete current note"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}
