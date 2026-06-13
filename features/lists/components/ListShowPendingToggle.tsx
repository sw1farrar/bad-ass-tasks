"use client";

import React from "react";
import { CirclePause, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListShowPendingToggleProps {
  pendingCount: number;
  showPending: boolean;
  onToggle: () => void;
  className?: string;
  compact?: boolean;
}

export function ListShowPendingToggle({
  pendingCount,
  showPending,
  onToggle,
  className,
  compact = false,
}: ListShowPendingToggleProps) {
  if (pendingCount <= 0) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "list-pending-toggle inline-flex items-center transition active:scale-[0.98]",
        compact
          ? "list-filter-toggle list-filter-toggle--compact min-w-0 flex-1 justify-center gap-1 px-2 py-1"
          : "gap-1.5 rounded-full border px-3 py-1.5",
        showPending && "list-pending-toggle--active",
        className,
      )}
      aria-pressed={showPending}
      aria-label={
        showPending
          ? "Hide pending items"
          : `Show ${pendingCount} pending item${pendingCount === 1 ? "" : "s"}`
      }
    >
      {compact ? (
        <>
          <CirclePause className="list-filter-toggle__icon h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="list-filter-toggle__label min-w-0 truncate">
            <span className="list-filter-toggle__name">Pending</span>
            <span className="list-filter-toggle__count" aria-hidden>
              {pendingCount}
            </span>
          </span>
        </>
      ) : (
        <>
          {showPending ? (
            <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <CirclePause className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {showPending ? "Hide pending" : `Show ${pendingCount} pending`}
          </span>
        </>
      )}
    </button>
  );
}