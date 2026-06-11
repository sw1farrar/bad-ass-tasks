"use client";

import React, { useState } from "react";
import { Check, Loader2, Repeat } from "lucide-react";
import { cn, formatDueDate, getRecurringLabel, triggerHaptic } from "@/lib/utils";
import type { Task } from "@/types";
import { TaskRow } from "./TaskRow";
import { TaskCommentIndicator } from "./TaskCommentIndicator";
import { getTaskCommentIndicatorState } from "@/features/tasks/lib/taskCommentIndicators";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useTaskStore } from "@/store/useTaskStore";

export interface TasksTableProps {
  tasks: Task[];
  taskLoadingStates?: Record<string, boolean>;
  onOpenTask: (task: Task) => void;
  onComplete: (id: string) => void;
  onAddTask?: (title: string) => Promise<unknown>;
  onSwipeComplete?: (id: string) => void;
  showAssignee?: boolean;
  showQuickAdd?: boolean;
  emptyMessage?: string;
  getWorkspaceName?: (task: Task) => string | undefined;
  rowIdPrefix?: string;
  className?: string;
}

export function TasksTable({
  tasks,
  taskLoadingStates,
  onOpenTask,
  onComplete,
  onAddTask,
  onSwipeComplete,
  showAssignee = true,
  showQuickAdd = true,
  emptyMessage = "No tasks yet.",
  getWorkspaceName,
  rowIdPrefix = "task-row",
  className,
}: TasksTableProps) {
  const [quickTitle, setQuickTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  const isMobile = useIsMobileViewport();
  const { taskCommentSummaries, taskCommentsReadAt, user } = useTaskStore();
  const showQuickAddButton =
    showQuickAdd && onAddTask && (!isMobile || quickTitle.length > 0 || isAdding);
  const showWorkspaceColumn = Boolean(getWorkspaceName);
  const tableColSpan =
    4 + (showWorkspaceColumn ? 1 : 0) + (showAssignee ? 1 : 0);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title || isAdding || !onAddTask) return;
    setIsAdding(true);
    const titleToAdd = title;
    setQuickTitle("");
    try {
      const created = (await onAddTask(titleToAdd)) as { id?: string } | null;
      if (created?.id) {
        setHighlightTaskId(created.id);
        triggerHaptic("light");
        window.setTimeout(() => setHighlightTaskId(null), 2200);
        requestAnimationFrame(() => {
          document
            .getElementById(`task-row-${created.id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-3 min-h-0", className)}>
      {showQuickAdd && onAddTask ? (
      <form onSubmit={handleQuickAdd} className="tasks-quick-add flex flex-col sm:flex-row gap-2">
        <input
          id="task-quick-add"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Add a task…"
          disabled={isAdding}
          className="input flex-1 px-3 md:px-4 py-2.5 text-sm min-h-[44px]"
          aria-label="Quick add task"
        />
        {showQuickAddButton ? (
          <button
            type="submit"
            disabled={isAdding || !quickTitle.trim()}
            className="btn btn-primary px-4 py-2.5 rounded-xl text-sm shrink-0 disabled:opacity-50 min-h-[44px] sm:w-auto w-full"
          >
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </button>
        ) : null}
      </form>
      ) : null}

      <div className="md:hidden space-y-1">
        {tasks.length === 0 ? (
          <div className="tasks-empty-state p-6 md:p-8 text-center text-text-muted text-sm rounded-2xl border border-border-glass bg-surface-hover/50 tasks-empty-card">
            {emptyMessage}
          </div>
        ) : (
          tasks.map((task) => {
            const due = formatDueDate(task.dueDate ?? undefined);
            const isDone = task.status === "done";
            const loading = !!taskLoadingStates?.[task.id];
            return (
              <TaskRow
                key={task.id}
                rowId={`${rowIdPrefix}-${task.id}`}
                task={task}
                isDone={isDone}
                isOpLoading={loading}
                isHighlighted={highlightTaskId === task.id}
                due={due}
                workspaceName={getWorkspaceName?.(task)}
                showAssignee={showAssignee}
                commentWorkspaceId={task.workspaceId}
                onOpen={onOpenTask}
                onComplete={onComplete}
                onSwipeComplete={onSwipeComplete}
              />
            );
          })
        )}
      </div>

      <div className="tasks-desktop-table hidden md:block rounded-2xl border border-border-glass overflow-hidden bg-surface-hover/50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="tasks-desktop-table__head-row text-left text-[10px] uppercase tracking-wide text-text-muted border-b border-border-glass bg-surface-overlay">
                <th className="w-10 p-3 font-medium" scope="col" />
                <th className="p-3 font-medium min-w-[12rem]" scope="col">
                  Title
                </th>
                {showWorkspaceColumn ? (
                  <th className="p-3 font-medium w-36 hidden md:table-cell" scope="col">
                    Workspace
                  </th>
                ) : null}
                <th className="p-3 font-medium w-28 hidden lg:table-cell" scope="col">
                  Due
                </th>
                <th className="p-3 font-medium w-32 hidden md:table-cell" scope="col">
                  Repeat
                </th>
                {showAssignee ? (
                  <th className="p-3 font-medium w-32 hidden xl:table-cell" scope="col">
                    Assignee
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="p-8 text-center text-text-muted text-sm">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const due = formatDueDate(task.dueDate ?? undefined);
                  const isDone = task.status === "done";
                  const loading = !!taskLoadingStates?.[task.id];
                  const commentState = getTaskCommentIndicatorState(
                    task.id,
                    taskCommentSummaries,
                    taskCommentsReadAt,
                    task.workspaceId,
                    user?.id,
                  );
                  const recurringLabel = task.recurringRule
                    ? getRecurringLabel(task.recurringRule)
                    : null;
                  const workspaceName = getWorkspaceName?.(task);

                  return (
                    <tr
                      key={task.id}
                      onClick={() => onOpenTask(task)}
                      className={cn(
                        "tasks-desktop-table__row border-b border-border-glass/60 cursor-pointer transition-colors",
                        "hover:bg-surface-hover",
                        isDone && "opacity-60"
                      )}
                    >
                      <td className="p-3 align-middle" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => !loading && onComplete(task.id)}
                          disabled={loading}
                          className={cn(
                            "task-complete-btn flex h-6 w-6 items-center justify-center rounded-full border p-0 transition",
                            isDone
                              ? "bg-neon-green border-neon-purple text-accent-on"
                              : "border-border hover:border-neon-purple"
                          )}
                          aria-label={isDone ? "Reopen task" : "Mark complete"}
                        >
                          {loading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isDone ? (
                            <Check className="h-3 w-3" />
                          ) : null}
                        </button>
                      </td>
                      <td className="px-3 py-2 align-middle min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={cn(
                              "font-medium leading-tight truncate min-w-0",
                              isDone && "line-through text-text-muted"
                            )}
                          >
                            {task.title}
                          </div>
                          {commentState.hasComments && (
                            <TaskCommentIndicator
                              count={commentState.count}
                              unread={commentState.unread}
                            />
                          )}
                        </div>
                      </td>
                      {showWorkspaceColumn ? (
                        <td className="p-3 align-middle hidden md:table-cell min-w-0 max-w-[10rem]">
                          {workspaceName ? (
                            <span
                              className="tasks-table-workspace inline-flex max-w-full items-center rounded-md border border-neon-purple/25 bg-neon-purple/8 px-2 py-0.5 text-[11px] font-medium text-neon-purple-tint truncate"
                              title={workspaceName}
                            >
                              {workspaceName}
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                      ) : null}
                      <td className="p-3 align-middle hidden lg:table-cell">
                        {due ? (
                          <span
                            className={cn(
                              "text-xs font-medium",
                              due.variant === "overdue" && "text-[var(--priority-p0)]",
                              due.variant === "today" && "text-neon-purple"
                            )}
                          >
                            {due.label}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="p-3 align-middle hidden md:table-cell">
                        {recurringLabel ? (
                          <span
                            className="tasks-table-repeat inline-flex max-w-[9rem] items-center gap-1 rounded-md border border-neon-purple/25 bg-neon-purple/10 px-2 py-0.5 text-[11px] font-medium text-neon-purple"
                            title={recurringLabel}
                          >
                            <Repeat className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{recurringLabel}</span>
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      {showAssignee ? (
                        <td className="p-3 align-middle hidden xl:table-cell text-xs text-text-secondary truncate max-w-[8rem]">
                          {task.assignee ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neon-purple/15 text-neon-purple text-[10px] font-medium">
                                {task.assignee === "You" ? "Y" : task.assignee.charAt(0).toUpperCase()}
                              </span>
                              <span className="truncate">{task.assignee}</span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}