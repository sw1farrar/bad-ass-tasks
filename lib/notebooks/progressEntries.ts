/** Progress / timestamped notes: most recent first. */
export function sortProgressEntriesNewestFirst<T extends { createdAt: string }>(
  entries: T[],
): T[] {
  return [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}