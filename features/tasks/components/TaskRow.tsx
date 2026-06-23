"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Check, FolderOpen, Loader2, Repeat } from "lucide-react";
import { cn, getRecurringLabel } from "@/lib/utils";
import type { Task } from "@/types";
import { TaskAssigneeBadge } from "@/components/TaskAssigneeBadge";
import { TaskCommentIndicator } from "./TaskCommentIndicator";
import { TaskLinkedFileIndicator } from "./TaskLinkedFileIndicator";
import { taskHasLinkedFiles } from "@/features/tasks/lib/taskLinkedFiles";
import { TaskFolderPicker } from "./TaskFolderPicker";
import { TaskStarButton } from "./TaskStarButton";
import { getTaskCommentIndicatorState } from "@/features/tasks/lib/taskCommentIndicators";
import { useTaskStore } from "@/store/useTaskStore";

interface TaskRowProps {
  task: Task;
  rowId?: string;
  isDone: boolean;
  isOpLoading: boolean;
  isHighlighted?: boolean;
  due: ReturnType<typeof import("@/lib/utils").formatDueDate>;
  onlineEditorsCount?: number;
  /** Hide assignee badge on private (solo) workspaces */
  showAssignee?: boolean;
  /** Home hub: workspace label on mobile meta row (left, with due date right). */
  workspaceName?: string;
  /** Workspace for comment read-state (defaults to current workspace). */
  commentWorkspaceId?: string;
  onOpen: (task: Task) => void;
  onComplete: (id: string) => void;
  onSwipeComplete?: (id: string) => void;
  /** Tasks workspace: star + folder controls */
  showOrganize?: boolean;
  onOpenLinkedFile?: (task: Task) => void;
}

