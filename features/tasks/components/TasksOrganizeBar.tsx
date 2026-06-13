"use client";

import React, { useState } from "react";
import { FolderPlus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskFolder } from "@/types";
import type { TasksFolderFilterMode, TasksStarredFilterMode } from "@/store/useTaskStore";
import { TaskFoldersManageModal } from "./TaskFoldersManageModal";
import { TasksStatusFilter, type TasksStatusFilterMode } from "./TasksStatusFilter";

interface TasksOrganizeBarProps {
  folders: TaskFolder[];
  starredFilter: TasksStarredFilterMode;
  folderFilter: TasksFolderFilterMode;
  onStarredFilterChange: (mode: TasksStarredFilterMode) => void;
  onFolderFilterChange: (mode: TasksFolderFilterMode) => void;
  onAddFolder: (name: string) => Promise<unknown>;
  onRenameFolder: (id: string, name: string) => Promise<unknown>;
  onDeleteFolder: (id: string) => Promise<unknown>;
  className?: string;
  statusFilter?: TasksStatusFilterMode;
  onStatusFilterChange?: (mode: TasksStatusFilterMode) => void;
  showStatusFilter?: boolean;
}

export function TasksOrganizeBar({
  folders,
  starredFilter,
  folderFilter,
  onStarredFilterChange,
  onFolderFilterChange,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  className,
  statusFilter,
  onStatusFilterChange,
  showStatusFilter = false,
}: TasksOrganizeBarProps) {
  const [manageOpen, setManageOpen] = useState(false);

  const folderChipClass = (active: boolean) =>
    cn(
      "tasks-folder-chip inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition",
      active
        ? "is-active border-neon-purple/50 bg-neon-purple/15 text-neon-purple"
        : "border-border-glass bg-surface-hover text-text-secondary hover:text-text-primary hover:border-neon-purple/30",
    );

  return (
    <>
      <div className={cn("tasks-organize-bar w-full", className)}>
        <div className="tasks-organize-bar__track flex w-full items-center gap-2">
          <div className="tasks-organize-bar__chips flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 md:flex-wrap md:overflow-visible md:pb-0">
          {showStatusFilter && statusFilter && onStatusFilterChange ? (
            <TasksStatusFilter
              value={statusFilter}
              onChange={onStatusFilterChange}
              className="tasks-organize-bar__status shrink-0"
              trackClassName="tasks-organize-bar__status-track"
            />
          ) : null}
          <button
            type="button"
            onClick={() =>
              onStarredFilterChange(starredFilter === "only" ? "all" : "only")
            }
            aria-pressed={starredFilter === "only"}
            className={cn(
              folderChipClass(starredFilter === "only"),
              starredFilter === "only" && "text-amber-300 border-amber-400/40 bg-amber-400/10",
            )}
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                starredFilter === "only" && "fill-current text-amber-400",
              )}
              strokeWidth={starredFilter === "only" ? 0 : 2}
            />
            Important
          </button>

          <button
            type="button"
            onClick={() => onFolderFilterChange("all")}
            aria-pressed={folderFilter === "all"}
            className={folderChipClass(folderFilter === "all")}
          >
            All folders
          </button>

          <button
            type="button"
            onClick={() => onFolderFilterChange("none")}
            aria-pressed={folderFilter === "none"}
            className={folderChipClass(folderFilter === "none")}
          >
            Unfiled
          </button>

          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => onFolderFilterChange(folder.id)}
              aria-pressed={folderFilter === folder.id}
              className={folderChipClass(folderFilter === folder.id)}
            >
              {folder.name}
            </button>
          ))}
          </div>

          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="tasks-folder-manage-btn inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-border-glass px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:border-neon-purple/40 hover:text-neon-purple hover:bg-neon-purple/8"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Manage
          </button>
        </div>
      </div>

      <TaskFoldersManageModal
        open={manageOpen}
        onOpenChange={setManageOpen}
        folders={folders}
        onAddFolder={onAddFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
      />
    </>
  );
}