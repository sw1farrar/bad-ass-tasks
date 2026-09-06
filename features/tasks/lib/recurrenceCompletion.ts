import type { Task } from "@/types";

/** Historical copy of one completed occurrence. The live series keeps the original id. */
export function buildCompletedOccurrenceSnapshot(
  source: Task,
  completedAt: string,
  newId: string,
): Task {
  return {
    id: newId,
    title: source.title,
    description: source.description,
    status: "done",
    priority: source.priority,
    dueDate: source.dueDate,
    assignee: source.assignee,
    assigneeIds: source.assigneeIds ? [...source.assigneeIds] : [],
    tags: [...(source.tags || [])],
    createdAt: source.createdAt,
    completedAt,
    timeEstimate: source.timeEstimate,
    linkedNoteIds: [],
    workspaceId: source.workspaceId,
    recurringRule: null,
    exceptionDates: undefined,
    parentTaskId: source.id,
    starred: source.starred,
    folderId: source.folderId ?? null,
  };
}

export function latestCompletedOccurrenceId(tasks: Task[], seriesId: string): string | null {
  let bestId: string | null = null;
  let bestMs = -Infinity;
  for (const task of tasks) {
    if (task.parentTaskId !== seriesId || task.status !== "done") continue;
    const ms = task.completedAt ? new Date(task.completedAt).getTime() : 0;
    if (ms >= bestMs) {
      bestMs = ms;
      bestId = task.id;
    }
  }
  return bestId;
}
