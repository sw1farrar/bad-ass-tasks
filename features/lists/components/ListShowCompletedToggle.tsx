"use client";

import React from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListShowCompletedToggleProps {
  completedCount: number;
  showCompleted: boolean;
  onToggle: () => void;
  className?: string;
  compact?: boolean;
}

export function ListShowCompletedToggle({
  completedCount,
  showCompleted,
  onToggle,
  className,
  compact = false,
}: ListShowCompletedToggleProps) {
  if (completedCount <= 0) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "list-completed-toggle inline-flex items-center transition active:scale-[0.98]",
        compact
          ? "list-filter-toggle list-filter-toggle--compact min-w-0 flex-1 justify-center gap-1 px-2 py-1"
          : "gap-1.5 rounded-full border px-3 py-1.5",
        showCompleted && "list-completed-toggle--active",
        className,
      )}
      aria-pressed={showCompleted}
      aria-label={
        showCompleted
          ? "Hide completed items"
          : `Show ${completedCount} completed item${completedCount === 1 ? "" : "s"}`
      }
    >
      {compact ? (
        <>
          <Check className="list-filter-toggle__icon h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="list-filter-toggle__label min-w-0 truncate">
            <span className="list-filter-toggle__name">Completed</span>
            <span className="list-filter-toggle__count" aria-hidden>
              {completedCount}
            </span>
          </span>
        </>
      ) : (
        <>
          {showCompleted ? (
            <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {showCompleted
              ? "Hide completed"
              : `Show ${completedCount} completed`}
          </span>
        </>
      )}
    </button>
  );
}