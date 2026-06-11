import type { Note } from "@/types";
import { FILE_REVIEW_FILED, FILE_REVIEW_PENDING, type FileReviewStatus } from "./fileTypes";

export function getNoteReviewStatus(note: Note): FileReviewStatus {
  return note.reviewStatus ?? FILE_REVIEW_FILED;
}

export function isPendingReview(note: Note): boolean {
  return getNoteReviewStatus(note) === FILE_REVIEW_PENDING;
}

export function isFiledNote(note: Note): boolean {
  return getNoteReviewStatus(note) === FILE_REVIEW_FILED;
}

export function filterPendingReview(notes: Note[]): Note[] {
  return notes.filter(isPendingReview);
}

export function filterFiledNotes(notes: Note[]): Note[] {
  return notes.filter(isFiledNote);
}

/** Match if the note has any of the selected tags. */
export function filterByTags(notes: Note[], selectedTags: string[]): Note[] {
  if (selectedTags.length === 0) return notes;
  return notes.filter((n) => selectedTags.some((t) => (n.tags ?? []).includes(t)));
}

/** Match only if the note has every selected tag (multi-drawer AND). */
export function filterByAllTags(notes: Note[], selectedTags: string[]): Note[] {
  if (selectedTags.length === 0) return notes;
  return notes.filter((n) => selectedTags.every((t) => (n.tags ?? []).includes(t)));
}

export function countPendingReviewForWorkspace(notes: Note[], workspaceId: string): number {
  return filterPendingReview(notes.filter((n) => n.workspaceId === workspaceId)).length;
}

/** True when at least one user-facing tag is present (excludes system tag from-email). */
export function hasUserFilingTags(tags: string[]): boolean {
  return tags.some((t) => {
    const n = t.trim().toLowerCase();
    return n.length > 0 && n !== "from-email";
  });
}

export function collectWorkspaceTags(notes: Note[]): string[] {
  const set = new Set<string>();
  for (const n of notes) {
    for (const t of n.tags ?? []) {
      const trimmed = t.trim();
      if (trimmed && trimmed !== "from-email") set.add(trimmed);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function sortFiledNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const aTs = new Date(a.filedAt ?? a.updatedAt).getTime();
    const bTs = new Date(b.filedAt ?? b.updatedAt).getTime();
    return bTs - aTs;
  });
}