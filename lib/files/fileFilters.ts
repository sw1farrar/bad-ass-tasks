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

export function filterByTags(notes: Note[], selectedTags: string[]): Note[] {
  if (selectedTags.length === 0) return notes;
  return notes.filter((n) => selectedTags.some((t) => n.tags.includes(t)));
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