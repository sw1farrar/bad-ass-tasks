"use client";

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCommentIndicatorProps {
  count: number;
  unread?: boolean;
  className?: string;
}

export function TaskCommentIndicator({ count, unread = false, className }: TaskCommentIndicatorProps) {
  if (count <= 0) return null;

  const label = unread
    ? `${count} unread comment${count === 1 ? "" : "s"}`
    : `${count} comment${count === 1 ? "" : "s"}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 shrink-0 pointer-events-none",
        unread ? "text-neon-green" : "text-text-muted",
        className,
      )}
      title={label}
      aria-label={label}
    >
      <span className="relative inline-flex">
        <MessageSquare
          className={cn("h-3 w-3", unread && "text-neon-green")}
          aria-hidden
        />
        {unread && (
          <span
            className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-neon-green ring-2 ring-bg"
            aria-hidden
          />
        )}
      </span>
      <span className="text-[10px] font-semibold tabular-nums leading-none">{count}</span>
    </span>
  );
}