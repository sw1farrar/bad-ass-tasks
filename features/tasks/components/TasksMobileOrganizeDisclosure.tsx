"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskFolder } from "@/types";
import type { TasksFolderFilterMode, TasksStarredFilterMode } from "@/store/useTaskStore";
import { TasksOrganizeBar } from "./TasksOrganizeBar";

interface TasksMobileOrganizeDisclosureProps {
  folders: TaskFolder[];
  starredFilter: TasksStarredFilterMode;
  folderFilter: TasksFolderFilterMode;
  onStarredFilterChange: (mode: TasksStarredFilterMode) => void;
  onFolderFilterChange: (mode: TasksFolderFilterMode) => void;
  onAddFolder: (name: string) => Promise<unknown>;
  onRenameFolder: (id: string, name: string) => Promise<unknown>;
  onDeleteFolder: (id: string) => Promise<unknown>;
}

export function TasksMobileOrganizeDisclosure({
  folders,
  starredFilter,
  folderFilter,
  onStarredFilterChange,
  onFolderFilterChange,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
}: TasksMobileOrganizeDisclosureProps) {
  const [open, setOpen] = useState(false);
  const activeCount = useMemo(() => {
    let n = 0;
    if (starredFilter === "only") n += 1;
    if (folderFilter !== "all") n += 1;
    return n;
  }, [starredFilter, folderFilter]);

  return (
    <div className="tasks-mobile-organize">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "inline-flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium min-h-[44px] transition",
          activeCount > 0 || open
            ? "border-neon-purple/40 bg-neon-purple/10 text-neon-purple"
            : "border-border-glass bg-surface-hover text-text-secondary",
        )}
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filters
          {activeCount > 0 ? (
            <span className="rounded-full bg-neon-purple/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {activeCount}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="mt-2">
          <TasksOrganizeBar
            folders={folders}
            starredFilter={starredFilter}
            folderFilter={folderFilter}
            onStarredFilterChange={onStarredFilterChange}
            onFolderFilterChange={onFolderFilterChange}
            onAddFolder={onAddFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
          />
        </div>
      ) : null}
    </div>
  );
}
