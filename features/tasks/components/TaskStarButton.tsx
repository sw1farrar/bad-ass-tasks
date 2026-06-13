"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskStarButtonProps {
  starred?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  onToggle: () => void;
}

export function TaskStarButton({
  starred = false,
  disabled = false,
  size = "md",
  className,
  onToggle,
}: TaskStarButtonProps) {
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onToggle();
      }}
      disabled={disabled}
      className={cn(
        "task-star-btn inline-flex shrink-0 items-center justify-center rounded-lg transition",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        starred
          ? "text-amber-400 hover:text-amber-300"
          : "text-text-muted hover:text-amber-300/90 hover:bg-surface-hover",
        disabled && "opacity-50 cursor-default",
        className,
      )}
      aria-label={starred ? "Remove star" : "Mark important"}
      aria-pressed={starred}
    >
      <Star
        className={cn(iconClass, starred && "fill-current")}
        strokeWidth={starred ? 0 : 2}
      />
    </button>
  );
}