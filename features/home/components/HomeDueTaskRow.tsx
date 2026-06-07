"use client";

import React from "react";
import { Check, Loader2, Repeat } from "lucide-react";
import { cn, formatDueDate, getRecurringLabel } from "@/lib/utils";
import type { Task } from "@/types";
import { TaskAssigneeBadge } from "@/components/TaskAssigneeBadge";

interface HomeDueTaskRowProps {
  task: Task;
  workspaceName: string;
  isOpLoading?: boolean;
  onOpen: () => void;
  onComplete: () => void;
}

export function HomeDueTaskRow({
  task,
  workspaceName,
  isOpLoading = false,
  onOpen,
  onComplete,
}: HomeDueTaskRowProps) {
  const due = formatDueDate(task.dueDate);
  const isDone = task.status === "done";

  return (
    <div className="glass rounded-xl p-3 flex items-center gap-3 border border-white/10 hover:border-[#c084fc]/30 transition group">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!isOpLoading) onComplete();
        }}
        disabled={isOpLoading}
        aria-label={isDone ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className={cn(
          "h-8 w-8 shrink-0 rounded-full border flex items-center justify-center transition",
          isDone
            ? "border-[#00ff9f] bg-[#00ff9f] text-black"
            : "border-white/20 hover:border-[#c084fc]/50 hover:bg-[#c084fc]/10 text-[#71717a] hover:text-[#c084fc]"
        )}
      >
        {isOpLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isDone ? (
          <Check className="h-4 w-4" />
        ) : null}
      </button>

      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <div className="font-medium truncate group-hover:text-white transition flex items-center gap-1.5">
          <span className="truncate">{task.title}</span>
          {task.recurringRule && (
            <span
              className="shrink-0 text-[9px] px-1 py-px rounded bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/30 flex items-center gap-0.5"
              title={getRecurringLabel(task.recurringRule)}
            >
              <Repeat className="h-2 w-2" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] text-[#71717a] truncate">{workspaceName}</span>
          {due && (
            <span
              className={cn(
                "text-[10px] font-mono shrink-0",
                due.variant === "overdue" ? "text-[#ff3366]" : "text-[#a1a1aa]"
              )}
            >
              {due.label}
            </span>
          )}
        </div>
      </button>

      <div className="shrink-0 flex flex-col items-end gap-0.5 max-w-[40%]">
        <span className="text-[9px] uppercase tracking-widest text-[#52525b]">Responsible</span>
        {task.assignee ? (
          <TaskAssigneeBadge label={task.assignee} className="max-w-full" />
        ) : (
          <span className="text-xs text-[#52525b] italic">Unassigned</span>
        )}
      </div>
    </div>
  );
}