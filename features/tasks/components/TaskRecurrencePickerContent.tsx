"use client";

import { useEffect, useState } from "react";
import { Repeat, X } from "lucide-react";
import { DateTimePicker } from "@/components/DateTimePicker";
import { getRecurringLabel } from "@/lib/utils";
import type { Task } from "@/types";
import {
  buildDueDateUpdates,
  mergeRecurrenceTaskState,
} from "@/features/tasks/lib/recurrenceTaskState";
import { TaskRecurrenceEditor } from "./TaskRecurrenceEditor";

interface TaskRecurrencePickerContentProps {
  task: Task;
  disabled?: boolean;
  onSave: (updates: Partial<Task>) => void | Promise<void>;
  variant?: "modal" | "popover";
  onClose?: () => void;
}

export function TaskRecurrencePickerContent({
  task,
  disabled = false,
  onSave,
  variant = "modal",
  onClose,
}: TaskRecurrencePickerContentProps) {
  const [localTask, setLocalTask] = useState(task);
  const isPopover = variant === "popover";

  useEffect(() => {
    setLocalTask(task);
  }, [task.id, task.dueDate, task.recurringRule, task.exceptionDates]);

  const save = (updates: Partial<Task>) => {
    if (disabled) return;
    const next = mergeRecurrenceTaskState(localTask, updates);
    setLocalTask(next);
    void onSave(updates);
  };

  const recurringLabel = getRecurringLabel(localTask.recurringRule);

  return (
    <div
      className={
        isPopover
          ? "task-recurrence-select__body space-y-3 p-3"
          : "task-recurrence-select__body space-y-4 p-5"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={
              isPopover
                ? "text-xs font-semibold uppercase tracking-wide text-text-muted flex items-center gap-1.5"
                : "text-base font-semibold text-text-primary tracking-tight flex items-center gap-2"
            }
          >
            <Repeat className="h-3.5 w-3.5 text-neon-purple shrink-0" aria-hidden />
            Repeat
          </h3>
          {!isPopover ? (
            <>
              <p
                className="mt-1 text-sm text-text-secondary leading-relaxed truncate"
                title={task.title}
              >
                {task.title}
              </p>
              {recurringLabel ? (
                <p className="mt-1 text-xs font-medium text-neon-purple">{recurringLabel}</p>
              ) : (
                <p className="mt-1 text-xs text-text-muted">No repeat schedule</p>
              )}
            </>
          ) : recurringLabel ? (
            <p className="mt-1 text-[11px] font-medium text-neon-purple truncate" title={recurringLabel}>
              {recurringLabel}
            </p>
          ) : null}
        </div>
        {!isPopover && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-surface-hover transition shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <DateTimePicker
        label="Due date"
        value={localTask.dueDate}
        onChange={(dateStr) => save(buildDueDateUpdates(dateStr))}
        className="w-full"
        variant="inline"
        inlinePlacement={isPopover ? "embedded" : "modal"}
      />

      {!localTask.dueDate ? (
        <p className="text-xs text-text-secondary rounded-xl border border-dashed border-border-glass px-3 py-2.5">
          Set a due date above to enable recurring rules.
        </p>
      ) : (
        <TaskRecurrenceEditor
          localTask={localTask}
          save={save}
          datePickerInlinePlacement={isPopover ? "embedded" : "modal"}
        />
      )}
    </div>
  );
}
