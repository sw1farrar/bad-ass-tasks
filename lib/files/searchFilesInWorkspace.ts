import type { Note } from "@/types";
import { isFiledNote, isPendingReview } from "./fileFilters";
import { searchNotesLocal } from "./searchNotesLocal";

export type FilesSearchScope = "review" | "filed" | "all";

export function searchFilesInWorkspace(
  notes: Note[],
  query: string,
  options?: { scope?: FilesSearchScope; limit?: number },
): Note[] {
  const scope = options?.scope ?? "all";
  const limit = options?.limit ?? 100;
  const hits = searchNotesLocal(notes, query, limit);

  if (scope === "review") {
    return hits.filter(isPendingReview);
  }
  if (scope === "filed") {
    return hits.filter(isFiledNote);
  }
  return hits;
}