/** Flush a debounced note field save for a specific note id (safe across note switches). */
export function flushPendingNoteFieldSave(
  timerRef: { current: ReturnType<typeof setTimeout> | null },
  pendingRef: { current: { noteId: string; value: string } | null },
  save: (noteId: string, value: string) => void,
): void {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
  const pending = pendingRef.current;
  if (pending) {
    save(pending.noteId, pending.value);
    pendingRef.current = null;
  }
}

export function schedulePendingNoteFieldSave(
  noteId: string,
  value: string,
  timerRef: { current: ReturnType<typeof setTimeout> | null },
  pendingRef: { current: { noteId: string; value: string } | null },
  save: (noteId: string, value: string) => void,
  delayMs: number,
): void {
  if (timerRef.current) clearTimeout(timerRef.current);
  pendingRef.current = { noteId, value };
  timerRef.current = setTimeout(() => {
    const pending = pendingRef.current;
    if (pending) {
      save(pending.noteId, pending.value);
      pendingRef.current = null;
    }
    timerRef.current = null;
  }, delayMs);
}