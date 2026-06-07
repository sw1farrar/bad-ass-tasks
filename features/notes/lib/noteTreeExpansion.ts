import type { Note } from "@/types";

const STORAGE_KEY = "badazz-expanded-notes";

export function persistExpandedNotes(expanded: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expanded)));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Expand every ancestor so `noteId` is visible in the tree (path only). */
export function ensureAncestryExpanded(
  noteId: string,
  allNotes: Note[],
  target: Set<string>,
): void {
  let cur: string | null =
    allNotes.find((n) => n.id === noteId)?.parentNoteId ?? null;
  const seen = new Set<string>();

  while (cur) {
    if (seen.has(cur)) break;
    seen.add(cur);
    target.add(cur);
    cur = allNotes.find((n) => n.id === cur)?.parentNoteId ?? null;
  }
}

/**
 * Mobile accordion-behind-drawer: reveal ancestor path plus one level of branch
 * context (parent's direct children via ancestry, and opened note's own children).
 */
export function ensureMobileTreeContext(
  noteId: string,
  allNotes: Note[],
  target: Set<string>,
): void {
  ensureAncestryExpanded(noteId, allNotes, target);

  const hasDirectChildren = allNotes.some((n) => n.parentNoteId === noteId);
  if (hasDirectChildren) {
    target.add(noteId);
  }
}

export function loadExpandedNotesFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}