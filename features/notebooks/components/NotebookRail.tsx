"use client";

import React from "react";
import { Loader2, Plus, Search } from "lucide-react";

interface NotebookRailProps {
  onNewNotebook: () => void;
  isCreating?: boolean;
  isDesktop?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  listContent?: React.ReactNode;
}

export function NotebookRail({
  onNewNotebook,
  isCreating,
  isDesktop = false,
  searchQuery = "",
  onSearchQueryChange,
  listContent,
}: NotebookRailProps) {
  if (!isDesktop) return null;

  return (
    <aside
      className="files-browse-panel w-80 xl:w-[22rem] shrink-0 border-r border-border-glass bg-bg flex flex-col min-h-0 gap-3"
      aria-label="Notebooks browse"
    >
      <div className="files-browse-toolbar files-action-bar shrink-0 p-4 border-b border-border-glass space-y-3">
        <button
          type="button"
          onClick={onNewNotebook}
          disabled={isCreating}
          className="w-full btn btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Notebook
        </button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            placeholder="Search notebooks…"
            className="w-full bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint"
            aria-label="Search notebooks"
          />
        </div>
      </div>

      <div className="files-browse-list-shell flex-1 min-h-0 flex flex-col">{listContent}</div>
    </aside>
  );
}