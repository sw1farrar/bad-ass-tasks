import type { Note } from "@/types";
import { searchNotesLocal } from "@/lib/files/searchNotesLocal";

/** Notes that belong to the Files workflow (not workspace notebooks). */
export function isFileNote(note: Note): boolean {
  return !note.notebookId;
}

export function filterFileNotes(notes: Note[]): Note[] {
  return notes.filter(isFileNote);
}

export function filterNotebookNotes(notes: Note[], notebookId: string): Note[] {
  return notes.filter((n) => n.notebookId === notebookId);
}

export function sortNotebookNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const aTs = new Date(a.updatedAt).getTime();
    const bTs = new Date(b.updatedAt).getTime();
    return bTs - aTs;
  });
}

export function filterNotebooksBySearch<T extends { name: string }>(
  notebooks: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return notebooks;
  return notebooks.filter((nb) => nb.name.toLowerCase().includes(q));
}

/** Search notebook notes by title, tags, memo, and body text. */
export function filterNotebookNotesBySearch(notes: Note[], query: string): Note[] {
  const q = query.trim();
  if (!q) return sortNotebookNotes(notes);
  return searchNotesLocal(notes, q, 200);
}