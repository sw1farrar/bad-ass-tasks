"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Repeat } from "lucide-react";
import { cn, getRecurringLabel } from "@/lib/utils";
import type { Task } from "@/types";
import { TaskAssigneeBadge } from "@/components/TaskAssigneeBadge";
import { TaskCommentIndicator } from "./TaskCommentIndicator";
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
}: TaskRowProps) {
  const swipeThreshold = 120;
  const didSwipeDragRef = useRef(false);
  const [allowHtmlDrag, setAllowHtmlDrag] = useState(false);
  const [swipeRevealOpacity, setSwipeRevealOpacity] = useState(0);
  const { taskCommentSummaries, taskCommentsReadAt, currentWorkspace, user } = useTaskStore();
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
        isHighlighted && "ring-2 ring-[#c084fc]/50 bg-[#c084fc]/10",
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
          "task-row group flex items-center gap-2 md:gap-3 px-0 md:px-5 py-2 md:py-2.5 rounded-xl border border-transparent cursor-grab active:cursor-grabbing focus:outline-none focus:ring-1 focus:ring-[#c084fc]/50 bg-[var(--bg-card)] relative z-10",
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isOpLoading) {
              onComplete(task.id);
            }
          }}
          disabled={isOpLoading}
          className={cn(
            "task-complete-btn flex shrink-0 items-center justify-center rounded-full border p-0 transition-all active:scale-90 disabled:opacity-60",
            "h-10 w-10 md:h-6 md:w-6",
            isDone
              ? "bg-[#00ff9f] border-[#c084fc] text-black"
              : "border-[#3a3a42] hover:border-[#c084fc] group-hover:border-[#c084fc]/70"
          )}
          aria-label={
            isDone
              ? "Reopen task"
              : isOpLoading
                ? "Updating task"
                : "Mark complete"
          }
        >
          {isOpLoading ? (
            <Loader2 className="h-3.5 w-3.5 md:h-3 md:w-3 animate-spin" />
          ) : isDone ? (
            <Check className="h-4 w-4 md:h-3.5 md:w-3.5" />
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
            {(commentState.hasComments || onlineEditorsCount > 0) && (
              <div className="flex items-center gap-1.5 shrink-0 ml-auto pl-1">
                {commentState.hasComments && (
                  <TaskCommentIndicator count={commentState.count} unread={commentState.unread} />
                )}
                {onlineEditorsCount > 0 && (
                  <span className="text-[9px] text-[#00ff9f] shrink-0 font-mono">✎{onlineEditorsCount}</span>
                )}
              </div>
            )}
          </div>
          {(workspaceName || (showAssignee && task.assignee) || due) && (
            <div className="flex items-center justify-between gap-2 w-full min-w-0 text-[11px] leading-none">
              {workspaceName ? (
                <span className="min-w-0 flex-1 truncate text-left text-[#71717a] font-medium">
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
              className="text-[10px] text-[#c084fc] flex items-center gap-1 min-w-0 leading-none"
              title={getRecurringLabel(task.recurringRule)}
            >
              <Repeat className="h-2.5 w-2.5 shrink-0" aria-hidden />
              <span className="truncate">{getRecurringLabel(task.recurringRule)}</span>
            </div>
          )}
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
            {commentState.hasComments && (
              <TaskCommentIndicator count={commentState.count} unread={commentState.unread} />
            )}
            {task.recurringRule && (
              <span
                className="recurring-badge text-[10px] px-1.5 py-px rounded bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/30 font-medium flex items-center gap-0.5"
                title={getRecurringLabel(task.recurringRule)}
                aria-label={`Recurring: ${getRecurringLabel(task.recurringRule)}`}
              >
                <Repeat className="h-2.5 w-2.5" />
                {getRecurringLabel(task.recurringRule)}
              </span>
            )}
            {onlineEditorsCount > 0 && (
              <span className="text-[9px] text-[#00ff9f] ml-1 font-mono">✎{onlineEditorsCount}</span>
            )}
          </div>
          {task.description && (
            <div className="text-xs text-[#71717a] mt-0.5 line-clamp-1">{task.description}</div>
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