"use client";

import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { Notebook } from "@/types";

interface NotebookDetailHeaderProps {
  notebook: Notebook;
  onEdit: () => void;
  onDelete: () => void;
}

export function NotebookDetailHeader({
  notebook,
  onEdit,
  onDelete,
}: NotebookDetailHeaderProps) {
  return (
    <div className="notebooks-detail-header flex items-center gap-2 px-4 py-2.5 border-b border-border-glass bg-bg shrink-0 min-w-0">
      <div className="flex flex-1 min-w-0 items-center gap-2 px-2 py-1.5 -ml-2">
        <span className="flex-1 min-w-0 text-sm font-semibold truncate text-text-primary">
          {notebook.name}
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-lg text-text-muted hover:text-neon-purple hover:bg-surface-hover shrink-0"
          aria-label={`Edit ${notebook.name}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover shrink-0"
        aria-label={`Delete ${notebook.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
