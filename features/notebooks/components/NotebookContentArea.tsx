"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Notebook as NotebookIcon } from "lucide-react";
import type { Note, Notebook } from "@/types";
import { filterNotebookNotesBySearch } from "@/lib/notebooks/notebookFilters";
import { DEFAULT_NOTEBOOK_SECTION_TAB } from "@/lib/notebooks/notebookSections";
import { NotebookDetailHeader } from "./NotebookDetailHeader";
import { NotebookNotesPanel } from "./NotebookNotesPanel";
import { NotebookSectionMenu, type NotebookSectionTab } from "./NotebookSectionMenu";

interface NotebookContentAreaProps {
  notebook: Notebook | null;
  showNotebookHeader?: boolean;
  showSectionMenu?: boolean;
  notes: Note[];
  selectedNoteId: string | null;
  selectedNote: Note | null;
  isLive: boolean;
  isCreatingNote?: boolean;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => Promise<boolean | null>;
  onDeleteNote: (id: string) => Promise<boolean | null>;
  onHydrateNote: (id: string) => Promise<Note | null>;
  onUpdateNotebook: (id: string, updates: Partial<Pick<Notebook, "name" | "sortOrder">>) => void;
  onRequestDeleteNotebook: () => void;
  onRequestDeleteNote?: (id: string) => void;
  focusTitleNoteId?: string | null;
  onTitleFocusConsumed?: () => void;
  focusRenameNotebook?: boolean;
  onNotebookRenameFocusConsumed?: () => void;
}

export function NotebookContentArea({
  notebook,
  showNotebookHeader = true,
  showSectionMenu = true,
  notes,
  selectedNoteId,
  selectedNote,
  isLive,
  isCreatingNote,
  onSelectNote,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onHydrateNote,
  onUpdateNotebook,
  onRequestDeleteNotebook,
  onRequestDeleteNote,
  focusTitleNoteId,
  onTitleFocusConsumed,
  focusRenameNotebook,
  onNotebookRenameFocusConsumed,
}: NotebookContentAreaProps) {
  const [activeTab, setActiveTab] = useState<NotebookSectionTab>(DEFAULT_NOTEBOOK_SECTION_TAB);
  const [noteSearchQuery, setNoteSearchQuery] = useState("");

  useEffect(() => {
    setActiveTab(DEFAULT_NOTEBOOK_SECTION_TAB);
    setNoteSearchQuery("");
  }, [notebook?.id]);

  const filteredNotes = useMemo(
    () => (notebook ? filterNotebookNotesBySearch(notes, noteSearchQuery) : []),
    [notebook, notes, noteSearchQuery],
  );

  if (!notebook) {
    return (
      <div className="files-detail-column flex flex-1 flex-col items-center justify-center min-h-0 p-8 text-center">
        <NotebookIcon className="h-12 w-12 text-neon-purple/40 mb-4" />
        <p className="text-sm text-text-muted max-w-sm">
          Select a notebook from the list, or add a new one to start taking notes.
        </p>
      </div>
    );
  }

  return (
    <div className="files-detail-column flex flex-1 flex-col min-w-0 min-h-0 h-full">
      {showNotebookHeader && (
        <NotebookDetailHeader
          notebook={notebook}
          onRename={(name) => onUpdateNotebook(notebook.id, { name })}
          onDelete={onRequestDeleteNotebook}
          focusRename={focusRenameNotebook}
          onFocusRenameConsumed={onNotebookRenameFocusConsumed}
        />
      )}

      {showSectionMenu && (
        <NotebookSectionMenu activeTab={activeTab} onTabChange={setActiveTab} />
      )}

      {activeTab === "notes" && (
        <NotebookNotesPanel
          notes={filteredNotes}
          selectedNoteId={selectedNoteId}
          selectedNote={selectedNote}
          isLive={isLive}
          isCreatingNote={isCreatingNote}
          noteSearchQuery={noteSearchQuery}
          onNoteSearchQueryChange={setNoteSearchQuery}
          onSelectNote={onSelectNote}
          onCreateNote={onCreateNote}
          onUpdateNote={onUpdateNote}
          onDeleteNote={onDeleteNote}
          onHydrateNote={onHydrateNote}
          onRequestDeleteNote={onRequestDeleteNote}
          focusTitleNoteId={focusTitleNoteId}
          onTitleFocusConsumed={onTitleFocusConsumed}
        />
      )}
    </div>
  );
}