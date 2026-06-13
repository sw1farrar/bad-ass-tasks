/**
 * Local timezone date/time utilities.
 *
 * Calendar dates (due dates, recurrence) are always interpreted in the user's
 * local timezone. Timestamps (created_at, comments, chat) are stored as ISO
 * instants and displayed via the browser's local timezone.
 */
import {
  addDays,
  format,
  formatDistanceToNow,
  isToday,
  isTomorrow,
  isPast,
  isValid,
  startOfDay,
} from "date-fns";

function toValidLocalDate(y: number, m: number, d: number): Date | undefined {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined;
  const date = new Date(y, m - 1, d);
  return isValid(date) ? date : undefined;
}

/** Parse YYYY-MM-DD or stored due-date ISO as a local calendar date (midnight local). */
export function parseLocalDate(input?: string | null): Date | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    return toValidLocalDate(y, m, d);
  }
  const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) {
    const [y, m, d] = isoPrefix[1].split("-").map(Number);
    return toValidLocalDate(y, m, d);
  }
  const parsed = new Date(trimmed);
  if (!isValid(parsed)) return undefined;
  return toValidLocalDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

/** Safe date-fns format — never throws on invalid Date values. */
export function safeFormatDate(date: Date, pattern: string, fallback = ""): string {
  if (!isValid(date)) return fallback;
  return format(date, pattern);
}

/** Format a stored ISO timestamp — never throws on missing or invalid values. */
export function safeFormatTimestampIso(
  iso?: string | null,
  pattern = "MMM d, yyyy",
  fallback = "",
): string {
  if (!iso?.trim()) return fallback;
  const date = new Date(iso);
  return safeFormatDate(date, pattern, fallback);
}

/** Relative time label for activity feeds, presence, etc. */
export function safeFormatDistanceToNow(
  input?: string | null,
  fallback = "Recently",
): string {
  if (!input?.trim()) return fallback;
  const date = new Date(input);
  if (!isValid(date)) return fallback;
  return formatDistanceToNow(date, { addSuffix: true });
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
  return safeFormatDate(d, "MMM d");
}

/** Default due date for newly created tasks (local today, stored ISO). */
export function defaultTaskDueDate(reference: Date = startOfLocalToday()): string {
  return toDueDateStorage(reference);
}

/** Default due date for DateTimePicker value props (YYYY-MM-DD). */
export function defaultTaskDueDateInput(reference: Date = startOfLocalToday()): string {
  return toLocalDateString(reference);
}

/** Parse YYYY-MM-DD user input into stored due-date ISO. */
export function dueDateFromUserInput(yyyyMmDd: string): string | null {
  const trimmed = yyyyMmDd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = parseLocalDate(trimmed);
  if (!parsed) return null;
  return toDueDateStorage(parsed);
}