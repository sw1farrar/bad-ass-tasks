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
        "list-completed-toggle inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition active:scale-[0.98]",
        showCompleted
          ? "border-neon-purple/35 bg-neon-purple/10 text-neon-purple"
          : "border-border-glass bg-[color-mix(in_srgb,var(--list-bg,var(--bg-card))_72%,var(--surface-hover)_28%)] text-text-secondary hover:border-neon-purple/25 hover:text-text-primary",
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
        <EyeOff className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      ) : (
        <Eye className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      )}
      <Check className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      <span>
        {showCompleted
          ? "Hide completed"
          : `Show ${completedCount} completed`}
      </span>
    </button>
  );
}