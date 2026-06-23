"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { cn, formatDueDate, triggerHaptic } from "@/lib/utils";
import type { Task } from "@/types";
import { TaskRow } from "./TaskRow";
import { TaskCommentIndicator } from "./TaskCommentIndicator";
import { TaskLinkedFileIndicator } from "./TaskLinkedFileIndicator";
import { TaskLinkedFileModal } from "./TaskLinkedFileModal";
import { TaskLinkedFilePickerSheet } from "./TaskLinkedFilePickerSheet";
import { getTaskLinkedFileNotes, taskHasLinkedFiles } from "@/features/tasks/lib/taskLinkedFiles";
import { resolveAssigneeLabel } from "@/lib/assignee";
import { TaskAssigneeSelectModal } from "./TaskAssigneeSelectModal";
import { TaskTableAssigneeCell } from "./TaskTableAssigneeCell";
import { TaskStarButton } from "./TaskStarButton";
import { TaskTableDueDateCell } from "./TaskTableDueDateCell";
import { TaskTableFolderCell } from "./TaskTableFolderCell";
import { TaskTableRepeatCell } from "./TaskTableRepeatCell";
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
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  resultCount?: number;
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
  searchValue = "",
  onSearchChange,
  resultCount,
}: TasksTableProps) {
  const [quickTitle, setQuickTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  const [assigneePickerTaskId, setAssigneePickerTaskId] = useState<string | null>(null);
  const [linkedFileNoteId, setLinkedFileNoteId] = useState<string | null>(null);
  const [linkedFilePickerTask, setLinkedFilePickerTask] = useState<Task | null>(null);
  const quickAddInputRef = useRef<HTMLInputElement>(null);
  const refocusQuickAddRef = useRef(false);
  const isMobile = useIsMobileViewport();
  const {
    taskCommentSummaries,
    taskCommentsReadAt,
    user,
    getTaskFolders,
    toggleTaskStarred,
    setTaskFolder,
    updateTask,
    members,
    notes,
  } = useTaskStore();
  const folders = getTaskFolders();
  const assigneePickerTask = assigneePickerTaskId
    ? tasks.find((t) => t.id === assigneePickerTaskId)
    : undefined;
  const showQuickAddButton =
    showQuickAdd && onAddTask && isMobile && (quickTitle.length > 0 || isAdding);
  const showDesktopToolbar = Boolean(onSearchChange);
  const showWorkspaceColumn = Boolean(getWorkspaceName);

  const focusQuickAdd = () => {
    window.requestAnimationFrame(() => {
      quickAddInputRef.current?.focus({ preventScroll: true });
    });
  };

  useEffect(() => {
    if (isAdding || !refocusQuickAddRef.current) return;
    refocusQuickAddRef.current = false;
    focusQuickAdd();
  }, [isAdding]);

  const tableColSpan =
    6 + (showWorkspaceColumn ? 1 : 0) + (showAssignee ? 1 : 0);

  const submitQuickAdd = async () => {
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
        window.setTimeout(() => {
          document
            .getElementById(`task-row-${created.id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          focusQuickAdd();
        }, 0);
      }
    } finally {
      refocusQuickAddRef.current = true;
      setIsAdding(false);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitQuickAdd();
  };

  const handleQuickAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void submitQuickAdd();
  };

  const handleOpenLinkedFile = (task: Task) => {
    const linkedIds = task.linkedNoteIds ?? [];
    if (linkedIds.length === 0) return;
    if (linkedIds.length === 1) {
      setLinkedFileNoteId(linkedIds[0]);
      return;
    }
    setLinkedFilePickerTask(task);
  };

  const linkedFilePickerNotes = linkedFilePickerTask
    ? getTaskLinkedFileNotes(linkedFilePickerTask, notes)
    : [];

  return (
    <div className={cn("tasks-table-root flex flex-col gap-3 md:gap-0 min-h-0", className)}>
      {showQuickAdd && onAddTask ? (
      <div
        className={cn(
          "tasks-quick-add flex flex-col sm:flex-row gap-2 md:px-4 md:py-3.5 md:gap-3",
          showDesktopToolbar && "tasks-table-toolbar md:flex-row md:items-center md:gap-3",
        )}
      >
        {showDesktopToolbar ? (
          <div className="tasks-table-toolbar__search-group hidden md:flex min-w-0 items-center gap-2">
            <div className="tasks-table-toolbar__search flex flex-1 min-w-0 items-center">
              <Search
                className="tasks-table-toolbar__search-icon h-4 w-4 shrink-0"
                strokeWidth={2}
                aria-hidden
              />
              <input
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search tasks…"
                className="tasks-table-toolbar__search-input text-sm w-full min-h-[2.5rem]"
                aria-label="Search tasks"
              />
            </div>
            {resultCount !== undefined ? (
              <span
                className="tasks-table-toolbar__count shrink-0 tabular-nums"
                aria-label={`${resultCount} tasks shown`}
              >
                {resultCount} shown
              </span>
            ) : null}
          </div>
        ) : null}
        <form
          onSubmit={handleQuickAdd}
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-2 sm:flex-row md:gap-3",
            showDesktopToolbar && "tasks-table-toolbar__quick-add-form",
            !showDesktopToolbar && "w-full",
          )}
        >
          <input
            ref={quickAddInputRef}
            id="task-quick-add"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={handleQuickAddKeyDown}
            placeholder="Add a task…"
            disabled={isAdding}
            className={cn(
              "input w-full flex-1 px-3 py-2.5 text-sm min-h-[44px] md:px-4",
              showDesktopToolbar && "tasks-table-toolbar__quick-add",
            )}
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
      </div>
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
                showOrganize
                onOpenLinkedFile={handleOpenLinkedFile}
              />
            );
          })
        )}
      </div>

      <div className="tasks-desktop-table hidden md:flex md:flex-col md:flex-1 md:min-h-0 overflow-hidden">
        <div className="tasks-desktop-table__scroll overflow-x-auto overflow-y-auto min-h-0 flex-1">
          <table className="tasks-desktop-table__grid w-full table-fixed text-sm border-collapse">
            <thead>
              <tr className="tasks-desktop-table__head-row text-left text-[10px] uppercase tracking-wide text-text-muted border-b border-border-glass bg-surface-overlay">
                <th className="w-10 p-3 font-medium" scope="col" aria-label="Important" />
                <th className="w-10 p-3 font-medium" scope="col" aria-label="Complete" />
                <th className="tasks-desktop-table__title-col p-3 font-medium" scope="col">
                  Title
                </th>
                <th className="tasks-desktop-table__folder-col p-3 font-medium w-40 hidden lg:table-cell" scope="col">
                  Folder
                </th>
                {showWorkspaceColumn ? (
                  <th className="p-3 font-medium w-36 hidden md:table-cell" scope="col">
                    Workspace
                  </th>
                ) : null}
                <th className="p-3 font-medium w-28 hidden lg:table-cell" scope="col">
                  Due
                </th>
                <th className="tasks-desktop-table__repeat-col p-3 font-medium w-36 hidden md:table-cell" scope="col">
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
                  const isDone = task.status === "done";
                  const loading = !!taskLoadingStates?.[task.id];
                  const commentState = getTaskCommentIndicatorState(
                    task.id,
                    taskCommentSummaries,
                    taskCommentsReadAt,
                    task.workspaceId,
                    user?.id,
                  );
                  const workspaceName = getWorkspaceName?.(task);

                  return (
                    <tr
                      key={task.id}
                      onClick={() => onOpenTask(task)}
                      className={cn(
                        "tasks-desktop-table__row border-b border-border-glass/60 cursor-pointer transition-colors",
                        "hover:bg-surface-hover",
                        isDone && "opacity-60",
                        task.starred && "tasks-desktop-table__row--starred",
                      )}
                    >
                      <td className="p-2 align-middle" onClick={(e) => e.stopPropagation()}>
                        <TaskStarButton
                          size="sm"
                          starred={!!task.starred}
                          disabled={loading}
                          onToggle={() => void toggleTaskStarred(task.id)}
                        />
                      </td>
                      <td className="p-3 align-middle" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => !loading && onComplete(task.id)}
                          disabled={loading}
                          className={cn("task-complete-btn", isDone && "is-done")}
                          aria-label={isDone ? "Reopen task" : "Mark complete"}
                        >
                          {loading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isDone ? (
                            <Check className="task-complete-btn__icon stroke-[3]" />
                          ) : null}
                        </button>
                      </td>
                      <td className="tasks-desktop-table__title-cell px-3 py-2 align-top">
                        <div className="flex items-start gap-2 w-full min-w-0">
                          <div
                            className={cn(
                              "tasks-desktop-table__title flex-1 min-w-0 font-medium leading-snug",
                              isDone && "line-through text-text-muted"
                            )}
                          >
                            {task.title}
                          </div>
                          {taskHasLinkedFiles(task) ? (
                            <TaskLinkedFileIndicator
                              count={task.linkedNoteIds?.length ?? 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenLinkedFile(task);
                              }}
                            />
                          ) : null}
                          {commentState.hasComments ? (
                            <TaskCommentIndicator
                              count={commentState.count}
                              unread={commentState.unread}
                              className="shrink-0"
                            />
                          ) : null}
                        </div>
                      </td>
                      <td
                        className="tasks-desktop-table__folder-cell p-2 align-middle hidden lg:table-cell min-w-[9rem] max-w-[12rem]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <TaskTableFolderCell
                          folders={folders}
                          folderId={task.folderId}
                          disabled={loading}
                          onChange={(folderId) => void setTaskFolder(task.id, folderId)}
                        />
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
                      <td
                        className="p-2 align-middle hidden lg:table-cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <TaskTableDueDateCell
                          taskId={task.id}
                          dueDate={task.dueDate ?? undefined}
                          disabled={loading}
                        />
                      </td>
                      <td
                        className="tasks-desktop-table__repeat-cell p-2 align-top hidden md:table-cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <TaskTableRepeatCell task={task} disabled={loading} />
                      </td>
                      {showAssignee ? (
                        <td
                          className="p-2 align-middle hidden xl:table-cell min-w-0 max-w-[10rem]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <TaskTableAssigneeCell
                            assigneeLabel={task.assignee}
                            disabled={loading}
                            onOpen={() => setAssigneePickerTaskId(task.id)}
                          />
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

      <TaskAssigneeSelectModal
        open={!!assigneePickerTask}
        onOpenChange={(open) => {
          if (!open) setAssigneePickerTaskId(null);
        }}
        taskTitle={assigneePickerTask?.title}
        members={members}
        currentUserId={user?.id}
        selectedUserId={assigneePickerTask?.assigneeIds?.[0] ?? null}
        onSelectAssignee={(userId) => {
          if (!assigneePickerTask) return;
          const assigneeIds = userId ? [userId] : [];
          const assignee = resolveAssigneeLabel(assigneeIds, members, user?.id);
          void updateTask(assigneePickerTask.id, { assigneeIds, assignee });
        }}
      />

      <TaskLinkedFilePickerSheet
        open={!!linkedFilePickerTask}
        onClose={() => setLinkedFilePickerTask(null)}
        taskTitle={linkedFilePickerTask?.title}
        notes={linkedFilePickerNotes}
        onSelect={(noteId) => setLinkedFileNoteId(noteId)}
      />

      <TaskLinkedFileModal
        open={!!linkedFileNoteId}
        onClose={() => setLinkedFileNoteId(null)}
        noteId={linkedFileNoteId}
      />
    </div>
  );
}