import type { Note } from "@/types";
import { buildFilesSearchIndex, rankFilesSearchIds } from "@/lib/files/filesSearchRank";

export type FilesSearchScope = "review" | "filed" | "all";

export function searchFilesInWorkspace(
  notes: Note[],
  query: string,
  options?: { scope?: FilesSearchScope; limit?: number },
): Note[] {
  const scope = options?.scope ?? "all";
  const limit = options?.limit ?? 100;
  const ids = rankFilesSearchIds(buildFilesSearchIndex(notes), query, { scope, limit });
  if (ids.length === 0) return [];

  const byId = new Map(notes.map((note) => [note.id, note]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as Note[];
}