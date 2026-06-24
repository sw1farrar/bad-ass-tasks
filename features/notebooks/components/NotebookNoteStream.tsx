"use client";

import React, { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileText, Loader2, Pencil, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeFormatTimestampIso } from "@/lib/datetime";
import type { Note } from "@/types";

interface NotebookNoteStreamProps {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNote: () => void;
  onRenameNote: (id: string, title: string) => void;
  isCreating?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  /** Enter rename mode with title selected (new note flow). */
  focusRenameId?: string | null;
  onFocusRenameConsumed?: () => void;
}

const ROW_ESTIMATE_PX = 56;

export function NotebookNoteStream({
  notes,
  selectedId,
  onSelect,
  onCreateNote,
  onRenameNote,
  isCreating,
  searchQuery = "",
  onSearchQueryChange,
  focusRenameId,
  onFocusRenameConsumed,
}: NotebookNoteStreamProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    if (!focusRenameId || editingId != null) return;
    const note = notes.find((n) => n.id === focusRenameId);
    if (!note) return;
    setEditingId(note.id);
    setEditingTitle(note.title || "Untitled note");
  }, [focusRenameId, notes, editingId]);

  useEffect(() => {
    if (!focusRenameId || editingId !== focusRenameId) return;
    const frame = requestAnimationFrame(() => {
      const input = renameInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
      onFocusRenameConsumed?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRenameId, editingId, onFocusRenameConsumed]);

  const rowVirtualizer = useVirtualizer({
    count: notes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: 8,
  });

  const startRename = (note: Note) => {
    setEditingId(note.id);
    setEditingTitle(note.title || "Untitled note");
  };

  const commitRename = (id: string) => {
    const title = editingTitle.trim() || "Untitled note";
    onRenameNote(id, title);
    setEditingId(null);
    setEditingTitle("");
  };

  const emptyMessage = searchQuery.trim()
    ? "No notes match your search."
    : "No notes in this notebook yet.";

  return (
    <div className="notebooks-note-list flex flex-col min-h-0 h-full border-r border-border-glass bg-bg w-72 shrink-0">
      <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-border-glass shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">Notes</span>
        <button
          type="button"
          onClick={onCreateNote}
          disabled={isCreating}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neon-purple-tint hover:bg-neon-purple/10 border border-neon-purple/20 disabled:opacity-50"
        >
          {isCreating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          New
        </button>
      </div>

      <div className="px-3 py-2 border-b border-border-glass shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            placeholder="Search notes…"
            className="w-full bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint min-h-[40px]"
            aria-label="Search notes in notebook"
          />
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-text-muted">
          {emptyMessage}
        </div>
      ) : (
        <div
          ref={parentRef}
          className="files-list-scroll flex-1 min-w-0 overflow-y-auto"
          role="listbox"
          aria-label="Notes in notebook"
        >
          <div
            className="files-list-virtual relative w-full"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const note = notes[virtualRow.index];
              if (!note) return null;
              const isSelected = note.id === selectedId;
              const isEditing = editingId === note.id;
              const dateLabel = safeFormatTimestampIso(note.updatedAt, "MMM d", "");

              return (
                <div
                  key={note.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div
                    className={cn(
                      "files-list-item w-full text-left px-3 py-3 transition relative group",
                      isSelected && "files-list-item--selected",
                      !isSelected && !isEditing && "hover:bg-surface-hover",
                      !isEditing && "cursor-pointer",
                    )}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      {isEditing ? (
                        <>
                          <FileText className="h-4 w-4 shrink-0 text-neon-purple/70 mt-0.5" />
                          <input
                            ref={editingId === note.id ? renameInputRef : undefined}
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={() => commitRename(note.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(note.id);
                              if (e.key === "Escape") {
                                setEditingId(null);
                                setEditingTitle("");
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="min-w-0 flex-1 bg-bg-secondary border border-neon-purple/30 rounded-lg px-2 py-1 text-sm font-medium focus:outline-none"
                            aria-label="Rename note"
                          />
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => onSelect(note.id)}
                            onDoubleClick={() => startRename(note)}
                            className="flex min-w-0 flex-1 items-start gap-2 text-left -mx-3 -my-3 px-3 py-3 cursor-pointer"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-neon-purple/70 mt-0.5 pointer-events-none" />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-sm truncate text-text-primary">
                                {note.title || "Untitled note"}
                              </span>
                              {dateLabel && (
                                <span className="block text-[11px] text-text-muted mt-0.5">
                                  {dateLabel}
                                </span>
                              )}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(note);
                            }}
                            className="relative z-10 p-1.5 rounded-lg text-text-muted hover:text-neon-purple hover:bg-surface-hover shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            aria-label={`Rename ${note.title || "Untitled note"}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}