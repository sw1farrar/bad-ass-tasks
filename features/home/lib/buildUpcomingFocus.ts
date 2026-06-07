import { addDays } from "date-fns";
import type { Priority, Task } from "@/types";
import {
  isDueDatePast,
  isDueDateToday,
  parseLocalDate,
  startOfLocalToday,
} from "@/lib/datetime";
import type { HomeFocusItem } from "./buildAttentionItems";

const PRIORITY_RANK: Record<Priority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

export function isDueDateTomorrow(
  dueDateIso: string,
  reference: Date = startOfLocalToday(),
): boolean {
  const due = parseLocalDate(dueDateIso);
  if (!due) return false;
  const tomorrow = addDays(reference, 1);
  return due.getTime() === tomorrow.getTime();
}

export function isTaskDueTodayOrTomorrow(
  dueDateIso: string,
  reference: Date = startOfLocalToday(),
): boolean {
  return isDueDateToday(dueDateIso, reference) || isDueDateTomorrow(dueDateIso, reference);
}

/** Past due, due today, or due tomorrow — the Home hub due-date window. */
export function isTaskOverdueTodayOrTomorrow(
  dueDateIso: string,
  reference: Date = startOfLocalToday(),
): boolean {
  return (
    isDueDatePast(dueDateIso, reference) ||
    isDueDateToday(dueDateIso, reference) ||
    isDueDateTomorrow(dueDateIso, reference)
  );
}

export function sortUpcomingFocusItems(items: HomeFocusItem[]): HomeFocusItem[] {
  const today = startOfLocalToday().getTime();
  const tomorrow = addDays(startOfLocalToday(), 1).getTime();

  return [...items].sort((a, b) => {
    const aDue = parseLocalDate(a.task.dueDate!)?.getTime() ?? 0;
    const bDue = parseLocalDate(b.task.dueDate!)?.getTime() ?? 0;
    const aDay = aDue === today ? 0 : aDue === tomorrow ? 1 : 2;
    const bDay = bDue === today ? 0 : bDue === tomorrow ? 1 : 2;
    if (aDay !== bDay) return aDay - bDay;

    const aPri = PRIORITY_RANK[a.task.priority] ?? 9;
    const bPri = PRIORITY_RANK[b.task.priority] ?? 9;
    if (aPri !== bPri) return aPri - bPri;

    if (aDue !== bDue) return aDue - bDue;
    return a.task.title.localeCompare(b.task.title);
  });
}

export function pickUpcomingTasksFromWorkspace(
  tasks: Task[],
  workspaceId: string,
  workspaceName: string,
  reference: Date = startOfLocalToday(),
): HomeFocusItem[] {
  return tasks
    .filter((t) => {
      if (t.status === "done" || !t.dueDate) return false;
      return isTaskDueTodayOrTomorrow(t.dueDate, reference);
    })
    .map((t) => ({ task: t, workspaceId, workspaceName }));
}

export function buildGlobalUpcomingFocus(
  workspaces: Array<{ id: string; name: string }>,
  tasksForWorkspace: (workspaceId: string) => Task[],
  limit = 12,
  reference: Date = startOfLocalToday(),
): HomeFocusItem[] {
  const all: HomeFocusItem[] = [];
  for (const ws of workspaces) {
    all.push(
      ...pickUpcomingTasksFromWorkspace(
        tasksForWorkspace(ws.id),
        ws.id,
        ws.name,
        reference,
      ),
    );
  }
  return sortUpcomingFocusItems(all).slice(0, limit);
}

/** Bucket for home due-window ordering: overdue → today → tomorrow */
function dueAttentionSortBucket(
  task: Task,
  reference: Date = startOfLocalToday(),
): number {
  if (!task.dueDate) return 9;
  if (isDueDatePast(task.dueDate, reference)) return 0;
  if (isDueDateToday(task.dueDate, reference)) return 1;
  if (isDueDateTomorrow(task.dueDate, reference)) return 2;
  return 9;
}

export function sortOpenTaskFocusItems(
  items: HomeFocusItem[],
  reference: Date = startOfLocalToday(),
): HomeFocusItem[] {
  return [...items].sort((a, b) => {
    const aBucket = dueAttentionSortBucket(a.task, reference);
    const bBucket = dueAttentionSortBucket(b.task, reference);
    if (aBucket !== bBucket) return aBucket - bBucket;

    const aPri = PRIORITY_RANK[a.task.priority] ?? 9;
    const bPri = PRIORITY_RANK[b.task.priority] ?? 9;
    if (aPri !== bPri) return aPri - bPri;

    const aDue = parseLocalDate(a.task.dueDate || "")?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDue = parseLocalDate(b.task.dueDate || "")?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;

    return a.task.title.localeCompare(b.task.title);
  });
}

export function pickDueAttentionTasksFromWorkspace(
  tasks: Task[],
  workspaceId: string,
  workspaceName: string,
  reference: Date = startOfLocalToday(),
): HomeFocusItem[] {
  return tasks
    .filter((t) => {
      if (t.status === "done" || !t.dueDate) return false;
      return isTaskOverdueTodayOrTomorrow(t.dueDate, reference);
    })
    .map((t) => ({ task: t, workspaceId, workspaceName }));
}

/** @deprecated Use pickDueAttentionTasksFromWorkspace */
export const pickOpenTasksFromWorkspace = pickDueAttentionTasksFromWorkspace;

export function buildGlobalOpenTaskFocus(
  workspaces: Array<{ id: string; name: string }>,
  tasksForWorkspace: (workspaceId: string) => Task[],
  limit = 16,
  reference: Date = startOfLocalToday(),
): HomeFocusItem[] {
  const all: HomeFocusItem[] = [];
  for (const ws of workspaces) {
    all.push(
      ...pickDueAttentionTasksFromWorkspace(
        tasksForWorkspace(ws.id),
        ws.id,
        ws.name,
        reference,
      ),
    );
  }
  return sortOpenTaskFocusItems(all, reference).slice(0, limit);
}