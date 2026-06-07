export type NoteParentRef = {
  id: string;
  parentNoteId?: string | null;
};

/** Walk parent chain; root note = depth 0, child = 1, grandchild = 2. */
export function getNoteDepth(
  noteId: string | null | undefined,
  notes: NoteParentRef[],
): number {
  if (!noteId) return 0;

  const byId = new Map(notes.map((n) => [n.id, n.parentNoteId ?? null]));
  let depth = 0;
  let cur: string | null = noteId;
  const seen = new Set<string>();

  while (cur) {
    if (seen.has(cur)) return 99;
    seen.add(cur);
    const parent = byId.get(cur);
    if (!parent) break;
    depth += 1;
    cur = parent;
    if (depth > 10) break;
  }

  return depth;
}

/** Inbox parent notes must be depth 0 (root) or 1 (child) — not grandchildren. */
export function isEligibleEmailInboxParent(depth: number): boolean {
  return depth >= 0 && depth <= 1;
}