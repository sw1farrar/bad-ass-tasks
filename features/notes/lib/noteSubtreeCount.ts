export type NoteParentRef = {
  id: string;
  parentNoteId?: string | null;
};

/** Total notes in this note's subtree, including the note itself. */
export function buildNoteSubtreeCounts(notes: NoteParentRef[]): Map<string, number> {
  const childrenMap = new Map<string, NoteParentRef[]>();

  for (const note of notes) {
    const parentId = note.parentNoteId ?? null;
    if (!parentId) continue;
    const siblings = childrenMap.get(parentId);
    if (siblings) {
      siblings.push(note);
    } else {
      childrenMap.set(parentId, [note]);
    }
  }

  const counts = new Map<string, number>();
  const visiting = new Set<string>();

  const countSubtree = (noteId: string): number => {
    const cached = counts.get(noteId);
    if (cached !== undefined) return cached;
    if (visiting.has(noteId)) return 1;

    visiting.add(noteId);
    const children = childrenMap.get(noteId) ?? [];
    let total = 1;
    for (const child of children) {
      total += countSubtree(child.id);
    }
    visiting.delete(noteId);

    counts.set(noteId, total);
    return total;
  };

  for (const note of notes) {
    countSubtree(note.id);
  }

  return counts;
}

export function getNoteSubtreeCount(
  noteId: string,
  notes: NoteParentRef[],
  precomputed?: Map<string, number>,
): number {
  return precomputed?.get(noteId) ?? buildNoteSubtreeCounts(notes).get(noteId) ?? 1;
}