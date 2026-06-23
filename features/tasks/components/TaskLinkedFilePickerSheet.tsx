"use client";

import React from "react";
import { FileText } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { cn } from "@/lib/utils";
import type { Note } from "@/types";
import { recordTypeLabel } from "@/lib/files/fileTypes";

interface TaskLinkedFilePickerSheetProps {
  open: boolean;
  onClose: () => void;
  taskTitle?: string;
  notes: Note[];
  onSelect: (noteId: string) => void;
}

export function TaskLinkedFilePickerSheet({
  open,
  onClose,
  taskTitle,
  notes,
  onSelect,
}: TaskLinkedFilePickerSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Linked files"
      ariaLabel="Choose a linked file to open"
    >
      <div className="task-linked-file-picker space-y-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {taskTitle ? (
          <p className="text-sm text-text-secondary leading-relaxed truncate" title={taskTitle}>
            For task: <span className="text-text-primary font-medium">{taskTitle}</span>
          </p>
        ) : null}
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(note.id);
                  onClose();
                }}
                className={cn(
                  "task-linked-file-picker__option flex w-full items-center gap-3 rounded-xl border border-border-glass bg-surface-hover/50 px-3 py-3 text-left transition min-h-[44px]",
                  "hover:border-neon-purple/35 hover:bg-surface-hover active:scale-[0.99]",
                )}
              >
                <FileText className="h-4 w-4 shrink-0 text-neon-purple" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {note.title || "Untitled"}
                  </div>
                  {note.memo ? (
                    <div className="text-xs text-text-muted truncate mt-0.5">{note.memo}</div>
                  ) : note.recordType ? (
                    <div className="text-[10px] text-text-faint uppercase tracking-wide mt-0.5">
                      {recordTypeLabel(note.recordType)}
                    </div>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </BottomSheet>
  );
}