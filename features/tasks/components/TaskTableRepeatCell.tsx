"use client";

import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskTableRepeatCellProps {
  label?: string;
  disabled?: boolean;
  onOpen: () => void;
}

export function TaskTableRepeatCell({
  label,
  disabled = false,
  onOpen,
}: TaskTableRepeatCellProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        "tasks-repeat-inline-trigger flex w-full max-w-full min-h-[28px] items-start gap-1 rounded-md border px-2 py-1 text-left text-[11px] font-medium leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple/40 disabled:opacity-50 disabled:pointer-events-none",
        label
          ? "tasks-table-repeat border-neon-purple/25 bg-neon-purple/10 text-neon-purple hover:border-neon-purple/40 hover:bg-neon-purple/15"
          : "border-transparent text-text-muted hover:bg-surface-hover hover:text-text-secondary",
      )}
      aria-label={label ? `Repeat: ${label}. Click to change.` : "Set repeat schedule"}
      title={label}
    >
      <Repeat className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span className="tasks-table-repeat__label min-w-0 flex-1">{label ?? "—"}</span>
    </button>
  );
}