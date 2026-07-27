"use client";

import React, { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskFolder } from "@/types";
import type { TasksFolderFilterMode, TasksStarredFilterMode } from "@/store/useTaskStore";
import {
  folderFilterSummary,
  isFolderFilterActive,
  normalizeFolderFilter,
} from "@/features/tasks/lib/folderFilter";
import { TasksOrganizeBar } from "./TasksOrganizeBar";
import { TasksStatusFilter, type TasksStatusFilterMode } from "./TasksStatusFilter";
import {
  TasksRecurrenceFilter,
  type TasksRecurrenceFilterMode,
} from "./TasksRecurrenceFilter";

interface TasksMobileOrganizeDisclosureProps {
  folders: TaskFolder[];
  starredFilter: TasksStarredFilterMode;
  folderFilter: TasksFolderFilterMode;
  onStarredFilterChange: (mode: TasksStarredFilterMode) => void;
  onFolderFilterChange: (mode: TasksFolderFilterMode) => void;
  onAddFolder: (name: string) => Promise<unknown>;
  onRenameFolder: (id: string, name: string) => Promise<unknown>;
  onDeleteFolder: (id: string) => Promise<unknown>;
  statusFilter: TasksStatusFilterMode;
  onStatusFilterChange: (mode: TasksStatusFilterMode) => void;
  recurrenceFilter: TasksRecurrenceFilterMode;
  onRecurrenceFilterChange: (mode: TasksRecurrenceFilterMode) => void;
}

function statusShortLabel(mode: TasksStatusFilterMode): string {
  if (mode === "all") return "All";
  if (mode === "completed") return "Done";
  return "Open";
}

function recurrenceShortLabel(mode: TasksRecurrenceFilterMode): string | null {
  if (mode === "only") return "Repeating";
  if (mode === "none") return "One-time";
  return null;
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
  statusFilter,
  onStatusFilterChange,
  recurrenceFilter,
  onRecurrenceFilterChange,
}: TasksMobileOrganizeDisclosureProps) {
  const [open, setOpen] = useState(false);

  const activeCount = useMemo(() => {
    let n = 0;
    if (statusFilter !== "incomplete") n += 1;
    if (recurrenceFilter !== "all") n += 1;
    if (starredFilter === "only") n += 1;
    if (isFolderFilterActive(folderFilter)) n += 1;
    return n;
  }, [statusFilter, recurrenceFilter, starredFilter, folderFilter]);

  const summary = useMemo(() => {
    const parts = [statusShortLabel(statusFilter)];
    const recurrence = recurrenceShortLabel(recurrenceFilter);
    if (recurrence) parts.push(recurrence);
    if (starredFilter === "only") parts.push("Important");
    if (isFolderFilterActive(folderFilter)) {
      parts.push(folderFilterSummary(normalizeFolderFilter(folderFilter), folders));
    }
    return parts.join(" · ");
  }, [statusFilter, recurrenceFilter, starredFilter, folderFilter, folders]);

  return (
    // `contents` lets the trigger + panel participate in the parent toolbar grid.
    <div className="tasks-mobile-organize contents">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Hide filters" : `Filters: ${summary}`}
        className={cn(
          "tasks-mobile-organize__trigger col-start-2 row-start-1 inline-flex shrink-0 items-center justify-center gap-1 rounded-xl border px-2.5 min-h-[40px] min-w-[40px] text-xs font-semibold transition",
          activeCount > 0 || open
            ? "border-neon-purple/40 bg-neon-purple/10 text-neon-purple"
            : "border-border-glass bg-surface-hover text-text-secondary",
        )}
      >
        {open ? (
          <X className="h-4 w-4" aria-hidden />
        ) : (
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
        )}
        {activeCount > 0 ? (
          <span className="tabular-nums leading-none">{activeCount}</span>
        ) : (
          <span className="sr-only">Filters</span>
        )}
      </button>

      {open ? (
        <div className="tasks-mobile-organize__panel col-span-2 rounded-2xl border border-border-glass bg-surface-hover/40 p-2 space-y-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Filters
            </p>
            <p className="min-w-0 truncate text-[11px] text-text-secondary">{summary}</p>
          </div>

          <TasksStatusFilter
            value={statusFilter}
            onChange={onStatusFilterChange}
            compact
            className="tasks-mobile-organize__status"
            trackClassName="tasks-mobile-organize__segment-track"
          />
          <TasksRecurrenceFilter
            value={recurrenceFilter}
            onChange={onRecurrenceFilterChange}
            compact
            className="tasks-mobile-organize__recurrence"
            trackClassName="tasks-mobile-organize__segment-track"
          />

          <TasksOrganizeBar
            folders={folders}
            starredFilter={starredFilter}
            folderFilter={folderFilter}
            onStarredFilterChange={onStarredFilterChange}
            onFolderFilterChange={onFolderFilterChange}
            onAddFolder={onAddFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            className="tasks-mobile-organize__bar"
          />
        </div>
      ) : null}
    </div>
  );
}
