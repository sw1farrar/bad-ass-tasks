"use client";

import React from "react";
import { Eye, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { prefetchNoteAttachments } from "@/lib/notes/noteAttachmentListCache";
import type { Note, Task } from "@/types";
import { recordTypeLabel } from "@/lib/files/fileTypes";
import { safeFormatTimestampIso } from "@/lib/datetime";
import { NoteLinkedTaskBadge } from "@/features/notes/components/NoteLinkedTaskBadge";
import { getNoteLinkedTaskStats } from "@/features/notes/lib/noteLinkedTaskStats";

interface ReviewPanelProps {
  files: Note[];
  tasks: Task[] | Map<string, Task>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReview: (id: string) => void;
  onOpenEditor?: (id: string) => void;
  attachmentCounts?: Record<string, number>;
}

export function ReviewPanel({
  files,
  tasks,
  selectedId,
  onSelect,
  onReview,
  onOpenEditor,
  attachmentCounts = {},
}: ReviewPanelProps) {
  if (files.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="text-lg font-medium text-text-primary mb-1">Review is clear</div>
        <p className="text-sm text-text-muted max-w-xs">
          New emails, uploads, and files you create will appear here for tagging and filing.
        </p>
      </div>
    );
  }

  return (
    <ul className="files-list-scroll files-review-list flex-1 overflow-y-auto" aria-label="Review queue">
      {files.map((file) => {
        const isSelected = file.id === selectedId;
        const attachCount = attachmentCounts[file.id] ?? 0;
        const snippet = (file.searchPlain ?? file.memo ?? "").slice(0, 120);
        const linkedTaskStats = getNoteLinkedTaskStats(file, tasks);

        return (
          <li
            key={file.id}
            className={cn(
              "relative files-review-queue-item",
              isSelected && "files-review-queue-item--selected",
              linkedTaskStats.hasOverdue && "files-list-item--overdue-tasks",
              linkedTaskStats.hasOpen &&
                !linkedTaskStats.hasOverdue &&
                "files-list-item--open-tasks",
            )}
          >
            <div className="px-4 py-4 flex gap-2 items-start">
              <button
                type="button"
                className="files-list-item__body flex-1 min-w-0 text-left relative"
                onClick={() => onSelect(file.id)}
                onMouseEnter={() => {
                  if (attachCount > 0) prefetchNoteAttachments(file.id);
                }}
                onFocus={() => {
                  if (attachCount > 0) prefetchNoteAttachments(file.id);
                }}
                onDoubleClick={() => onOpenEditor?.(file.id)}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-neon-purple font-semibold">
                    {recordTypeLabel(file.recordType ?? "note")}
                  </span>
                  <span className="text-[10px] text-text-faint font-mono">
                    {safeFormatTimestampIso(file.createdAt, "MMM d", "")}
                  </span>
                </div>
                <div className="flex items-start gap-2 min-w-0">
                  <div className="font-medium text-sm text-text-primary truncate flex-1 min-w-0">
                    {file.title || "Untitled"}
                  </div>
                  {linkedTaskStats.hasOpen && (
                    <NoteLinkedTaskBadge stats={linkedTaskStats} compact className="shrink-0" />
                  )}
                </div>
                {snippet && (
                  <div className="text-xs text-text-muted line-clamp-2 mt-1">{snippet}</div>
                )}
                {attachCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-text-muted mt-1">
                    <Paperclip className="h-3 w-3" />
                    {attachCount} attachment{attachCount === 1 ? "" : "s"}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onReview(file.id)}
                className="files-inline-action-button files-inline-action-button--review shrink-0 min-h-[30px] px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1"
              >
                <Eye className="h-3 w-3" />
                Review
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}