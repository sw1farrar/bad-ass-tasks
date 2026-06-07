/**
 * Local timezone date/time utilities.
 *
 * Calendar dates (due dates, recurrence) are always interpreted in the user's
 * local timezone. Timestamps (created_at, comments, chat) are stored as ISO
 * instants and displayed via the browser's local timezone.
 */
import { addDays, format, isToday, isTomorrow, isPast, startOfDay } from "date-fns";

/** Parse YYYY-MM-DD or stored due-date ISO as a local calendar date (midnight local). */
export function parseLocalDate(input?: string | null): Date | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) {
    const [y, m, d] = isoPrefix[1].split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/** Format a Date as YYYY-MM-DD in the user's local timezone. */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Store a calendar due date at local midnight as ISO (stable round-trip with parseLocalDate). */
export function toDueDateStorage(date: Date): string {
  const local = startOfDay(date);
  return new Date(local.getFullYear(), local.getMonth(), local.getDate()).toISOString();
}

/** Start of today in the user's local timezone. */
export function startOfLocalToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Stable YYYY-MM-DD key for calendar-date comparison (exceptions, recurrence). */
export function normalizeCalendarDateKey(d: Date | string): string {
  if (typeof d === "string") {
    const parsed = parseLocalDate(d);
    if (parsed) return toLocalDateString(parsed);
  }
  return toLocalDateString(new Date(d));
}

export function isDueDatePast(dueDateIso: string, reference: Date = startOfLocalToday()): boolean {
  const due = parseLocalDate(dueDateIso);
  if (!due) return false;
  return due.getTime() < reference.getTime();
}

export function isDueDateToday(dueDateIso: string, reference: Date = startOfLocalToday()): boolean {
  const due = parseLocalDate(dueDateIso);
  if (!due) return false;
  return due.getTime() === reference.getTime();
}

export function isDueDateOnOrBefore(dueDateIso: string, reference: Date = startOfLocalToday()): boolean {
  const due = parseLocalDate(dueDateIso);
  if (!due) return false;
  return due.getTime() <= reference.getTime();
}

/** Display a stored instant in the user's local timezone. */
export function formatLocalTimestamp(
  iso: string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, options);
}

/** Display time only (e.g. chat messages) in local timezone. */
export function formatLocalTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Display a calendar due date as a short label (MMM d). */
export function formatLocalDateShort(input: string): string {
  const d = parseLocalDate(input);
  if (!d) return "";
  return format(d, "MMM d");
}

/** Parse YYYY-MM-DD user input into stored due-date ISO. */
export function dueDateFromUserInput(yyyyMmDd: string): string | null {
  const trimmed = yyyyMmDd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = parseLocalDate(trimmed);
  if (!parsed) return null;
  return toDueDateStorage(parsed);
}