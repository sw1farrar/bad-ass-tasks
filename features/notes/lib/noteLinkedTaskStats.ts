import type { Note, Task } from "@/types";
import { isDueDatePast } from "@/lib/datetime";

export interface NoteLinkedTaskStats {
  total: number;
  open: number;
  overdue: number;
  hasOpen: boolean;
  hasOverdue: boolean;
}

const EMPTY: NoteLinkedTaskStats = {
  total: 0,
  open: 0,
  overdue: 0,
  hasOpen: false,
  hasOverdue: false,
};

function resolveTask(
  id: string,
  tasks: Task[] | Map<string, Task>,
): Task | undefined {
  if (tasks instanceof Map) return tasks.get(id);
  return tasks.find((t) => t.id === id);
}

/** Resolve linked-task counts for a note (open + overdue among non-done links). */
export function getNoteLinkedTaskStats(
  note: Note,
  tasks: Task[] | Map<string, Task>,
): NoteLinkedTaskStats {
  const linkedIds = note.linkedTaskIds || [];
  if (linkedIds.length === 0) return EMPTY;

  let open = 0;
  let overdue = 0;

  for (const id of linkedIds) {
    const task = resolveTask(id, tasks);
    if (!task || task.status === "done") continue;
    open += 1;
    if (task.dueDate && isDueDatePast(task.dueDate)) {
      overdue += 1;
    }
  }

  return {
    total: linkedIds.length,
    open,
    overdue,
    hasOpen: open > 0,
    hasOverdue: overdue > 0,
  };
}

/** Sort notes for the open-tasks filter: overdue first, then most recently updated. */
export function sortNotesByOpenTaskUrgency(notes: Note[], tasks: Task[]): Note[] {
  return [...notes].sort((a, b) => {
    const statsA = getNoteLinkedTaskStats(a, tasks);
    const statsB = getNoteLinkedTaskStats(b, tasks);
    if (statsA.hasOverdue !== statsB.hasOverdue) {
      return statsA.hasOverdue ? -1 : 1;
    }
    if (statsA.overdue !== statsB.overdue) {
      return statsB.overdue - statsA.overdue;
    }
    const timeA = new Date(a.updatedAt || a.createdAt).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt).getTime();
    return timeB - timeA;
  });
}