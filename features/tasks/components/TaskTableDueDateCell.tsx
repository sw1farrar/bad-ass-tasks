"use client";

import { DateTimePicker } from "@/components/DateTimePicker";
import { cn, formatDueDate } from "@/lib/utils";
import { useTaskStore } from "@/store/useTaskStore";

interface TaskTableDueDateCellProps {
  taskId: string;
  dueDate?: string;
  disabled?: boolean;
}

export function TaskTableDueDateCell({
  taskId,
  dueDate,
  disabled = false,
}: TaskTableDueDateCellProps) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const due = formatDueDate(dueDate);

  return (
    <DateTimePicker
      variant="inline"
      inlinePlacement="popover"
      value={dueDate}
      displayLabel={due?.label}
      placeholder="—"
      disabled={disabled}
      triggerClassName={cn(
        due && "due-badge",
        due?.variant === "overdue" && "due-overdue",
        due?.variant === "today" && "due-today",
        due?.variant === "soon" && "due-soon",
      )}
      triggerLabelClassName={due ? "text-inherit" : undefined}
      onChange={(dateStr) => {
        void updateTask(taskId, { dueDate: dateStr });
      }}
      className="tasks-table-due-cell"
    />
  );
}