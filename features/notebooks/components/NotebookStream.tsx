"use client";

import React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Archive, ArchiveRestore, Notebook as NotebookIcon, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notebook } from "@/types";

interface NotebookStreamProps {
  notebooks: Notebook[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  isArchivedView?: boolean;
  emptyMessage?: string;
}

const ROW_ESTIMATE_PX = 64;

export function NotebookStream({
  notebooks,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive,
  isArchivedView = false,
  emptyMessage = "No notebooks yet. Add one to get started.",
}: NotebookStreamProps) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: notebooks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: 8,
  });

  if (notebooks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] text-center text-sm text-text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="files-list-scroll flex-1 min-w-0 overflow-y-auto overflow-x-hidden"
      role="listbox"
      aria-label={isArchivedView ? "Archived notebooks" : "Notebooks"}
    >
      <div
        className="files-list-virtual relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const nb = notebooks[virtualRow.index];
          if (!nb) return null;
          const isSelected = nb.id === selectedId;

          return (
            <div
              key={nb.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <div
                className={cn(
                  "files-list-item w-full max-w-full text-left px-3 md:px-4 py-3 transition relative box-border overflow-hidden group",
                  isSelected && "files-list-item--selected",
                  !isSelected && "hover:bg-surface-hover",
                  "cursor-pointer",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => onSelect(nb.id)}
                    onDoubleClick={() => onEdit(nb.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left -mx-3 md:-mx-4 -my-3 px-3 md:px-4 py-3 cursor-pointer"
                  >
                    <NotebookIcon className="h-4 w-4 shrink-0 text-neon-purple/80 pointer-events-none" />
                    <span className="flex-1 min-w-0 font-medium text-sm truncate text-text-primary">
                      {nb.name}
                    </span>
                  </button>
                  <div className="relative z-10 flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                    {!isArchivedView && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(nb.id);
                        }}
                        className="p-1.5 rounded-lg text-text-muted hover:text-neon-purple hover:bg-surface-hover"
                        aria-label={`Edit ${nb.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isArchivedView ? (
                      onUnarchive && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUnarchive(nb.id);
                          }}
                          className="p-1.5 rounded-lg text-text-muted hover:text-neon-purple hover:bg-surface-hover"
                          aria-label={`Restore ${nb.name}`}
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        </button>
                      )
                    ) : (
                      onArchive && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onArchive(nb.id);
                          }}
                          className="p-1.5 rounded-lg text-text-muted hover:text-neon-purple hover:bg-surface-hover"
                          aria-label={`Archive ${nb.name}`}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(nb.id);
                      }}
                      className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover"
                      aria-label={`Delete ${nb.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
