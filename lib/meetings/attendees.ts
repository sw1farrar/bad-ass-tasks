import type { Meeting } from "@/types";

/** Trim, collapse whitespace, and de-dupe (case-insensitive) attendee names. */
export function normalizeAttendeeNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Unique attendee names seen across meetings, newest meetings first. */
export function collectKnownAttendeeNames(meetings: Meeting[]): string[] {
  const ordered = [...meetings].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  return normalizeAttendeeNames(ordered.flatMap((m) => m.attendees ?? []));
}
