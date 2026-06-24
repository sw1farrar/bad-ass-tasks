"use client";

import React, { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Notebook as NotebookIcon, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notebook } from "@/types";

interface NotebookStreamProps {
  notebooks: Notebook[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  emptyMessage?: string;
  /** Enter rename mode with name selected (new notebook flow). */
  focusRenameId?: string | null;
  onFocusRenameConsumed?: () => void;
}

const ROW_ESTIMATE_PX = 64;

export function NotebookStream({
  notebooks,
  selectedId,
  onSelect,
  onRename,
  onDelete,
  emptyMessage = "No notebooks yet. Add one to get started.",
  focusRenameId,
  onFocusRenameConsumed,
}: NotebookStreamProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    if (!focusRenameId || editingId != null) return;
    const nb = notebooks.find((n) => n.id === focusRenameId);
    if (!nb) return;
    setEditingId(nb.id);
    setEditingName(nb.name);
  }, [focusRenameId, notebooks, editingId]);

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

  const startRename = (nb: Notebook) => {
    setEditingId(nb.id);
    setEditingName(nb.name);
  };

  const commitRename = (id: string) => {
    const name = editingName.trim();
    if (name) onRename(id, name);
    setEditingId(null);
    setEditingName("");
  };

  return (
    <div
      ref={parentRef}
      className="files-list-scroll flex-1 min-w-0 overflow-y-auto overflow-x-hidden"
      role="listbox"
      aria-label="Notebooks"
    >
      <div
        className="files-list-virtual relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const nb = notebooks[virtualRow.index];
          if (!nb) return null;
          const isSelected = nb.id === selectedId;
          const isEditing = editingId === nb.id;

          return (
            <div
              key={nb.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <div
                role="option"
                aria-selected={isSelected}
                className={cn(
                  "files-list-item w-full max-w-full text-left px-3 md:px-4 py-3 transition relative box-border overflow-hidden group",
                  isSelected && "files-list-item--selected",
                  !isSelected && "hover:bg-surface-hover",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <NotebookIcon className="h-4 w-4 shrink-0 text-neon-purple/80" />
                  {isEditing ? (
                    <input
                      ref={editingId === nb.id ? renameInputRef : undefined}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => commitRename(nb.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(nb.id);
                        if (e.key === "Escape") {
                          setEditingId(null);
                          setEditingName("");
                        }
                      }}
                      className="flex-1 min-w-0 bg-bg-secondary border border-neon-purple/30 rounded-lg px-2 py-1 text-sm focus:outline-none"
                      aria-label="Rename notebook"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelect(nb.id)}
                      onDoubleClick={() => startRename(nb)}
                      className="flex-1 min-w-0 text-left font-medium text-sm truncate text-text-primary"
                    >
                      {nb.name}
                    </button>
                  )}
                  {!isEditing && (
                    <div className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(nb);
                        }}
                        className="p-1.5 rounded-lg text-text-muted hover:text-neon-purple hover:bg-surface-hover"
                        aria-label={`Rename ${nb.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
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
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}