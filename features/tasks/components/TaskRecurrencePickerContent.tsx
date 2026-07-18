"use client";

import { useEffect, useState } from "react";
import { Repeat } from "lucide-react";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/DateTimePicker";
import { getRecurringLabel, triggerHaptic } from "@/lib/utils";
import type { Task } from "@/types";
import {
  buildDueDateUpdates,
  buildRecurrenceCommitPatch,
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
  const [endIncomplete, setEndIncomplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const isPopover = variant === "popover";
  /** Modal defers persist until Save and Close; popover still commits live. */
  const commitOnChange = isPopover;

  useEffect(() => {
    setLocalTask(task);
    setEndIncomplete(false);
  }, [task.id, task.dueDate, task.recurringRule, task.exceptionDates]);

  const save = (updates: Partial<Task>) => {
    if (disabled) return;
    const next = mergeRecurrenceTaskState(localTask, updates);
    setLocalTask(next);
    if (commitOnChange) {
      void onSave(updates);
    }
  };

  const handleCancel = () => {
    triggerHaptic("light");
    onClose?.();
  };

  const handleSaveAndClose = async () => {
    if (disabled || saving) return;
    if (endIncomplete) {
      triggerHaptic("error");
      toast.info("Choose an end date", {
        description:
          "Until date needs a last day before you can save. Or pick Forever / After times.",
      });
      return;
    }
    triggerHaptic("light");
    const patch = buildRecurrenceCommitPatch(task, localTask);
    if (Object.keys(patch).length > 0) {
      setSaving(true);
      try {
        await onSave(patch);
      } finally {
        setSaving(false);
      }
    }
    onClose?.();
  };

  const recurringLabel = getRecurringLabel(localTask.recurringRule);

  return (
    <div
      className={
        isPopover
          ? "task-recurrence-select__body flex flex-col space-y-3 p-3"
          : "task-recurrence-select__body flex h-full min-h-0 flex-col"
      }
    >
      <div
        className={
          isPopover
            ? "space-y-3"
            : "min-h-0 flex-1 space-y-4 overflow-y-auto p-5 pb-4"
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
              <p
                className="mt-1 text-[11px] font-medium text-neon-purple truncate"
                title={recurringLabel}
              >
                {recurringLabel}
              </p>
            ) : null}
          </div>
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
            onEndIncompleteChange={setEndIncomplete}
          />
        )}
      </div>

      {!isPopover ? (
        <div className="shrink-0 border-t border-border-glass px-5 py-3 flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="min-h-[44px] rounded-xl border border-border-glass px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50 transition sm:min-w-[7rem]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSaveAndClose()}
            disabled={disabled || saving}
            className="btn btn-primary min-h-[44px] px-4 py-2.5 text-sm font-semibold disabled:opacity-50 sm:min-w-[9rem]"
          >
            Save and Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
