import type { Note, Task } from "@/types";

type WorkspaceSlice = {
  tasks: Task[];
  notes: Note[];
  currentWorkspace: { id: string };
};

/** Comments table has no workspace_id — scope via linked task/note in the active workspace. */
export function commentBelongsToWorkspace(
  state: WorkspaceSlice,
  row: { task_id?: string | null; note_id?: string | null } | null | undefined,
): boolean {
  if (!row) return false;
  const wsId = state.currentWorkspace.id;
  if (row.task_id) {
    return state.tasks.some((t) => t.id === row.task_id && t.workspaceId === wsId);
  }
  if (row.note_id) {
    return state.notes.some((n) => n.id === row.note_id && n.workspaceId === wsId);
  }
  return false;
}