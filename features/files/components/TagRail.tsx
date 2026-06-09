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
    "flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition min-h-[44px]",
    active
      ? "bg-[#c084fc]/15 text-[#e9d5ff] border border-[#c084fc]/30"
      : "text-[#a1a1aa] hover:bg-white/5 hover:text-white border border-white/10 bg-[#111114]",
  );
}

export function TagRail({
  filter,
  onFilterChange,
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

  const handleTagsChange = (nextTags: string[]) => {
    if (nextTags.length === 0) {
      onFilterChange({ kind: "all" });
      return;
    }
    onFilterChange({ kind: "tags", tags: nextTags });
  };

  if (isDesktop) {
    return (
      <aside
        className="files-browse-panel w-80 xl:w-[22rem] shrink-0 border-r border-white/10 bg-[#0a0a0f] flex flex-col min-h-0"
        aria-label="Files browse"
      >
        <div className="shrink-0 p-4 border-b border-white/10 space-y-3">
          <button
            type="button"
            onClick={onNewFile}
            disabled={isCreating}
            className="w-full btn btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Capture file
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
                <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[#ff3366] text-[10px] font-bold text-white flex items-center justify-center">
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
            onChange={handleTagsChange}
            disabled={filter.kind === "review"}
          />

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#52525b]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange?.(e.target.value)}
              placeholder="Search files…"
              className="w-full bg-[#111114] border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:border-[#c084fc]/40 placeholder:text-[#52525b]"
              aria-label="Search files"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#c084fc]" />
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">{listContent}</div>
      </aside>
    );
  }

  const itemClass = (active: boolean) =>
    cn(
      "w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition text-left",
      active
        ? "bg-[#c084fc]/15 text-[#e9d5ff] border border-[#c084fc]/30"
        : "text-[#a1a1aa] hover:bg-white/5 hover:text-white border border-transparent",
    );

  return (
    <aside className="files-tag-rail w-52 sm:w-56 shrink-0 border-r border-white/10 bg-[#0a0a0f] flex flex-col min-h-0">
      <div className="files-tag-rail__new-file p-3 border-b border-white/10">
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
            <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[#ff3366] text-[10px] font-bold text-white flex items-center justify-center">
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