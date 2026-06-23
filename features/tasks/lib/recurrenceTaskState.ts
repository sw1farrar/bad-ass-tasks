import { toDueDateStorage } from "@/lib/datetime";
import { applyTaskUpdateSideEffects } from "@/lib/utils";
import type { Task } from "@/types";

export function buildDueDateUpdates(dateStr: string | null | undefined): Partial<Task> {
  if (!dateStr) {
    return { dueDate: undefined, recurringRule: null, exceptionDates: undefined };
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const localDate = new Date(y, m - 1, d);
  return { dueDate: toDueDateStorage(localDate) };
}

export function mergeRecurrenceTaskState(current: Task, updates: Partial<Task>): Task {
  const normalized = applyTaskUpdateSideEffects(updates);
  if (
    Object.prototype.hasOwnProperty.call(normalized, "recurringRule") &&
    (normalized.recurringRule === null || normalized.recurringRule === undefined)
  ) {
    normalized.recurringRule = null;
    if (!Object.prototype.hasOwnProperty.call(normalized, "exceptionDates")) {
      normalized.exceptionDates = undefined;
    }
  }
  const next = { ...current, ...normalized };
  if (
    Object.prototype.hasOwnProperty.call(normalized, "dueDate") &&
    (normalized.dueDate === undefined || normalized.dueDate === null)
  ) {
    delete next.dueDate;
  }
  if (normalized.recurringRule === null) {
    delete next.recurringRule;
    if (normalized.exceptionDates === undefined) {
      delete next.exceptionDates;
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(normalized, "completedAt") &&
    (normalized.completedAt === undefined || normalized.completedAt === null)
  ) {
    delete next.completedAt;
  }
  return next;
}
