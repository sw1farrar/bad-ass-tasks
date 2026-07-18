"use client";

import React, { useMemo, useState } from "react";
import { FileText, Link2, Plus, Unlink, X } from "lucide-react";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/store/useTaskStore";
import type { Note, Task } from "@/types";
import { getTaskLinkedFileNotes } from "@/features/tasks/lib/taskLinkedFiles";

interface TaskLinkedFilesSectionProps {
  task: Task;
  compact?: boolean;
  onOpenNote?: (noteId: string) => void;
  onTaskLinksChange?: (linkedNoteIds: string[]) => void;
}

export function TaskLinkedFilesSection({
  task,
  compact = false,
  onOpenNote,
  onTaskLinksChange,
}: TaskLinkedFilesSectionProps) {
  const notes = useTaskStore((s) => s.notes);
  const updateTask = useTaskStore((s) => s.updateTask);
  const updateNote = useTaskStore((s) => s.updateNote);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [unlinkNote, setUnlinkNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);

  const linkedNotes = useMemo(() => getTaskLinkedFileNotes(task, notes), [task, notes]);
  const linkableNotes = useMemo(() => {
    const linked = new Set(task.linkedNoteIds || []);
    return notes
      .filter((n) => !linked.has(n.id) && !n.notebookId)
      .slice()
      .sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }))
      .slice(0, 40);
  }, [notes, task.linkedNoteIds]);

  const persistLinks = async (nextIds: string[], noteId: string, noteTaskIds: string[]) => {
    setBusy(true);
    try {
      await updateTask(task.id, { linkedNoteIds: nextIds }, { silent: true });
      await updateNote(noteId, { linkedTaskIds: noteTaskIds });
      onTaskLinksChange?.(nextIds);
    } finally {
      setBusy(false);
    }
  };

  const handleLink = async (note: Note) => {
    const nextTaskLinks = Array.from(new Set([...(task.linkedNoteIds || []), note.id]));
    const nextNoteLinks = Array.from(new Set([...(note.linkedTaskIds || []), task.id]));
    await persistLinks(nextTaskLinks, note.id, nextNoteLinks);
    setPickerOpen(false);
  };

  const handleUnlink = async () => {
    if (!unlinkNote) return;
    const nextTaskLinks = (task.linkedNoteIds || []).filter((id) => id !== unlinkNote.id);
    const nextNoteLinks = (unlinkNote.linkedTaskIds || []).filter((id) => id !== task.id);
    await persistLinks(nextTaskLinks, unlinkNote.id, nextNoteLinks);
    setUnlinkNote(null);
  };

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          Linked files
          <span className="text-text-muted">({linkedNotes.length})</span>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-border-glass px-2 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary transition min-h-[32px]"
        >
          <Plus className="h-3 w-3" aria-hidden />
          Add
        </button>
      </div>

      {linkedNotes.length === 0 ? (
        <p className="text-xs text-text-muted rounded-xl border border-dashed border-border-glass px-3 py-2.5">
          No linked files yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {linkedNotes.map((note) => (
            <li
              key={note.id}
              className="flex items-center gap-2 rounded-lg border border-border-glass bg-surface-hover/40 px-2.5 py-1.5 min-h-[40px]"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-neon-purple" aria-hidden />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-xs font-medium text-text-primary hover:text-neon-purple transition"
                onClick={() => onOpenNote?.(note.id)}
                title={note.title || "Untitled"}
              >
                {note.title || "Untitled"}
              </button>
              <button
                type="button"
                onClick={() => setUnlinkNote(note)}
                disabled={busy}
                className="shrink-0 rounded-md p-1.5 text-text-muted hover:text-[var(--priority-p0)] hover:bg-[var(--priority-p0)]/10 transition"
                aria-label={`Unlink ${note.title || "file"}`}
              >
                <Unlink className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {pickerOpen ? (
        <div className="rounded-xl border border-border-glass bg-bg-panel p-2 space-y-1 max-h-44 overflow-y-auto">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-[11px] font-medium text-text-muted">Choose a file</span>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="p-1 rounded-md text-text-muted hover:text-text-primary"
              aria-label="Close file picker"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {linkableNotes.length === 0 ? (
            <p className="text-xs text-text-muted px-2 py-2">No available files to link.</p>
          ) : (
            linkableNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                disabled={busy}
                onClick={() => void handleLink(note)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-surface-hover transition min-h-[40px]"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
                <span className="truncate">{note.title || "Untitled"}</span>
              </button>
            ))
          )}
        </div>
      ) : null}

      <ConfirmationModal
        open={!!unlinkNote}
        onOpenChange={(open) => {
          if (!open) setUnlinkNote(null);
        }}
        title="Unlink this file?"
        highlight={unlinkNote?.title || "Untitled"}
        description="The file stays in Files — only the link to this task is removed."
        confirmText="Unlink"
        cancelText="Cancel"
        onConfirm={() => void handleUnlink()}
      />
    </div>
  );
}
