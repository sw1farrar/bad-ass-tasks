import type { Note } from "@/types";
import { buildFilesSearchIndex, rankFilesSearchIds } from "@/lib/files/filesSearchRank";

export function searchNotesLocal(notes: Note[], query: string, limit = 12): Note[] {
  const ids = rankFilesSearchIds(buildFilesSearchIndex(notes), query, { scope: "all", limit });
  if (ids.length === 0) return [];

  const byId = new Map(notes.map((note) => [note.id, note]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as Note[];
}