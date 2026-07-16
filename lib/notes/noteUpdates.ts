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

/** Stable canonicalize for TipTap JSON so key-order / null attrs don't look like edits. */
function canonicalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJsonValue);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const next = obj[key];
      if (next === null || next === undefined) continue;
      if (key === "attrs" && typeof next === "object" && !Array.isArray(next)) {
        const attrs: Record<string, unknown> = {};
        for (const attrKey of Object.keys(next as Record<string, unknown>).sort()) {
          const attrVal = (next as Record<string, unknown>)[attrKey];
          if (attrVal === null || attrVal === undefined) continue;
          attrs[attrKey] = canonicalizeJsonValue(attrVal);
        }
        if (Object.keys(attrs).length > 0) out.attrs = attrs;
        continue;
      }
      out[key] = canonicalizeJsonValue(next);
    }
    return out;
  }
  return value;
}

function tryParseJson(content: string): unknown | undefined {
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

/** True when two content strings represent the same persisted body (incl. empty equivalents). */
export function noteContentEquivalent(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  if (a === b) return true;
  if (isEmptyNoteContent(a) && isEmptyNoteContent(b)) return true;

  const aTrim = (a ?? "").trim();
  const bTrim = (b ?? "").trim();
  if (!aTrim || !bTrim) return false;
  if (!aTrim.startsWith("{") || !bTrim.startsWith("{")) return false;

  const aJson = tryParseJson(aTrim);
  const bJson = tryParseJson(bTrim);
  if (aJson === undefined || bJson === undefined) return false;

  return (
    JSON.stringify(canonicalizeJsonValue(aJson)) ===
    JSON.stringify(canonicalizeJsonValue(bJson))
  );
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
