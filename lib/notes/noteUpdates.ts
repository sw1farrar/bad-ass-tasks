import type { Note } from "@/types";

const NOTE_UPDATE_IGNORE_KEYS = new Set<keyof Note>(["workspaceId", "bodyHydrated"]);

/** True when updates would not change any persisted note field (skip updatedAt bump + store write). */
export function noteUpdatesAreNoOp(
  existing: Note | undefined,
  updates: Partial<Note>,
): boolean {
  if (!existing) return false;

  let hasField = false;
  for (const [key, value] of Object.entries(updates) as [keyof Note, Note[keyof Note]][]) {
    if (value === undefined) continue;
    hasField = true;
    if (NOTE_UPDATE_IGNORE_KEYS.has(key)) continue;
    if (existing[key] !== value) return false;
  }

  return hasField;
}