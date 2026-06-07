import type { Priority, TaskStatus } from "@/types";

const WORKFLOW_LABELS: Partial<Record<TaskStatus, string>> = {
  backlog: "Backlog",
  doing: "In progress",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  P0: "Urgent",
  P1: "High",
  P2: "Normal",
  P3: "Low",
};

/** Workflow stage for table — omits default open state ("todo") and completed ("done"). */
export function getTaskWorkflowLabel(status: TaskStatus): string | null {
  return WORKFLOW_LABELS[status] ?? null;
}

export function getTaskPriorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority] ?? priority;
}

export function isElevatedPriority(priority: Priority): boolean {
  return priority === "P0" || priority === "P1";
}