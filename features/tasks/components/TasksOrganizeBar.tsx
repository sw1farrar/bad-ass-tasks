"use client";

import React, { useState } from "react";
import { Download, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskFolder } from "@/types";
import type { TasksFolderFilterMode, TasksStarredFilterMode } from "@/store/useTaskStore";
import { TasksExportModal } from "./TasksExportModal";
import { TasksFolderFilterPicker } from "./TasksFolderFilterPicker";
import { TasksStatusFilter, type TasksStatusFilterMode } from "./TasksStatusFilter";
import {
  TasksRecurrenceFilter,
  type TasksRecurrenceFilterMode,
} from "./TasksRecurrenceFilter";

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
  recurrenceFilter?: TasksRecurrenceFilterMode;
  onRecurrenceFilterChange?: (mode: TasksRecurrenceFilterMode) => void;
  showRecurrenceFilter?: boolean;
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
  recurrenceFilter,
  onRecurrenceFilterChange,
  showRecurrenceFilter = false,
}: TasksOrganizeBarProps) {
  const [exportOpen, setExportOpen] = useState(false);

  const chipClass = (active: boolean) =>
    cn(
      "tasks-folder-chip inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 py-0 text-[11px] font-semibold leading-none whitespace-nowrap transition",
      active
        ? "is-active border-neon-purple/50 bg-neon-purple/15 text-neon-purple"
        : "border-border-glass bg-surface-hover text-text-secondary hover:text-text-primary hover:border-neon-purple/30",
    );

  return (
    <>
      <div className={cn("tasks-organize-bar w-full", className)}>
        <div className="tasks-organize-bar__track flex w-full items-center gap-1.5">
          <div className="tasks-organize-bar__chips flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-visible pb-0.5 md:flex-nowrap md:overflow-visible md:pb-0">
            {showStatusFilter && statusFilter && onStatusFilterChange ? (
              <TasksStatusFilter
                value={statusFilter}
                onChange={onStatusFilterChange}
                className="tasks-organize-bar__status shrink-0"
                trackClassName="tasks-organize-bar__status-track"
              />
            ) : null}
            {showRecurrenceFilter && recurrenceFilter && onRecurrenceFilterChange ? (
              <TasksRecurrenceFilter
                value={recurrenceFilter}
                onChange={onRecurrenceFilterChange}
                className="tasks-organize-bar__recurrence shrink-0"
              />
            ) : null}
            <button
              type="button"
              onClick={() =>
                onStarredFilterChange(starredFilter === "only" ? "all" : "only")
              }
              aria-pressed={starredFilter === "only"}
              className={cn(
                chipClass(starredFilter === "only"),
                starredFilter === "only" &&
                  "text-amber-300 border-amber-400/40 bg-amber-400/10",
              )}
            >
              <Star
                className={cn(
                  "h-3 w-3",
                  starredFilter === "only" && "fill-current text-amber-400",
                )}
                strokeWidth={starredFilter === "only" ? 0 : 2}
              />
              Important
            </button>

            <TasksFolderFilterPicker
              folders={folders}
              value={folderFilter}
              onChange={onFolderFilterChange}
              onAddFolder={onAddFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              className="tasks-organize-bar__folder-filter"
            />
          </div>

          <div className="tasks-organize-bar__actions flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              aria-label="Export"
              title="Export"
              className="tasks-export-btn inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-glass text-text-secondary transition hover:border-neon-purple/40 hover:text-neon-purple hover:bg-neon-purple/8"
            >
              <Download className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <TasksExportModal open={exportOpen} onOpenChange={setExportOpen} />
    </>
  );
}
