"use client";

import { User } from "lucide-react";
import { TASK_ASSIGNEE_ALL_LABEL } from "@/lib/assignee";
import { cn } from "@/lib/utils";

interface TaskTableAssigneeCellProps {
  assigneeLabel?: string;
  disabled?: boolean;
  onOpen: () => void;
}

export function TaskTableAssigneeCell({
  assigneeLabel,
  disabled = false,
  onOpen,
}: TaskTableAssigneeCellProps) {
  const displayLabel = assigneeLabel || TASK_ASSIGNEE_ALL_LABEL;
  const initial =
    displayLabel === "You"
      ? "Y"
      : displayLabel.charAt(0).toUpperCase();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        "tasks-assignee-inline-trigger inline-flex max-w-full min-h-[28px] items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple/40 disabled:opacity-50 disabled:pointer-events-none",
        "border-border-glass bg-surface-inset text-text-secondary hover:border-neon-purple/35 hover:bg-surface-hover",
      )}
      aria-label={`Assignee: ${displayLabel}. Click to change.`}
    >
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neon-purple/15 text-[10px] font-medium text-neon-purple">
        {displayLabel === TASK_ASSIGNEE_ALL_LABEL ? (
          <User className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        ) : (
          initial
        )}
      </span>
      <span className="truncate">{displayLabel}</span>
    </button>
  );
}