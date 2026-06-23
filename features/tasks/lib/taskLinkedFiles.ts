import type { Note, Task } from "@/types";

/** Notes/files linked to a task via bidirectional task ↔ note linking. */
export function getTaskLinkedFileNotes(task: Task, notes: Note[]): Note[] {
  const byId = new Map(notes.map((n) => [n.id, n]));
  return (task.linkedNoteIds ?? [])
    .map((id) => byId.get(id))
    .filter((n): n is Note => !!n);
}

export function taskHasLinkedFiles(task: Task): boolean {
  return (task.linkedNoteIds?.length ?? 0) > 0;
}