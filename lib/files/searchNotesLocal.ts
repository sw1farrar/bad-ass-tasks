import type { Note } from "@/types";
import { isPendingReview } from "./fileFilters";

function noteSearchHaystack(note: Note): string {
  return [note.title, note.searchPlain, note.searchDocument, note.memo, ...(note.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function searchNotesLocal(notes: Note[], query: string, limit = 12): Note[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  return notes
    .filter((note) => noteSearchHaystack(note).includes(q))
    .sort((a, b) => {
      const aReview = isPendingReview(a) ? 1 : 0;
      const bReview = isPendingReview(b) ? 1 : 0;
      if (aReview !== bReview) return bReview - aReview;
      return (
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
      );
    })
    .slice(0, limit);
}