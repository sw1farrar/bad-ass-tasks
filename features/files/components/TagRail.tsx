"use client";

import React from "react";
import { Inbox, FolderOpen, Tag, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilesBrowseFilter =
  | { kind: "review" }
  | { kind: "all" }
  | { kind: "untagged" }
  | { kind: "tag"; tag: string };

interface TagRailProps {
  filter: FilesBrowseFilter;
  onFilterChange: (filter: FilesBrowseFilter) => void;
  tags: string[];
  reviewCount: number;
  onNewFile: () => void;
  isCreating?: boolean;
}

export function TagRail({
  filter,
  onFilterChange,
  tags,
  reviewCount,
  onNewFile,
  isCreating,
}: TagRailProps) {
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
          {isCreating ? "Creating…" : "New file"}
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
          className={itemClass(filter.kind === "all")}
          onClick={() => onFilterChange({ kind: "all" })}
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          All filed
        </button>

        <button
          type="button"
          className={itemClass(filter.kind === "untagged")}
          onClick={() => onFilterChange({ kind: "untagged" })}
        >
          <Tag className="h-4 w-4 shrink-0 opacity-60" />
          Untagged
        </button>

        {tags.length > 0 && (
          <div className="files-tag-rail__tags-label pt-2 pb-1 px-2 text-[10px] uppercase tracking-widest text-[#52525b] font-semibold">
            Tags
          </div>
        )}

        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className={itemClass(filter.kind === "tag" && filter.tag === tag)}
            onClick={() => onFilterChange({ kind: "tag", tag })}
          >
            <Tag className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate">{tag}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}