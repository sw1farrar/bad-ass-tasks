"use client";

import React, { useState } from "react";
import { Repeat } from "lucide-react";
import { cn, getRecurringLabel } from "@/lib/utils";
import { useTaskStore } from "@/store/useTaskStore";
import type { Task } from "@/types";
import { TaskRecurrenceSelectModal } from "./TaskRecurrenceSelectModal";

interface TaskTableRepeatCellProps {
  task: Task;
  disabled?: boolean;
}

export function TaskTableRepeatCell({ task, disabled = false }: TaskTableRepeatCellProps) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const [open, setOpen] = useState(false);

  const label = task.recurringRule ? getRecurringLabel(task.recurringRule) : undefined;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen(true);
        }}
        className={cn(
          "tasks-repeat-inline-trigger flex w-full max-w-full min-h-[28px] items-center gap-1 rounded-md border px-2 py-1 text-left text-[11px] font-medium leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple/40 disabled:opacity-50 disabled:pointer-events-none",
          label
            ? "tasks-table-repeat border-neon-purple/25 bg-neon-purple/10 text-neon-purple hover:border-neon-purple/40 hover:bg-neon-purple/15"
            : "border-transparent text-text-muted hover:bg-surface-hover hover:text-text-secondary",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label ? `Repeat: ${label}. Click to change.` : "Set repeat schedule"}
        title={label}
      >
        <Repeat className="h-3 w-3 shrink-0" aria-hidden />
        <span className="tasks-table-repeat__label min-w-0 flex-1">{label ?? "—"}</span>
      </button>
      <TaskRecurrenceSelectModal
        open={open}
        onOpenChange={setOpen}
        task={task}
        disabled={disabled}
        onSave={(updates) => void updateTask(task.id, updates)}
      />
    </>
  );
}
