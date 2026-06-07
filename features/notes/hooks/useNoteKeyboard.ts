"use client";

import { useEffect } from "react";

/**
 * useNoteKeyboard
 * M2 extraction: Centralizes note-specific keyboard shortcuts.
 * Currently handles Escape to deselect note.
 * Can be expanded for note-specific shortcuts (e.g., Cmd+K in notes context).
 */
export function useNoteKeyboard({
  selectedNoteId,
  setSelectedNoteId,
  isTyping,
}: {
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string | null) => void;
  isTyping: boolean;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTyping) return;

      // Escape to deselect note (if no other modals open - caller should gate)
      if (e.key === "Escape" && selectedNoteId) {
        // Only if no higher priority handlers (e.g. modals) - caller controls
        setSelectedNoteId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNoteId, setSelectedNoteId, isTyping]);
}
