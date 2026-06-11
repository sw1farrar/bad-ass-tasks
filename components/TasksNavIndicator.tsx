"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TasksNavIndicatorProps {
  openCount: number;
  overdueCount: number;
  variant?: "sidebar" | "bottom";
  className?: string;
}

export function TasksNavIndicator({
  openCount,
  overdueCount,
  variant = "sidebar",
  className,
}: TasksNavIndicatorProps) {
  if (openCount <= 0) return null;

  const hasOverdue = overdueCount > 0;
  const display = openCount > 99 ? "99+" : String(openCount);

  const ariaLabel = hasOverdue
    ? `${openCount} open task${openCount === 1 ? "" : "s"}, ${overdueCount} overdue`
    : `${openCount} open task${openCount === 1 ? "" : "s"}`;

  if (variant === "bottom") {
    return (
      <span
        className={cn(
          "nav-count-badge nav-count-badge--bottom",
          hasOverdue && "nav-count-badge--overdue",
          className,
        )}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        {display}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "nav-count-badge nav-count-badge--sidebar",
        hasOverdue && "nav-count-badge--overdue",
        className,
      )}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {hasOverdue && (
        <span className="nav-count-badge__pulse" aria-hidden />
      )}
      {display}
    </span>
  );
}