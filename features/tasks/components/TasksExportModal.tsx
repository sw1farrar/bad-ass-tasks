"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Star, X } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { cn } from "@/lib/utils";
import { isSharedWorkspace } from "@/lib/assignee";
import { useTaskStore } from "@/store/useTaskStore";
import { TasksStatusFilter } from "./TasksStatusFilter";
import { TasksRecurrenceFilter } from "./TasksRecurrenceFilter";
import {
  buildTasksExportRows,
  createDefaultTasksExportFilters,
  downloadTasksExcel,
  filterTasksForExport,
  type TasksExportFilters,
} from "@/features/tasks/lib/exportTasksExcel";

interface TasksExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ExportBody({
  filters,
  onChange,
  matchCount,
  isExporting,
  onClose,
  onExport,
}: {
  filters: TasksExportFilters;
  onChange: (next: Partial<TasksExportFilters>) => void;
  matchCount: number;
  isExporting: boolean;
  onClose: () => void;
  onExport: () => void;
}) {
  const workspaceId = useTaskStore((s) => s.currentWorkspace.id);
  const taskFolders = useTaskStore((s) => s.taskFolders);
  const folders = useMemo(
    () =>
      [...taskFolders]
        .filter((f) => f.workspaceId === workspaceId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [taskFolders, workspaceId],
  );

  const folderChipClass = (active: boolean) =>
    cn(
      "tasks-folder-chip inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition",
      active
        ? "is-active border-neon-purple/50 bg-neon-purple/15 text-neon-purple"
        : "border-border-glass bg-surface-hover text-text-secondary hover:text-text-primary hover:border-neon-purple/30",
    );

  return (
    <div className="tasks-export-modal__body flex flex-col">
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-border-glass">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Export tasks</h2>
          <p className="text-sm text-text-muted mt-1">
            Choose what to include, then download an Excel file.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover transition"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="tasks-export-modal__filters px-5 py-4 space-y-5 max-h-[min(28rem,60vh)] overflow-y-auto">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Search
          </span>
          <input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Filter by title or notes…"
            className="input w-full px-3 py-2.5 text-sm"
          />
        </label>

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Status
          </span>
          <TasksStatusFilter
            value={filters.statusMode}
            onChange={(statusMode) => onChange({ statusMode })}
            className="tasks-export-modal__segment"
          />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Type
          </span>
          <TasksRecurrenceFilter
            value={filters.recurrenceMode}
            onChange={(recurrenceMode) => onChange({ recurrenceMode })}
            className="tasks-export-modal__segment"
          />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Organize
          </span>
          <div className="tasks-export-modal__organize flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                onChange({ starred: filters.starred === "only" ? "all" : "only" })
              }
              aria-pressed={filters.starred === "only"}
              className={cn(
                folderChipClass(filters.starred === "only"),
                filters.starred === "only" &&
                  "text-amber-300 border-amber-400/40 bg-amber-400/10",
              )}
            >
              <Star
                className={cn(
                  "h-3.5 w-3.5",
                  filters.starred === "only" && "fill-current text-amber-400",
                )}
                strokeWidth={filters.starred === "only" ? 0 : 2}
              />
              Important
            </button>
            <button
              type="button"
              onClick={() => onChange({ folderFilter: "all" })}
              aria-pressed={filters.folderFilter === "all"}
              className={folderChipClass(filters.folderFilter === "all")}
            >
              All folders
            </button>
            <button
              type="button"
              onClick={() => onChange({ folderFilter: "none" })}
              aria-pressed={filters.folderFilter === "none"}
              className={folderChipClass(filters.folderFilter === "none")}
            >
              Unfiled
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => onChange({ folderFilter: folder.id })}
                aria-pressed={filters.folderFilter === folder.id}
                className={folderChipClass(filters.folderFilter === folder.id)}
              >
                {folder.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border-glass">
        <p className="text-sm text-text-muted tabular-nums">
          {matchCount} task{matchCount === 1 ? "" : "s"} matched
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn px-3 py-2 rounded-xl text-sm border border-border-glass"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={isExporting || matchCount === 0}
            className="btn btn-primary inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {isExporting ? "Exporting…" : "Export Excel"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TasksExportModal({ open, onOpenChange }: TasksExportModalProps) {
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState<TasksExportFilters>(createDefaultTasksExportFilters());
  const [isExporting, setIsExporting] = useState(false);
  const isMobile = useIsMobileViewport();

  const tasks = useTaskStore((s) => s.tasks);
  const statusMode = useTaskStore((s) => s.taskFilter.statusMode);
  const recurrenceMode = useTaskStore((s) => s.taskFilter.recurrenceMode);
  const starred = useTaskStore((s) => s.taskFilter.starred);
  const folderFilter = useTaskStore((s) => s.taskFilter.folderFilter);
  const search = useTaskStore((s) => s.taskFilter.search);
  const currentWorkspace = useTaskStore((s) => s.currentWorkspace);
  const taskFolders = useTaskStore((s) => s.taskFolders);
  const taskCommentSummaries = useTaskStore((s) => s.taskCommentSummaries);
  const members = useTaskStore((s) => s.members);

  const exportFolders = useMemo(
    () =>
      [...taskFolders]
        .filter((f) => f.workspaceId === currentWorkspace.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [taskFolders, currentWorkspace.id],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setFilters(
      createDefaultTasksExportFilters({
        statusMode: (statusMode as TasksExportFilters["statusMode"]) ?? "incomplete",
        recurrenceMode: (recurrenceMode as TasksExportFilters["recurrenceMode"]) ?? "all",
        starred: starred ?? "all",
        folderFilter: folderFilter ?? "all",
        search: search ?? "",
      }),
    );
  }, [open, statusMode, recurrenceMode, starred, folderFilter, search]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useScrollLock(open && !isMobile);

  useEffect(() => {
    if (!open || isMobile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, isMobile]);

  const workspaceTasks = useMemo(
    () => tasks.filter((t) => t.workspaceId === currentWorkspace.id),
    [tasks, currentWorkspace.id],
  );

  const matchedTasks = useMemo(
    () => filterTasksForExport(workspaceTasks, filters),
    [workspaceTasks, filters],
  );

  const handleExport = () => {
    if (isExporting || matchedTasks.length === 0) return;
    setIsExporting(true);
    try {
      const includeAssignee = isSharedWorkspace(members);
      const rows = buildTasksExportRows(
        matchedTasks,
        exportFolders,
        taskCommentSummaries,
        { includeAssignee },
      );
      downloadTasksExcel(rows, {
        workspaceName: currentWorkspace.name,
        includeAssignee,
      });
      toast.success(`Exported ${matchedTasks.length} task${matchedTasks.length === 1 ? "" : "s"}`);
      close();
    } catch (err) {
      console.error(err);
      toast.error("Could not export tasks");
    } finally {
      setIsExporting(false);
    }
  };

  if (!open || !mounted) return null;

  const body = (
    <ExportBody
      filters={filters}
      onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
      matchCount={matchedTasks.length}
      isExporting={isExporting}
      onClose={close}
      onExport={handleExport}
    />
  );

  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onClose={close}
        title="Export tasks"
        zIndex={850}
        panelClassName="tasks-export-modal"
        showClose={false}
        showDragHandle
        enableDragDismiss
        dragMode="handle"
        ariaLabel="Export tasks"
      >
        {body}
      </BottomSheet>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[850] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 overlay-scrim backdrop-blur-[3px]"
        onClick={close}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export tasks"
        className={cn(
          "tasks-export-modal relative w-full md:max-w-lg bg-bg-panel border border-border-glass modal-panel shadow-2xl rounded-2xl",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {body}
      </div>
    </div>,
    document.body,
  );
}
