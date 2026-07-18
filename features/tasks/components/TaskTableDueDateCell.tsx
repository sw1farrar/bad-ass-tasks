"use client";

import { useState } from "react";
import { DateTimePicker } from "@/components/DateTimePicker";
import { parseLocalDate, safeFormatDate } from "@/lib/datetime";
import { cn, formatDueDate } from "@/lib/utils";
import { useTaskStore } from "@/store/useTaskStore";
import {
  buildDueDateUpdates,
  buildRecurringDueDateChange,
  type RecurringDueDateScope,
} from "@/features/tasks/lib/recurrenceTaskState";
import { RecurringDueDateScopeModal } from "./RecurringDueDateScopeModal";

interface TaskTableDueDateCellProps {
  taskId: string;
  dueDate?: string;
  disabled?: boolean;
}

/** Desktop table label: short weekday next to the due date (e.g. "Tue, Jul 18"). */
function formatTableDueLabel(dueDate: string | undefined, baseLabel: string | undefined): string | undefined {
  if (!dueDate || !baseLabel) return baseLabel;
  const date = parseLocalDate(dueDate);
  if (!date) return baseLabel;
  const weekday = safeFormatDate(date, "EEE");
  if (!weekday) return baseLabel;
  if (baseLabel === "Today" || baseLabel === "Tomorrow") {
    return `${baseLabel} · ${weekday}`;
  }
  return `${weekday}, ${baseLabel}`;
}

export function TaskTableDueDateCell({
  taskId,
  dueDate,
  disabled = false,
}: TaskTableDueDateCellProps) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const task = useTaskStore((s) => s.tasks.find((t) => t.id === taskId));
  const [pendingDue, setPendingDue] = useState<string | null | undefined>(undefined);
  const [scopeOpen, setScopeOpen] = useState(false);
  const due = formatDueDate(dueDate);
  const displayLabel = formatTableDueLabel(dueDate, due?.label);

  const commitDue = (dateStr: string | null | undefined, scope: RecurringDueDateScope = "series") => {
    if (!task) {
      void updateTask(taskId, { dueDate: dateStr || undefined });
      return;
    }
    if (!dateStr) {
      void updateTask(taskId, buildDueDateUpdates(null));
      return;
    }
    if (task.recurringRule) {
      void updateTask(taskId, buildRecurringDueDateChange(task, dateStr, scope));
      return;
    }
    void updateTask(taskId, buildDueDateUpdates(dateStr));
  };

  return (
    <>
      <DateTimePicker
        variant="inline"
        inlinePlacement="popover"
        value={dueDate}
        displayLabel={displayLabel}
        placeholder="—"
        disabled={disabled}
        triggerClassName={cn(
          "tasks-editable-field",
          due && "due-badge",
          due?.variant === "overdue" && "due-overdue",
          due?.variant === "today" && "due-today",
          due?.variant === "soon" && "due-soon",
        )}
        triggerLabelClassName={due ? "text-inherit" : undefined}
        onChange={(dateStr) => {
          if (!dateStr) {
            commitDue(null);
            return;
          }
          if (task?.recurringRule && (dueDate ?? null) !== dateStr) {
            setPendingDue(dateStr);
            setScopeOpen(true);
            return;
          }
          commitDue(dateStr);
        }}
        className="tasks-table-due-cell"
      />
      <RecurringDueDateScopeModal
        open={scopeOpen}
        taskTitle={task?.title}
        onCancel={() => {
          setScopeOpen(false);
          setPendingDue(undefined);
        }}
        onChoose={(scope) => {
          const next = pendingDue;
          setScopeOpen(false);
          setPendingDue(undefined);
          if (next !== undefined) commitDue(next, scope);
        }}
      />
    </>
  );
}