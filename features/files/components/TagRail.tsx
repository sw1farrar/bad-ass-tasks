"use client";

import React from "react";
import { Archive, Inbox, Loader2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { TagMultiSelect } from "./TagMultiSelect";

export type FilesBrowseFilter =
  | { kind: "review" }
  | { kind: "all" }
  | { kind: "untagged" }
  | { kind: "tags"; tags: string[] };

interface TagRailProps {
  filter: FilesBrowseFilter;
  onFilterChange: (filter: FilesBrowseFilter) => void;
  onTagFilterChange: (tags: string[]) => void;
  tags: string[];
  reviewCount: number;
  onNewFile: () => void;
  isCreating?: boolean;
  /** Desktop: integrated browse panel with search + file list */
  isDesktop?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  searching?: boolean;
  listContent?: React.ReactNode;
}

function modeButtonClass(active: boolean) {
  return cn(
    "files-mode-button flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition min-h-[44px]",
    active
      ? "files-mode-button--active bg-neon-purple/15 text-neon-purple-tint border border-neon-purple/30"
      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary border border-border-glass bg-bg-secondary",
  );
}

export function TagRail({
  filter,
  onFilterChange,
  onTagFilterChange,
  tags,
  reviewCount,
  onNewFile,
  isCreating,
  isDesktop = false,
  searchQuery = "",
  onSearchQueryChange,
  searching = false,
  listContent,
}: TagRailProps) {
  const selectedTags = filter.kind === "tags" ? filter.tags : [];
  const tagFilterDisabled = filter.kind === "review";

  if (isDesktop) {
    return (
      <aside
        className="files-browse-panel w-80 xl:w-[22rem] shrink-0 border-r border-border-glass bg-bg flex flex-col min-h-0 gap-3"
        aria-label="Files browse"
      >
        <div className="files-browse-toolbar files-action-bar shrink-0 p-4 border-b border-border-glass space-y-3">
          <button
            type="button"
            onClick={onNewFile}
            disabled={isCreating}
            className="w-full btn btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add File
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              className={modeButtonClass(filter.kind === "review")}
              onClick={() => onFilterChange({ kind: "review" })}
            >
              <Inbox className="h-4 w-4 shrink-0" />
              <span>Review</span>
              {reviewCount > 0 && (
                <span className="nav-count-badge">
                  {reviewCount > 99 ? "99+" : reviewCount}
                </span>
              )}
            </button>

            <button
              type="button"
              className={modeButtonClass(filter.kind === "all" || filter.kind === "tags")}
              onClick={() => onFilterChange({ kind: "all" })}
            >
              <Archive className="h-4 w-4 shrink-0" />
              Archive
            </button>
          </div>

          <TagMultiSelect
            tags={tags}
            selected={selectedTags}
            onChange={onTagFilterChange}
            disabled={tagFilterDisabled}
          />

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange?.(e.target.value)}
              placeholder="Search files…"
              className="w-full bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint"
              aria-label="Search files"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neon-purple" />
            )}
          </div>
        </div>

        <div className="files-browse-list-shell flex-1 min-h-0 flex flex-col">{listContent}</div>
      </aside>
    );
  }

  const itemClass = (active: boolean) =>
    cn(
      "files-mode-button w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition text-left",
      active
        ? "files-mode-button--active bg-neon-purple/15 text-neon-purple-tint border border-neon-purple/30"
        : "text-text-secondary hover:bg-surface-hover hover:text-text-primary border border-transparent",
    );

  return (
    <aside className="files-tag-rail w-52 sm:w-56 shrink-0 border-r border-border-glass bg-bg flex flex-col min-h-0">
      <div className="files-tag-rail__new-file p-3 border-b border-border-glass">
        <button
          type="button"
          onClick={onNewFile}
          disabled={isCreating}
          className="w-full btn btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Capture file
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1" aria-label="File drawers">
        <button
          type="button"
          className={itemClass(filter.kind === "review")}
          onClick={() => onFilterChange({ kind: "review" })}
        >
          <Inbox className="h-4 w-4 shrink-0" />
          <span className="flex-1">Review</span>
          {reviewCount > 0 && (
            <span className="nav-count-badge">
              {reviewCount > 99 ? "99+" : reviewCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className={itemClass(filter.kind === "all" || filter.kind === "tags")}
          onClick={() => onFilterChange({ kind: "all" })}
        >
          <Archive className="h-4 w-4 shrink-0" />
          Archive
        </button>
      </nav>
    </aside>
  );
}