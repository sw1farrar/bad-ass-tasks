import type { Note } from "@/types";

export function computeWorkspaceNoteCount(notes: Note[], workspaceId: string): number {
  return notes.filter((n) => n.workspaceId === workspaceId).length;
}