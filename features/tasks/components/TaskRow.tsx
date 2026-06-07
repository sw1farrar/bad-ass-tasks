"use client";

import React from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

interface TaskRowProps {
  task: Task;
  isDone: boolean;
  isOpLoading: boolean;
  due: ReturnType<typeof import("@/lib/utils").formatDueDate>;
  onlineEditorsCount?: number;
  onOpen: (task: Task) => void;
  onComplete: (id: string) => void;
  onSwipeComplete?: (id: string) => void;
}

export function TaskRow({
  task,
  isDone,
  isOpLoading,
  due,
  onlineEditorsCount = 0,
  onOpen,
  onComplete,
  onSwipeComplete,
}: TaskRowProps) {
  const swipeThreshold = 120;

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
      key={task.id}
      className="swipe-container relative rounded-xl overflow-hidden mb-1"
      draggable={!isDone}
      onDragStart={(e) => {
        if (!isDone) {
          e.dataTransfer.setData("text/plain", task.id);
          e.dataTransfer.effectAllowed = "move";
        }
      }}
    >
      <div className="swipe-action-bg complete" aria-hidden="true">
        <Check className="h-5 w-5 mr-2" /> COMPLETE
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -160, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.995 }}
        className={cn(
          "task-row group flex items-center gap-3 md:gap-4 px-4 md:px-5 py-2.5 md:py-3.5 rounded-xl border border-transparent cursor-grab active:cursor-grabbing focus:outline-none focus:ring-1 focus:ring-[#c084fc]/50 bg-[var(--bg-card)] relative z-10",
          isDone && "completed"
        )}
        role="button"
        tabIndex={0}
        aria-label={`Task: ${task.title}${isDone ? " (completed)" : ""}${due ? `, due ${due.label}` : ""}. Swipe left to complete.`}
        onClick={() => onOpen(task)}
        onKeyDown={handleKeyDown}
        style={{ touchAction: "pan-y" }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isOpLoading && !isDone) {
              onComplete(task.id);
            }
          }}
          disabled={isOpLoading || isDone}
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all active:scale-90 disabled:opacity-60",
            isDone
              ? "bg-[#00ff9f] border-[#c084fc] text-black"
              : "border-[#3a3a42] hover:border-[#c084fc] group-hover:border-[#c084fc]/70"
          )}
          aria-label={isDone ? "Completed" : isOpLoading ? "Updating task" : "Mark complete"}
        >
          {isOpLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isDone ? (
            <Check className="h-3.5 w-3.5" />
          ) : null}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 md:gap-3">
            <div className={cn("task-title font-medium text-[14px] md:text-[15px] truncate", isDone && "line-through")}>
              {task.title}
            </div>
            {task.recurringRule && (
              <span className="recurring-badge text-[10px] px-1.5 py-px rounded bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/30 font-medium flex items-center gap-0.5">
                ↻ {task.recurringRule.split(";")[0] || "Recurring"}
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

        <div className="flex items-center gap-3 text-sm">
          {task.assignee && (
            <div className="text-[#71717a] text-xs hidden sm:block">{task.assignee}</div>
          )}

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