"use client";

import React from "react";
import { Check, Loader2 } from "lucide-react";
import { cn, formatDueDate } from "@/lib/utils";
import type { Task } from "@/types";

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
          if (!isDone && !isOpLoading) onComplete();
        }}
        disabled={isDone || isOpLoading}
        aria-label={`Complete ${task.title}`}
        className={cn(
          "h-8 w-8 shrink-0 rounded-full border flex items-center justify-center transition",
          isDone
            ? "border-[#c084fc]/50 bg-[#c084fc]/20 text-[#c084fc]"
            : "border-white/20 hover:border-[#c084fc]/50 hover:bg-[#c084fc]/10 text-[#71717a] hover:text-[#c084fc]"
        )}
      >
        {isOpLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
      </button>

      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <div className="font-medium truncate group-hover:text-white transition">{task.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
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
    </div>
  );
}