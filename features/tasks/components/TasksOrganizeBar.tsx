"use client";

import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Search, Star, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTaskListCount } from "@/features/tasks/lib/taskListPage";
import type { TaskFolder } from "@/types";
import { useTaskStore, type TasksFolderFilterMode, type TasksStarredFilterMode } from "@/store/useTaskStore";
import { TasksExportModal } from "./TasksExportModal";
import { ImportWizardModal } from "@/features/import";
import { TasksFolderFilterPicker } from "./TasksFolderFilterPicker";
import { TasksStatusFilter, type TasksStatusFilterMode } from "./TasksStatusFilter";
import {
  TasksRecurrenceFilter,
  type TasksRecurrenceFilterMode,
} from "./TasksRecurrenceFilter";

const TOOLTIP_PAD = 8;
const TOOLTIP_GAP = 10;

/** Tooltip sits up and left of the cursor so it is never under the pointer or off-screen. */
function ActionIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const tipEl = tipRef.current;
    const btn = btnRef.current;
    if (!tipEl || !btn) return;
    const tipW = tipEl.offsetWidth;
    const tipH = tipEl.offsetHeight;
    const rect = btn.getBoundingClientRect();
    const cursor = cursorRef.current;
    const originX = cursor?.x ?? rect.left + rect.width / 2;
    const originY = cursor?.y ?? rect.top + rect.height / 2;
    let left = originX - tipW - TOOLTIP_GAP;
    let top = originY - tipH - TOOLTIP_GAP;
    left = Math.max(TOOLTIP_PAD, Math.min(left, window.innerWidth - tipW - TOOLTIP_PAD));
    top = Math.max(TOOLTIP_PAD, Math.min(top, window.innerHeight - tipH - TOOLTIP_PAD));
    setTip((prev) =>
      prev && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.left - left) < 0.5
        ? prev
        : { top, left },
    );
  }, []);

  const showAt = (x: number, y: number) => {
    cursorRef.current = { x, y };
    setTip((prev) => prev ?? { top: y - 28, left: x - 64 });
    requestAnimationFrame(place);
  };

  const hide = () => {
    cursorRef.current = null;
    setTip(null);
  };

  useLayoutEffect(() => {
    if (!tip) return;
    place();
  }, [tip, place]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          hide();
          onClick();
        }}
        aria-label={label}
        onMouseEnter={(e) => showAt(e.clientX, e.clientY)}
        onMouseMove={(e) => showAt(e.clientX, e.clientY)}
        onMouseLeave={hide}
        onFocus={() => {
          const rect = btnRef.current?.getBoundingClientRect();
          if (!rect) return;
          showAt(rect.left, rect.top);
        }}
        onBlur={hide}
        className="tasks-export-btn inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-glass text-text-secondary transition hover:border-neon-purple/40 hover:text-neon-purple hover:bg-neon-purple/8"
      >
        {children}
      </button>
      {tip && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={tipRef}
              role="tooltip"
              className="pointer-events-none fixed z-[4000] whitespace-nowrap rounded-md border border-border-glass bg-bg-tertiary px-2 py-1 text-[11px] font-medium text-text-primary shadow-lg"
              style={{ top: tip.top, left: tip.left }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

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
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  resultCount?: number;
  resultTotal?: number | null;
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
  searchValue = "",
  onSearchChange,
  resultCount,
  resultTotal,
}: TasksOrganizeBarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const canImport = useTaskStore((s) => {
    const role = s.currentWorkspace.role;
    return role === "owner" || role === "admin";
  });

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
          <div
            className={cn(
              "tasks-organize-bar__chips flex min-w-0 items-center gap-1 overflow-x-auto overflow-y-visible pb-0.5 md:flex-nowrap md:pb-0",
              onSearchChange ? "shrink" : "flex-1 md:overflow-visible",
            )}
          >
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

          {onSearchChange ? (
            <div className="tasks-organize-bar__search-group flex min-w-0 flex-1 items-center">
              <div className="tasks-organize-bar__search flex min-w-0 flex-1 items-center">
                <Search
                  className="tasks-organize-bar__search-icon h-3.5 w-3.5 shrink-0"
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search tasks…"
                  className="tasks-organize-bar__search-input"
                  aria-label="Search tasks"
                />
                {resultCount !== undefined ? (
                  <span
                    className="tasks-organize-bar__count shrink-0 tabular-nums"
                    aria-label={formatTaskListCount(resultCount, resultTotal)}
                  >
                    {formatTaskListCount(resultCount, resultTotal)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="tasks-organize-bar__actions flex shrink-0 items-center gap-1">
            {canImport ? (
              <ActionIconButton label="Import" onClick={() => setImportOpen(true)}>
                <Upload className="h-3 w-3" />
              </ActionIconButton>
            ) : null}
            <ActionIconButton label="Export" onClick={() => setExportOpen(true)}>
              <Download className="h-3 w-3" />
            </ActionIconButton>
          </div>
        </div>
      </div>

      <TasksExportModal open={exportOpen} onOpenChange={setExportOpen} />
      <ImportWizardModal open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
