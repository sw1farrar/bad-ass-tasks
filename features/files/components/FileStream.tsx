"use client";

import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileText, Mail, Paperclip, Receipt, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { prefetchNoteAttachments } from "@/lib/notes/noteAttachmentListCache";
import type { FileRecordType, Note, Task } from "@/types";
import { safeFormatTimestampIso } from "@/lib/datetime";
import { NoteLinkedTaskBadge } from "@/features/notes/components/NoteLinkedTaskBadge";
import { getNoteLinkedTaskStats } from "@/features/notes/lib/noteLinkedTaskStats";

interface FileStreamProps {
  files: Note[];
  tasks: Task[] | Map<string, Task>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenEditor?: (id: string) => void;
  attachmentCounts?: Record<string, number>;
  emptyMessage?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

function RecordIcon({ type }: { type?: FileRecordType }) {
  const className = "h-4 w-4 shrink-0 text-neon-purple/80";
  switch (type) {
    case "email":
      return <Mail className={className} />;
    case "receipt":
      return <Receipt className={className} />;
    case "document":
      return <File className={className} />;
    case "note":
      return <FileText className={className} />;
    default:
      return <File className={className} />;
  }
}

const ROW_ESTIMATE_PX = 88;

export function FileStream({
  files,
  tasks,
  selectedId,
  onSelect,
  onOpenEditor,
  attachmentCounts = {},
  emptyMessage = "No files here yet.",
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}: FileStreamProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: 10,
  });

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] text-center text-sm text-text-muted">
        {emptyMessage}
      </div>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="files-list-scroll flex-1 min-w-0 overflow-y-auto overflow-x-hidden"
      role="listbox"
      aria-label="Files"
      onScroll={() => {
        if (!onLoadMore || !hasMore || loadingMore) return;
        const items = rowVirtualizer.getVirtualItems();
        const lastIndex = items[items.length - 1]?.index ?? -1;
        if (lastIndex >= files.length - 12) {
          onLoadMore();
        }
      }}
    >
      <div
        className="files-list-virtual relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {virtualItems.map((virtualRow) => {
          const file = files[virtualRow.index];
          if (!file) return null;

          const isSelected = file.id === selectedId;
          const attachCount = attachmentCounts[file.id] ?? 0;
          const displayTags = (file.tags ?? []).filter((t) => t !== "from-email").slice(0, 3);
          const linkedTaskStats = getNoteLinkedTaskStats(file, tasks);
          const dateLabel = safeFormatTimestampIso(
            file.filedAt ?? file.updatedAt,
            "MMM d, yyyy",
            "",
          );

          return (
            <div
              key={file.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(file.id)}
                onMouseEnter={() => {
                  if (attachCount > 0) prefetchNoteAttachments(file.id);
                }}
                onFocus={() => {
                  if (attachCount > 0) prefetchNoteAttachments(file.id);
                }}
                onDoubleClick={() => onOpenEditor?.(file.id)}
                className={cn(
                  "files-list-item w-full max-w-full text-left px-3 md:px-4 py-4 transition relative box-border overflow-hidden",
                  isSelected && "files-list-item--selected",
                  !isSelected && "hover:bg-surface-hover",
                  linkedTaskStats.hasOverdue && "files-list-item--overdue-tasks",
                  linkedTaskStats.hasOpen &&
                    !linkedTaskStats.hasOverdue &&
                    "files-list-item--open-tasks",
                )}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <RecordIcon type={file.recordType} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="font-medium text-sm truncate text-text-primary flex-1 min-w-0">
                        {file.title || "Untitled"}
                      </div>
                      {linkedTaskStats.hasOpen && (
                        <NoteLinkedTaskBadge stats={linkedTaskStats} compact className="shrink-0" />
                      )}
                    </div>
                    {file.memo && (
                      <div className="text-xs text-text-muted line-clamp-1 mt-0.5">{file.memo}</div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {displayTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-hover text-text-secondary border border-border-glass"
                        >
                          {tag}
                        </span>
                      ))}
                      {dateLabel && (
                        <span className="text-[10px] text-text-faint font-mono">{dateLabel}</span>
                      )}
                      {attachCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted">
                          <Paperclip className="h-3 w-3" />
                          {attachCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
      {loadingMore && (
        <div className="py-3 text-center text-xs text-text-muted">Loading more files…</div>
      )}
    </div>
  );
}