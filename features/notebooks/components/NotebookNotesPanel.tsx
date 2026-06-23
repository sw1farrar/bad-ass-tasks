"use client";

import React from "react";
import type { Note } from "@/types";
import { NotebookNoteStream } from "./NotebookNoteStream";
import { NotebookNoteEditor } from "./NotebookNoteEditor";

interface NotebookNotesPanelProps {
  notes: Note[];
  selectedNoteId: string | null;
  selectedNote: Note | null;
  isLive: boolean;
  isCreatingNote?: boolean;
  noteSearchQuery?: string;
  onNoteSearchQueryChange?: (query: string) => void;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => Promise<boolean | null>;
  onDeleteNote: (id: string) => Promise<boolean | null>;
  onHydrateNote: (id: string) => Promise<Note | null>;
  onRequestDeleteNote?: (id: string) => void;
  focusTitleNoteId?: string | null;
  onTitleFocusConsumed?: () => void;
}

export function NotebookNotesPanel({
  notes,
  selectedNoteId,
  selectedNote,
  isLive,
  isCreatingNote,
  noteSearchQuery,
  onNoteSearchQueryChange,
  onSelectNote,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onHydrateNote,
  onRequestDeleteNote,
  focusTitleNoteId,
  onTitleFocusConsumed,
}: NotebookNotesPanelProps) {
  return (
    <div className="notebooks-notes-panel flex flex-1 min-h-0 min-w-0">
      <NotebookNoteStream
        notes={notes}
        selectedId={selectedNoteId}
        onSelect={onSelectNote}
        onCreateNote={onCreateNote}
        onRenameNote={(id, title) => void onUpdateNote(id, { title })}
        isCreating={isCreatingNote}
        searchQuery={noteSearchQuery}
        onSearchQueryChange={onNoteSearchQueryChange}
      />
      <NotebookNoteEditor
        note={selectedNote}
        isLive={isLive}
        focusTitle={!!selectedNote && focusTitleNoteId === selectedNote.id}
        onTitleFocusConsumed={onTitleFocusConsumed}
        onUpdateNote={onUpdateNote}
        onDeleteNote={onDeleteNote}
        onHydrateNote={onHydrateNote}
        onRequestDelete={onRequestDeleteNote}
      />
    </div>
  );
}