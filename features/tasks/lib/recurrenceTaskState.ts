import { parseLocalDate, toDueDateStorage } from "@/lib/datetime";
import {
  applyTaskUpdateSideEffects,
  generateRecurringRule,
  getNextRecurringDue,
  isDueDatePast,
  normalizeExceptionKey,
  parseRecurringRule,
  resolveRecurrenceSeriesAnchor,
} from "@/lib/utils";
import type { Task } from "@/types";

export type RecurringDueDateScope = "occurrence" | "series";

export function buildDueDateUpdates(dateStr: string | null | undefined): Partial<Task> {
  if (!dateStr) {
    return { dueDate: undefined, recurringRule: null, exceptionDates: undefined };
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const localDate = new Date(y, m - 1, d);
  return { dueDate: toDueDateStorage(localDate) };
}

/**
 * Apply a due-date change for a recurring task.
 * - series: move the whole cadence (re-anchor + clear exceptions)
 * - occurrence: one-off move (exception old date, keep series anchor)
 */
export function buildRecurringDueDateChange(
  task: Task,
  newDateStr: string | null | undefined,
  scope: RecurringDueDateScope = "series",
): Partial<Task> {
  const base = buildDueDateUpdates(newDateStr);
  if (!newDateStr || !task.recurringRule) return base;

  const pattern = parseRecurringRule(task.recurringRule);
  if (!pattern) return base;

  const oldKey = task.dueDate ? normalizeExceptionKey(task.dueDate) : null;
  const newKey = normalizeExceptionKey(base.dueDate as string);

  if (scope === "series") {
    const nextPattern = { ...pattern, seriesAnchor: newKey };
    return {
      dueDate: base.dueDate,
      recurringRule: generateRecurringRule(nextPattern),
      exceptionDates: undefined,
    };
  }

  // This occurrence only — keep series seed; exclude the old occurrence date.
  const seriesAnchor =
    pattern.seriesAnchor || (oldKey ? oldKey : undefined) || newKey;
  const nextPattern = { ...pattern, seriesAnchor };
  const currentEx = (task.exceptionDates || []).map((ex) => normalizeExceptionKey(ex));
  const nextEx =
    oldKey && oldKey !== newKey
      ? Array.from(new Set([...currentEx.filter((ex) => ex !== oldKey && ex !== newKey), oldKey]))
      : currentEx.filter((ex) => ex !== newKey);

  return {
    dueDate: base.dueDate,
    recurringRule: generateRecurringRule(nextPattern),
    exceptionDates: nextEx.length ? nextEx : undefined,
  };
}

/** Skip the visible due date and advance exactly one occurrence from that date. */
export function buildSkipOccurrenceUpdates(task: Task): {
  updates: Partial<Task>;
  skippedKey: string;
  isOverdue: boolean;
} | null {
  if (!task.recurringRule || !task.dueDate) return null;

  const rule = task.recurringRule;
  const seriesSeed = resolveRecurrenceSeriesAnchor(rule, task.dueDate) ?? task.dueDate;
  const isOverdue = isDueDatePast(task.dueDate);
  const skipTarget = parseLocalDate(task.dueDate);
  if (!skipTarget) return null;

  const skippedKey = normalizeExceptionKey(skipTarget);
  const currentEx = (task.exceptionDates || []).map((ex) => normalizeExceptionKey(ex));
  if (currentEx.includes(skippedKey)) return null;

  const nextEx = [...currentEx, skippedKey];
  const updates: Partial<Task> = { exceptionDates: nextEx };
  const nextDue = getNextRecurringDue(rule, skipTarget, seriesSeed, nextEx);
  if (nextDue) {
    updates.dueDate = toDueDateStorage(nextDue);
  }

  return { updates, skippedKey, isOverdue };
}

/** Diff draft vs original for deferred save from the recurrence picker modal. */
export function buildRecurrenceCommitPatch(original: Task, draft: Task): Partial<Task> {
  const patch: Partial<Task> = {};
  const originalDue = original.dueDate ?? undefined;
  const draftDue = draft.dueDate ?? undefined;

  if (originalDue !== draftDue) {
    if (!draftDue) {
      return { dueDate: undefined, recurringRule: null, exceptionDates: undefined };
    }
    patch.dueDate = draftDue;
  }

  const originalRule = original.recurringRule ?? null;
  const draftRule = draft.recurringRule ?? null;
  if (originalRule !== draftRule) {
    patch.recurringRule = draftRule;
  }

  const originalExceptions = JSON.stringify(original.exceptionDates ?? null);
  const draftExceptions = JSON.stringify(draft.exceptionDates ?? null);
  if (originalExceptions !== draftExceptions) {
    patch.exceptionDates = draft.exceptionDates;
  }

  return patch;
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
