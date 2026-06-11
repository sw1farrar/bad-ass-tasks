import type { Note } from "@/types";
import { isPendingReview } from "@/lib/files/fileFilters";
import { noteListSearchHaystack } from "@/lib/files/noteListProjection";
import type { FilesSearchScope } from "@/lib/files/searchFilesInWorkspace";

export type FilesSearchIndexEntry = {
  id: string;
  titleLower: string;
  tagsLower: string[];
  memoLower: string;
  haystack: string;
  updatedAtMs: number;
  pendingReview: boolean;
};

export function tokenizeFilesSearchQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/** Precompute list metadata once per notes snapshot for fast repeated queries. */
export function buildFilesSearchIndex(notes: Note[]): FilesSearchIndexEntry[] {
  return notes.map((note) => ({
    id: note.id,
    titleLower: (note.title ?? "").toLowerCase(),
    tagsLower: (note.tags ?? []).map((tag) => tag.toLowerCase()),
    memoLower: (note.memo ?? "").toLowerCase(),
    haystack: noteListSearchHaystack(note),
    updatedAtMs: new Date(note.updatedAt || note.createdAt).getTime(),
    pendingReview: isPendingReview(note),
  }));
}

export function scoreFilesSearchEntry(entry: FilesSearchIndexEntry, tokens: string[]): number {
  if (tokens.length === 0) return -1;

  // Single-character queries: fast title/tag prefix only (avoids noisy haystack hits).
  if (tokens.length === 1 && tokens[0].length === 1) {
    const token = tokens[0];
    if (entry.titleLower.startsWith(token)) {
      return 100 + (entry.pendingReview ? 8 : 0) + entry.updatedAtMs / 1e15;
    }
    if (entry.tagsLower.some((tag) => tag.startsWith(token))) {
      return 60 + (entry.pendingReview ? 8 : 0) + entry.updatedAtMs / 1e15;
    }
    return -1;
  }

  let score = 0;
  for (const token of tokens) {
    let tokenScore = 0;
    if (entry.titleLower.startsWith(token)) {
      tokenScore = 120;
    } else if (entry.titleLower.includes(token)) {
      tokenScore = 80;
    } else if (entry.tagsLower.some((tag) => tag === token || tag.startsWith(token))) {
      tokenScore = 60;
    } else if (entry.memoLower.includes(token)) {
      tokenScore = 40;
    } else if (entry.haystack.includes(token)) {
      tokenScore = 20;
    } else {
      return -1;
    }
    score += tokenScore;
  }

  if (entry.pendingReview) score += 8;
  // Tiny recency tiebreaker without overpowering relevance.
  score += entry.updatedAtMs / 1e15;
  return score;
}

export function rankFilesSearchIds(
  index: FilesSearchIndexEntry[],
  query: string,
  options?: { scope?: FilesSearchScope; limit?: number },
): string[] {
  const tokens = tokenizeFilesSearchQuery(query);
  if (tokens.length === 0) return [];

  const scope = options?.scope ?? "all";
  const limit = options?.limit ?? 100;
  const scored: Array<{ id: string; score: number }> = [];

  for (const entry of index) {
    if (scope === "review" && !entry.pendingReview) continue;
    if (scope === "filed" && entry.pendingReview) continue;

    const score = scoreFilesSearchEntry(entry, tokens);
    if (score >= 0) scored.push({ id: entry.id, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((row) => row.id);
}

/** Local hits first (ranked), then any extra server hits — no duplicates. */
export function mergeFilesSearchResultIds(localIds: string[], remoteIds: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const id of localIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }

  for (const id of remoteIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }

  return merged;
}