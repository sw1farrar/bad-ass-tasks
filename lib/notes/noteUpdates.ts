import type { Note } from "@/types";

const NOTE_UPDATE_IGNORE_KEYS = new Set<keyof Note>(["workspaceId", "bodyHydrated"]);

/** True when TipTap content is empty / blank paragraph (including "" and missing). */
export function isEmptyNoteContent(content: string | undefined | null): boolean {
  const trimmed = (content ?? "").trim();
  if (!trimmed) return true;
  if (!trimmed.startsWith("{")) return false;
  try {
    const doc = JSON.parse(trimmed) as { type?: string; content?: unknown[] };
    if (doc?.type !== "doc") return false;
    const nodes = doc.content;
    if (!nodes || nodes.length === 0) return true;
    if (nodes.length !== 1) return false;
    const only = nodes[0] as { type?: string; content?: unknown[] };
    if (only?.type !== "paragraph") return false;
    return !only.content || only.content.length === 0;
  } catch {
    return false;
  }
}

/** True when two content strings represent the same persisted body (incl. empty equivalents). */
export function noteContentEquivalent(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  if (a === b) return true;
  return isEmptyNoteContent(a) && isEmptyNoteContent(b);
}

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
    if (key === "content") {
      if (!noteContentEquivalent(existing.content, value as string)) return false;
      continue;
    }
    if (existing[key] !== value) return false;
  }

  return hasField;
}