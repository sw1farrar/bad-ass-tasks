"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, MessageSquare, Notebook, StickyNote } from "lucide-react";
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
import { TaskNotesIndicator, taskHasNotes } from "./TaskNotesIndicator";
import { TaskStarButton } from "./TaskStarButton";
import { TaskTableDueDateCell } from "./TaskTableDueDateCell";
import { TaskTableFolderCell } from "./TaskTableFolderCell";
import { TaskTableRepeatCell } from "./TaskTableRepeatCell";
import { getTaskCommentIndicatorState } from "@/features/tasks/lib/taskCommentIndicators";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useTaskListWindow } from "@/features/tasks/hooks/useTaskListWindow";
import { useTaskStore } from "@/store/useTaskStore";

export interface TasksTableProps {
  tasks: Task[];
  taskLoadingStates?: Record<string, boolean>;
  onOpenTask: (task: Task) => void;
  onComplete: (id: string) => void;
  onAddTask?: (title: string) => Promise<unknown>;
  showAssignee?: boolean;
  showQuickAdd?: boolean;
  emptyMessage?: string;
  getWorkspaceName?: (task: Task) => string | undefined;
  rowIdPrefix?: string;
  className?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  isLoading?: boolean;
  listResetKey?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

function LoadMoreSentinel({
  enabled,
  loading,
  onVisible,
  as = "div",
  colSpan,
}: {
  enabled: boolean;
  loading?: boolean;
  onVisible: () => void;
  as?: "div" | "tr";
  colSpan?: number;
}) {
  const nodeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || loading) return;
    const el = nodeRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onVisible();
      },
      { rootMargin: "240px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, loading, onVisible]);

  if (!enabled && !loading) return null;

  const inner = loading ? (
    <Loader2 className="h-4 w-4 animate-spin text-text-muted" aria-label="Loading more tasks" />
  ) : (
    <span className="sr-only">Load more</span>
  );
  const setNode = (node: HTMLElement | null) => {
    nodeRef.current = node;
  };

  if (as === "tr") {
    return (
      <tr ref={setNode} className="tasks-desktop-table__sentinel">
        <td colSpan={colSpan ?? 8} className="py-3 text-center">
          {inner}
        </td>
      </tr>
    );
  }

  return (
    <div ref={setNode} className="flex justify-center py-3">
      {inner}
    </div>
  );
}

/** Column header with a fixed tooltip below the cell (never under the cursor). */
function ColumnHeader({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const cellRef = useRef<HTMLTableCellElement>(null);
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);

  const showTip = () => {
    const rect = cellRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
  };

  const hideTip = () => setTip(null);

  return (
    <th
      ref={cellRef}
      className={className}
      scope="col"
      aria-label={label}
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
      onFocus={showTip}
      onBlur={hideTip}
    >
      {children}
      {tip && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-[4000] -translate-x-1/2 whitespace-nowrap rounded-md border border-border-glass bg-bg-tertiary px-2 py-1 text-[11px] font-medium text-text-primary shadow-lg"
              style={{ top: tip.top, left: tip.left }}
            >
              {label}
            </span>,
            document.body
          )
        : null}
    </th>
  );
}