export function TaskRow({
  task,
  rowId,
  isDone,
  isOpLoading,
  isHighlighted = false,
  due,
  onlineEditorsCount = 0,
  showAssignee = true,
  workspaceName,
  commentWorkspaceId,
  onOpen,
  onComplete,
  onSwipeComplete,
  showOrganize = false,
  onOpenLinkedFile,
}: TaskRowProps) {
  const linkedFileCount = task.linkedNoteIds?.length ?? 0;
  const hasLinkedFile = taskHasLinkedFiles(task);
  const {
    getTaskFolders,
    toggleTaskStarred,
    setTaskFolder,
    taskCommentSummaries,
    taskCommentsReadAt,
    currentWorkspace,
    user,
  } = useTaskStore();
  const folders = showOrganize ? getTaskFolders() : [];
  const folderName = folders.find((f) => f.id === task.folderId)?.name;
  const swipeThreshold = 120;
  const didSwipeDragRef = useRef(false);
  const [allowHtmlDrag, setAllowHtmlDrag] = useState(false);
  const [swipeRevealOpacity, setSwipeRevealOpacity] = useState(0);
  const commentState = getTaskCommentIndicatorState(
    task.id,
    taskCommentSummaries,
    taskCommentsReadAt,
    commentWorkspaceId ?? currentWorkspace.id,
    user?.id,
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setAllowHtmlDrag(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(task);
    }
  };

  const handleDragEnd = (_e: unknown, info: { offset?: { x?: number }; velocity?: { x?: number } }) => {
    if (isDone || isOpLoading) return;
    const offsetX = info.offset?.x || 0;
    const velocityX = info.velocity?.x || 0;

    if (offsetX < -swipeThreshold || velocityX < -800) {
      if (onSwipeComplete) onSwipeComplete(task.id);
    }
  };

  return (
    <div
      id={rowId}
      key={task.id}
      className={cn(
        "swipe-container relative rounded-xl overflow-hidden mb-1 transition-colors duration-500",
        isHighlighted && "task-row--highlighted ring-2 ring-neon-purple/50 bg-neon-purple/10",
      )}
      draggable={allowHtmlDrag && !isDone}
      onDragStart={(e) => {
        if (!isDone) {
          e.dataTransfer.setData("text/plain", task.id);
          e.dataTransfer.effectAllowed = "move";
        }
      }}
    >
      <div
        className="swipe-action-bg complete"
        aria-hidden="true"
        style={{ opacity: swipeRevealOpacity }}
      >
        <Check className="h-5 w-5 mr-2" /> COMPLETE
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -160, right: 0 }}
        dragElastic={0.2}
        onDragStart={() => {
          didSwipeDragRef.current = false;
          setSwipeRevealOpacity(0);
        }}
        onDrag={(_e, info) => {
          if (Math.abs(info.offset.x) > 6) didSwipeDragRef.current = true;
          const leftDrag = Math.min(0, info.offset.x);
          setSwipeRevealOpacity(Math.min(1, Math.abs(leftDrag) / 72));
        }}
        onDragEnd={(e, info) => {
          setSwipeRevealOpacity(0);
          handleDragEnd(e, info);
        }}
        whileTap={{ scale: 0.995 }}
        className={cn(
          "task-row group flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-2.5 rounded-xl border border-transparent cursor-grab active:cursor-grabbing focus:outline-none focus:ring-1 focus:ring-neon-purple/50 bg-[var(--bg-card)] relative z-10",
          isDone && "completed"
        )}
        role="button"
        tabIndex={0}
        aria-label={`Task: ${task.title}${isDone ? " (completed)" : ""}${due ? `, due ${due.label}` : ""}. Swipe left to complete.`}
        onClick={() => {
          if (!didSwipeDragRef.current) onOpen(task);
        }}
        onKeyDown={handleKeyDown}
        style={{ touchAction: "pan-y" }}
      >
        {showOrganize ? (
          <TaskStarButton
            size="sm"
            starred={!!task.starred}
            disabled={isOpLoading}
            onToggle={() => void toggleTaskStarred(task.id)}
          />
        ) : null}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isOpLoading) {
              onComplete(task.id);
            }
          }}
          disabled={isOpLoading}
          className={cn("task-complete-btn", isDone && "is-done")}
          aria-label={
            isDone
              ? "Reopen task"
              : isOpLoading
                ? "Updating task"
                : "Mark complete"
          }
        >
          {isOpLoading ? (
            <Loader2 className="h-[calc(0.875rem*2/3)] w-[calc(0.875rem*2/3)] md:h-3 md:w-3 animate-spin" />
          ) : isDone ? (
            <Check className="task-complete-btn__icon stroke-[3]" />
          ) : null}
        </button>

        {/* Mobile: title · assignee + due · recurrence */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 py-px md:hidden">
          <div className="flex items-center gap-1.5 min-w-0 w-full">
            <div
              className={cn(
                "task-title font-medium text-[14px] leading-snug truncate min-w-0 flex-1",
                isDone && "line-through",
              )}
            >
              {task.title}
            </div>
            {(hasLinkedFile || commentState.hasComments || onlineEditorsCount > 0) && (
              <div className="flex items-center gap-1.5 shrink-0 ml-auto pl-1">
                {hasLinkedFile && (
                  <TaskLinkedFileIndicator
                    count={linkedFileCount}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenLinkedFile?.(task);
                    }}
                  />
                )}
                {commentState.hasComments && (
                  <TaskCommentIndicator count={commentState.count} unread={commentState.unread} />
                )}
                {onlineEditorsCount > 0 && (
                  <span className="text-[9px] text-neon-green shrink-0 font-mono">✎{onlineEditorsCount}</span>
                )}
              </div>
            )}
          </div>
          {(workspaceName ||
            (showOrganize && folderName) ||
            (showAssignee && task.assignee) ||
            due) && (
            <div className="flex items-center justify-between gap-2 w-full min-w-0 text-[11px] leading-none">
              {showOrganize && folderName ? (
                <span className="tasks-table-folder inline-flex min-w-0 max-w-[45%] items-center gap-1 rounded-md border border-border-glass bg-surface-inset px-1.5 py-0.5 text-[10px] font-medium text-text-secondary truncate">
                  <FolderOpen className="h-2.5 w-2.5 shrink-0 text-neon-purple/80" aria-hidden />
                  {folderName}
                </span>
              ) : workspaceName ? (
                <span
                  className="tasks-table-workspace inline-flex min-w-0 max-w-full flex-1 items-center rounded-md border border-neon-purple/25 bg-neon-purple/8 px-1.5 py-0.5 text-[10px] font-medium text-neon-purple-tint truncate text-left"
                  title={workspaceName}
                >
                  {workspaceName}
                </span>
              ) : showAssignee && task.assignee ? (
                <div className="min-w-0 flex-1 flex justify-start pr-2">
                  <TaskAssigneeBadge label={task.assignee} compact className="max-w-full" />
                </div>
              ) : (
                <span className="flex-1 min-w-0" aria-hidden />
              )}
              {due && (
                <div
                  className={cn(
                    "due-badge text-[11px] font-medium shrink-0 text-right ml-auto",
                    due.variant === "overdue" && "due-overdue",
                    due.variant === "today" && "due-today",
                    due.variant === "soon" && "due-soon"
                  )}
                >
                  {due.label}
                </div>
              )}
            </div>
          )}
          {task.recurringRule && (
            <div
              className="text-[10px] text-neon-purple flex items-center gap-1 min-w-0 leading-none"
              title={getRecurringLabel(task.recurringRule)}
            >
              <Repeat className="h-2.5 w-2.5 shrink-0" aria-hidden />
              <span className="truncate">{getRecurringLabel(task.recurringRule)}</span>
            </div>
          )}
          {showOrganize && folders.length > 0 ? (
            <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
              <TaskFolderPicker
                compact
                folders={folders}
                value={task.folderId}
                disabled={isOpLoading}
                className="max-w-[12rem]"
                onChange={(folderId) => void setTaskFolder(task.id, folderId)}
              />
            </div>
          ) : null}
        </div>

        {/* Desktop: title block + trailing meta */}
        <div className="hidden md:block flex-1 min-w-0 py-0.5">
          <div className="flex items-center gap-2 min-h-0">
            <div
              className={cn(
                "task-title font-medium text-[15px] leading-tight truncate",
                isDone && "line-through",
              )}
            >
              {task.title}
            </div>
            {hasLinkedFile && (
              <TaskLinkedFileIndicator
                count={linkedFileCount}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLinkedFile?.(task);
                }}
              />
            )}
            {commentState.hasComments && (
              <TaskCommentIndicator count={commentState.count} unread={commentState.unread} />
            )}
            {task.recurringRule && (
              <span
                className="recurring-badge text-[10px] px-1.5 py-px rounded bg-neon-purple/10 text-neon-purple border border-neon-purple/30 font-medium flex items-center gap-0.5"
                title={getRecurringLabel(task.recurringRule)}
                aria-label={`Recurring: ${getRecurringLabel(task.recurringRule)}`}
              >
                <Repeat className="h-2.5 w-2.5" />
                {getRecurringLabel(task.recurringRule)}
              </span>
            )}
            {onlineEditorsCount > 0 && (
              <span className="text-[9px] text-neon-green ml-1 font-mono">✎{onlineEditorsCount}</span>
            )}
          </div>
          {task.description && (
            <div className="text-xs text-text-muted mt-0.5 line-clamp-1">{task.description}</div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-3 text-sm">
          <TaskAssigneeBadge label={task.assignee} />

          {due && (
            <div
              className={cn(
                "due-badge text-xs font-medium",
                due.variant === "overdue" && "due-overdue",
                due.variant === "today" && "due-today",
                due.variant === "soon" && "due-soon"
              )}
            >
              {due.label}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}