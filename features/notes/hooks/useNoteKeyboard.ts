"use client";

import { useEffect } from "react";
import { hasOpenOverlay } from "@/lib/dom/hasOpenOverlay";

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

      if (e.key === "Escape" && selectedNoteId && !hasOpenOverlay()) {
        setSelectedNoteId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNoteId, setSelectedNoteId, isTyping]);
}