export function TasksTable({
  tasks,
  taskLoadingStates,
  onOpenTask,
  onComplete,
  onAddTask,
  showAssignee = true,
  showQuickAdd = true,
  emptyMessage = "No tasks yet.",
  getWorkspaceName,
  rowIdPrefix = "task-row",
  className,
  hasActiveFilters = false,
  onClearFilters,
  isLoading = false,
  listResetKey = "",
  hasMore: hasMoreRemote = false,
  onLoadMore,
  isLoadingMore = false,
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
  const showWorkspaceColumn = Boolean(getWorkspaceName);
  const showNotebookColumn = tasks.some((t) => !!t.notebookId);
  const { visibleItems, hasMore, loadMore } = useTaskListWindow(tasks, listResetKey, {
    hasMoreRemote,
    onLoadMore,
    isLoadingMore,
  });

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
    8 + (showWorkspaceColumn ? 1 : 0) + (showNotebookColumn ? 1 : 0) + (showAssignee ? 1 : 0);

  const submitQuickAdd = async (options?: { openEditor?: boolean }) => {
    const title = quickTitle.trim();
    if (!title || isAdding || !onAddTask) return;
    setIsAdding(true);
    const titleToAdd = title;
    setQuickTitle("");
    const openEditor = !!options?.openEditor;
    try {
      const created = (await onAddTask(titleToAdd)) as Task | null;
      if (created?.id) {
        if (openEditor) {
          onOpenTask(created);
          return;
        }
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
      if (!openEditor) refocusQuickAddRef.current = true;
      setIsAdding(false);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitQuickAdd();
  };

  const handleQuickAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Tab" && !e.shiftKey && quickTitle.trim()) {
      e.preventDefault();
      void submitQuickAdd({ openEditor: true });
      return;
    }
    if (e.key !== "Enter" || e.shiftKey) return;
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
        <div className="tasks-quick-add flex flex-col sm:flex-row gap-2 md:px-4 md:py-3.5 md:gap-3">
          <form
            onSubmit={handleQuickAdd}
            className="flex min-w-0 w-full flex-1 flex-col gap-2 sm:flex-row md:gap-3"
          >
            <input
              ref={quickAddInputRef}
              id="task-quick-add"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={handleQuickAddKeyDown}
              placeholder="Add a task…"
              disabled={isAdding}
              className="input w-full flex-1 px-3 py-2.5 text-sm min-h-[44px] md:px-4"
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
            {isLoading ? (
              <div className="space-y-3" aria-label="Loading tasks">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse space-y-2 rounded-xl bg-surface-overlay p-3"
                  >
                    <div className="h-3 w-3/4 rounded bg-border-glass" />
                    <div className="h-2.5 w-1/3 rounded bg-border-glass" />
                  </div>
                ))}
              </div>
            ) : hasActiveFilters ? (
              <div className="space-y-3">
                <p>No tasks match these filters.</p>
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={onClearFilters}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p>{emptyMessage}</p>
                <p className="text-xs">Add your first task above.</p>
                <button type="button" className="btn btn-primary text-sm" onClick={focusQuickAdd}>
                  Add your first task
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {visibleItems.map((task) => {
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
                  showOrganize
                  onOpenLinkedFile={handleOpenLinkedFile}
                />
              );
            })}
            <LoadMoreSentinel enabled={hasMore} loading={isLoadingMore} onVisible={loadMore} />
          </>
        )}
      </div>

      <div className="tasks-desktop-table hidden md:flex md:flex-col md:flex-1 md:min-h-0 overflow-hidden">
        <div className="tasks-desktop-table__scroll overflow-x-hidden overflow-y-auto min-h-0 flex-1">
          <table className="tasks-desktop-table__grid w-full text-sm border-collapse">
            <thead>
              <tr className="tasks-desktop-table__head-row text-left text-[10px] uppercase tracking-wide text-text-muted border-b border-border-glass bg-surface-overlay">
                <ColumnHeader
                  label="Important"
                  className="tasks-desktop-table__icon-col p-2 font-medium"
                />
                <ColumnHeader
                  label="Complete"
                  className="tasks-desktop-table__icon-col p-2 font-medium"
                />
                <ColumnHeader
                  label="Title"
                  className="tasks-desktop-table__title-col p-2 font-medium"
                >
                  Title
                </ColumnHeader>
                {showNotebookColumn ? (
                  <ColumnHeader
                    label="Notebook"
                    className="tasks-desktop-table__notebook-col p-2 font-medium hidden md:table-cell"
                  >
                    Notebook
                  </ColumnHeader>
                ) : null}
                <ColumnHeader
                  label="Folder"
                  className="tasks-desktop-table__folder-col p-2 font-medium hidden lg:table-cell"
                >
                  Folder
                </ColumnHeader>
                {showWorkspaceColumn ? (
                  <ColumnHeader
                    label="Workspace"
                    className="tasks-desktop-table__workspace-col p-2 font-medium hidden md:table-cell"
                  >
                    Workspace
                  </ColumnHeader>
                ) : null}
                <ColumnHeader
                  label="Due"
                  className="tasks-desktop-table__due-col p-2 font-medium hidden md:table-cell"
                >
                  Due
                </ColumnHeader>
                <ColumnHeader
                  label="Repeat"
                  className="tasks-desktop-table__repeat-col p-2 font-medium hidden md:table-cell"
                >
                  Repeat
                </ColumnHeader>
                <ColumnHeader
                  label="Notes"
                  className="tasks-desktop-table__notes-col p-2 font-medium"
                >
                  <StickyNote className="mx-auto h-3.5 w-3.5" aria-hidden />
                </ColumnHeader>
                <ColumnHeader
                  label="Comments"
                  className="tasks-desktop-table__comments-col p-2 font-medium"
                >
                  <MessageSquare className="mx-auto h-3.5 w-3.5" aria-hidden />
                </ColumnHeader>
                {showAssignee ? (
                  <ColumnHeader
                    label="Assignee"
                    className="tasks-desktop-table__assignee-col p-2 font-medium hidden md:table-cell"
                  >
                    Assignee
                  </ColumnHeader>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={index} className="animate-pulse border-b border-border-glass/60">
                      <td colSpan={tableColSpan} className="p-3">
                        <div className="h-5 w-3/4 rounded bg-surface-hover" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={tableColSpan} className="p-8 text-center text-text-muted text-sm">
                      {hasActiveFilters ? (
                        <div className="space-y-3">
                          <p>No tasks match these filters.</p>
                          <button
                            type="button"
                            className="btn btn-secondary text-sm"
                            onClick={onClearFilters}
                          >
                            Clear filters
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p>{emptyMessage}</p>
                          <p className="text-xs">Add your first task above.</p>
                          <button
                            type="button"
                            className="btn btn-primary text-sm"
                            onClick={focusQuickAdd}
                          >
                            Add your first task
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              ) : (
                visibleItems.map((task) => {
                  const isDone = task.status === "done";
                  const loading = !!taskLoadingStates?.[task.id];
                  const isNotebookTask = !!task.notebookId;
                  const commentState = getTaskCommentIndicatorState(
                    task.id,
                    taskCommentSummaries,
                    taskCommentsReadAt,
                    task.workspaceId,
                    user?.id
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
                        task.starred && "tasks-desktop-table__row--starred"
                      )}
                    >
                      <td className="p-2 align-middle" onClick={(e) => e.stopPropagation()}>
                        {isNotebookTask ? (
                          <span className="text-text-muted px-1">—</span>
                        ) : (
                          <TaskStarButton
                            size="sm"
                            starred={!!task.starred}
                            disabled={loading}
                            onToggle={() => void toggleTaskStarred(task.id)}
                          />
                        )}
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
                      <td className="tasks-desktop-table__title-cell px-3 py-2 align-middle">
                        <div className="flex items-center gap-2 w-full min-w-0">
                          <div
                            className={cn(
                              "tasks-desktop-table__title flex-1 min-w-0 font-medium leading-snug",
                              isDone && "line-through text-text-muted"
                            )}
                          >
                            {task.title}
                          </div>
                          {!isNotebookTask && taskHasLinkedFiles(task) ? (
                            <TaskLinkedFileIndicator
                              count={task.linkedNoteIds?.length ?? 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenLinkedFile(task);
                              }}
                            />
                          ) : null}
                        </div>
                      </td>
                      {showNotebookColumn ? (
                        <td className="tasks-desktop-table__notebook-cell p-2 align-middle hidden md:table-cell min-w-0">
                          {task.notebookName ? (
                            <span
                              className="inline-flex max-w-full items-center gap-1 rounded-md border border-neon-purple/25 bg-neon-purple/8 px-2 py-0.5 text-[11px] font-medium text-neon-purple-tint truncate"
                              title={task.notebookName}
                            >
                              <Notebook className="h-3 w-3 shrink-0" aria-hidden />
                              <span className="truncate">{task.notebookName}</span>
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                      ) : null}
                      <td
                        className="tasks-desktop-table__folder-cell tasks-editable-field p-2 align-middle hidden lg:table-cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isNotebookTask ? (
                          <span className="text-text-muted">—</span>
                        ) : (
                          <TaskTableFolderCell
                            folders={folders}
                            folderId={task.folderId}
                            disabled={loading}
                            onChange={(folderId) => void setTaskFolder(task.id, folderId)}
                          />
                        )}
                      </td>
                      {showWorkspaceColumn ? (
                        <td className="tasks-desktop-table__workspace-cell p-2 align-middle hidden md:table-cell min-w-0">
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
                        className="tasks-desktop-table__due-cell p-2 align-middle hidden md:table-cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isNotebookTask ? (
                          <span className="text-text-muted">—</span>
                        ) : (
                          <TaskTableDueDateCell
                            taskId={task.id}
                            dueDate={task.dueDate ?? undefined}
                            disabled={loading}
                          />
                        )}
                      </td>
                      <td
                        className="tasks-desktop-table__repeat-cell tasks-editable-field p-2 align-middle hidden md:table-cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isNotebookTask ? (
                          <span className="text-text-muted">—</span>
                        ) : (
                          <TaskTableRepeatCell task={task} disabled={loading} />
                        )}
                      </td>
                      <td className="tasks-desktop-table__notes-cell p-1.5 align-middle">
                        {!isNotebookTask && taskHasNotes(task.description) ? (
                          <TaskNotesIndicator />
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="tasks-desktop-table__comments-cell p-1.5 align-middle">
                        {!isNotebookTask && commentState.hasComments ? (
                          <TaskCommentIndicator
                            count={commentState.count}
                            unread={commentState.unread}
                            className="shrink-0"
                          />
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      {showAssignee ? (
                        <td
                          className="tasks-desktop-table__assignee-cell tasks-editable-field p-2 align-middle hidden md:table-cell min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isNotebookTask ? (
                            <span className="text-text-muted">—</span>
                          ) : (
                            <TaskTableAssigneeCell
                              assigneeLabel={task.assignee}
                              disabled={loading}
                              onOpen={() => setAssigneePickerTaskId(task.id)}
                            />
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
              {tasks.length > 0 ? (
                <LoadMoreSentinel
                  as="tr"
                  colSpan={tableColSpan}
                  enabled={hasMore}
                  loading={isLoadingMore}
                  onVisible={loadMore}
                />
              ) : null}
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
