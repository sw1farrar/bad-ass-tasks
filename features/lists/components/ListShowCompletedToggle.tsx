"use client";

import React from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListShowCompletedToggleProps {
  completedCount: number;
  showCompleted: boolean;
  onToggle: () => void;
  className?: string;
}

export function ListShowCompletedToggle({
  completedCount,
  showCompleted,
  onToggle,
  className,
}: ListShowCompletedToggleProps) {
  if (completedCount <= 0) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "list-completed-toggle inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition active:scale-[0.98]",
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
    </button>
  );
}