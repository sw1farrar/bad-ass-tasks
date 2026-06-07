import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isTomorrow, isPast, addDays, addWeeks, addMonths, addYears, startOfDay, getDay, differenceInCalendarWeeks } from "date-fns";
import {
  parseLocalDate,
  toDueDateStorage,
  toLocalDateString,
  normalizeCalendarDateKey,
  startOfLocalToday,
} from "@/lib/datetime";

export {
  parseLocalDate,
  toDueDateStorage,
  normalizeCalendarDateKey,
  normalizeCalendarDateKey as normalizeExceptionKey,
  startOfLocalToday,
  toLocalDateString,
  formatLocalTimestamp,
  formatLocalTime,
  formatLocalDateShort,
  isDueDatePast,
  isDueDateToday,
  isDueDateOnOrBefore,
  dueDateFromUserInput,
} from "@/lib/datetime";

// Canonical types (single source of truth). Old duplicate local copies removed during QA/types cleanup.
import type { Task, Note, Priority, TaskStatus, WorkspaceMember, ActivityLog } from "@/types";
export type { Priority, TaskStatus }; // re-export for any legacy direct consumers

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Natural language task parser (demo quality — makes the app feel magical; types from @/types)
export function parseNaturalLanguage(input: string): Partial<Task> {
  const result: Partial<Task> = {
    title: input.trim(),
    priority: "P2",
    tags: [],
  };

  const lower = input.toLowerCase();

  // Priority detection
  if (lower.includes("p0") || lower.includes("urgent") || lower.includes("asap")) {
    result.priority = "P0";
  } else if (lower.includes("p1") || lower.includes("high")) {
    result.priority = "P1";
  } else if (lower.includes("p3") || lower.includes("low")) {
    result.priority = "P3";
  }

  // Date parsing (very simple but delightful)
  const tomorrowMatch = lower.match(/tomorrow|tmr/);
  const fridayMatch = lower.match(/friday|fri/);
  const nextWeekMatch = lower.match(/next week/);
  const todayMatch = lower.match(/\btoday\b/);

  const now = new Date();

  const today = startOfLocalToday();
  if (tomorrowMatch) {
    result.dueDate = toDueDateStorage(addDays(today, 1));
  } else if (fridayMatch) {
    const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
    result.dueDate = toDueDateStorage(addDays(today, daysUntilFriday));
  } else if (nextWeekMatch) {
    result.dueDate = toDueDateStorage(addDays(today, 7));
  } else if (todayMatch) {
    result.dueDate = toDueDateStorage(today);
  }

  // Tag extraction (@Sarah, @team, etc)
  const tagMatches = input.match(/@[\w]+/g);
  if (tagMatches) {
    result.tags = tagMatches.map((t) => t.slice(1));
    // Remove tags from title for cleanliness
    result.title = (result.title || input.trim()).replace(/@[\w]+/g, "").trim();
  }

  // Remove priority tokens from title
  result.title = (result.title || input.trim())
    .replace(/\bp[0-3]\b/gi, "")
    .replace(/\b(urgent|asap|high|low)\b/gi, "")
    .trim();

  return result;
}

export function formatDueDate(dateString?: string) {
  if (!dateString) return null;
  const date = parseLocalDate(dateString);
  if (!date) return null;
  if (isToday(date)) return { label: "Today", variant: "today" as const };
  if (isTomorrow(date)) return { label: "Tomorrow", variant: "soon" as const };
  if (isPast(date)) return { label: format(date, "MMM d"), variant: "overdue" as const };
  return { label: format(date, "MMM d"), variant: "default" as const };
}

/** First token of a display name, with sensible fallbacks for greetings. */
export function getUserFirstName(options: {
  profileFullName?: string | null;
  memberFullName?: string | null;
  authFullName?: string | null;
  username?: string | null;
  email?: string | null;
}): string {
  const full =
    options.profileFullName?.trim() ||
    options.memberFullName?.trim() ||
    options.authFullName?.trim();
  if (full) return full.split(/\s+/)[0];
  if (options.username?.trim()) return options.username.trim();
  if (options.email?.includes("@")) return options.email.split("@")[0];
  return "";
}

/** Greeting-specific resolver — prefers real names and never falls back to @username. */
export function getUserGreetingName(options: {
  profileFullName?: string | null;
  memberFullName?: string | null;
  authFullName?: string | null;
  email?: string | null;
}): string {
  const full =
    options.profileFullName?.trim() ||
    options.memberFullName?.trim() ||
    options.authFullName?.trim();
  if (full) return full.split(/\s+/)[0];
  if (options.email?.includes("@")) return options.email.split("@")[0];
  return "";
}

export function getPriorityColor(priority: Priority) {
  switch (priority) {
    case "P0": return "var(--priority-p0)";
    case "P1": return "var(--priority-p1)";
    case "P2": return "#facc15";
    case "P3": return "var(--neon-green)";
  }
}

export function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

/* =====================================================================
   World-class Recurring Task Engine (Phase 4 — Agent 8 + Agent 13 exceptions + Agent 25 Production)
   Proper RRULE-ish parsing + instance generation using date-fns (no heavy deps, no rrule.js).
   Supports DAILY / WEEKLY (w/ BYDAY) / MONTHLY / YEARLY + INTERVAL + UNTIL/COUNT end conditions.
   Full exception (skip) support, bounded generation for perf, concrete instance descriptors.
   - parse / generate roundtrips (incl. COUNT)
   - getOccurrencesInRange / generateRecurringInstances for calendar + views (virtual, no DB rows)
   - getNextRecurringDue for complete auto-advance
   - Rich labels + end descriptions
   Production quality: intelligent for Linear/Notion-like UX. Pure client = strict demo/live sep.
   Optimized: safety bounds, early exits on COUNT/UNTIL, suitable for 100s recurring tasks.
===================================================================== */

export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type WeekDay = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

export interface RecurrencePattern {
  freq: RecurrenceFreq;
  interval: number;           // >=1
  byDay?: WeekDay[];          // only meaningful for WEEKLY (and some monthly extensions)
  until?: string;             // optional series end (UNTIL); always normalized to 'YYYY-MM-DD'
  count?: number;             // optional: ends after N total occurrences (RRULE COUNT; mutually exclusive with until in strict RRULE)
}

export function parseRecurringRule(rule: string | null | undefined): RecurrencePattern | null {
  if (!rule || typeof rule !== "string") return null;
  const upper = rule.toUpperCase().trim();
  if (!upper) return null;

  const parts = upper.split(";").map((p) => p.trim());
  let freq: RecurrenceFreq = "WEEKLY";
  let interval = 1;
  let byDay: WeekDay[] = [];
  let until: string | undefined;
  let count: number | undefined;

  for (const part of parts) {
    if (part.startsWith("FREQ=")) {
      const f = part.slice(5) as RecurrenceFreq;
      if (["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(f)) freq = f;
    }
    if (part.startsWith("INTERVAL=")) {
      const n = parseInt(part.slice(9), 10);
      if (!isNaN(n) && n > 0) interval = n;
    }
    if (part.startsWith("BYDAY=")) {
      const days = part
        .slice(6)
        .split(",")
        .map((d) => d.trim() as WeekDay)
        .filter((d) => ["MO", "TU", "WE", "TH", "FR", "SA", "SU"].includes(d));
      if (days.length) byDay = days;
    }
    if (part.startsWith("UNTIL=")) {
      // Robust parse: YYYYMMDD, YYYY-MM-DD, full ISO -> normalize to YYYY-MM-DD
      const u = part.slice(6).trim().replace(/[-T: Z]/g, "").slice(0, 8);
      if (u.length === 8) {
        until = `${u.slice(0,4)}-${u.slice(4,6)}-${u.slice(6,8)}`;
      }
    }
    if (part.startsWith("COUNT=")) {
      const n = parseInt(part.slice(6), 10);
      if (!isNaN(n) && n > 0) count = n;
    }
  }

  const pat: RecurrencePattern = { freq, interval, byDay: byDay.length ? byDay : undefined };
  if (until) pat.until = until;
  if (count) pat.count = count;
  return pat;
}

export function generateRecurringRule(pattern: RecurrencePattern): string {
  let rule = `FREQ=${pattern.freq}`;
  if (pattern.interval > 1) rule += `;INTERVAL=${pattern.interval}`;
  if (pattern.byDay && pattern.byDay.length > 0) {
    rule += `;BYDAY=${pattern.byDay.join(",")}`;
  }
  // RRULE: UNTIL and COUNT are mutually exclusive; UI should present as alternative end conditions
  if (pattern.until) {
    const compact = pattern.until.replace(/-/g, "");
    rule += `;UNTIL=${compact}`;
  } else if (pattern.count && pattern.count > 0) {
    rule += `;COUNT=${pattern.count}`;
  }
  return rule;
}

export function getRecurringLabel(rule?: string | null): string {
  const p = parseRecurringRule(rule);
  if (!p) return "";
  const { freq, interval, byDay } = p;
  let base =
    freq === "DAILY" ? "Daily" :
    freq === "WEEKLY" ? "Weekly" :
    freq === "MONTHLY" ? "Monthly" : "Yearly";

  if (interval > 1) {
    const unit =
      freq === "DAILY" ? "days" :
      freq === "WEEKLY" ? "weeks" :
      freq === "MONTHLY" ? "months" : "years";
    base = `Every ${interval} ${unit}`;
  }
  if (byDay && byDay.length) {
    const pretty = byDay.map((d) => d === "MO" ? "Mon" : d === "TU" ? "Tue" : d === "WE" ? "Wed" : d === "TH" ? "Thu" : d === "FR" ? "Fri" : d === "SA" ? "Sat" : "Sun").join(", ");
    base += ` (${pretty})`;
  }
  if (p.until) {
    base += ` (until ${p.until})`;
  } else if (p.count) {
    base += ` (${p.count}×)`;
  }
  return base;
}



/** Returns true if the given date matches any exception date for the series. */
export function isOccurrenceException(date: Date | string, exceptionDates?: string[] | null): boolean {
  if (!exceptionDates || exceptionDates.length === 0) return false;
  const key = normalizeCalendarDateKey(date);
  return exceptionDates.some((ex) => normalizeCalendarDateKey(ex) === key);
}

/** Filter an array of occurrence dates against exceptions (used by calendar + next due). */
export function filterExceptions(dates: Date[], exceptionDates?: string[] | null): Date[] {
  if (!exceptionDates || exceptionDates.length === 0) return dates;
  return dates.filter((d) => !isOccurrenceException(d, exceptionDates));
}

/** Returns next due date (Date) strictly after `from`, or null when the series has ended.
 *  Anchor is the series seed (task dueDate). For completion, pass the current dueDate as `from`.
 *  Delegates to getOccurrencesInRange for COUNT, UNTIL, BYDAY, INTERVAL, and exception parity.
 */
export function getNextRecurringDue(
  rule: string | null,
  from: Date | string = new Date(),
  anchorDue?: string | Date,
  exceptionDates?: string[] | null
): Date | null {
  const pattern = parseRecurringRule(rule);
  if (!pattern) return null;

  const anchor =
    typeof anchorDue === "string"
      ? parseLocalDate(anchorDue)
      : anchorDue
        ? startOfDay(anchorDue)
        : typeof from === "string"
          ? parseLocalDate(from)
          : startOfDay(from);
  if (!anchor) return null;
  const anchorIso = typeof anchorDue === "string" ? anchorDue : toLocalDateString(anchor);
  const fromKey = normalizeCalendarDateKey(from);
  const fromDate = typeof from === "string" ? parseLocalDate(from) ?? anchor : from instanceof Date ? from : anchor;
  const rangeEnd = addYears(startOfDay(fromDate), 5);
  const maxOcc = pattern.count && pattern.count > 0 ? pattern.count + 2 : 120;
  const occ = getOccurrencesInRange(anchorIso, rule, anchor, rangeEnd, maxOcc, exceptionDates);
  return occ.find((d) => normalizeCalendarDateKey(d) > fromKey) ?? null;
}

/** Generate all (approximate) occurrence dates for a recurring task within [rangeStart, rangeEnd].
 *  Uses anchor dueDate as seed. Includes anchor if in range. Safe bounded generation.
 *  Perfect for calendar month/week rendering of "virtual" instances without DB rows.
 *  Production (Agent 25): full support for UNTIL + COUNT end conditions, exceptions, BYDAY.
 *  COUNT: treats anchor as occurrence #1; generates up to COUNT total (pre-exceptions).
 *  Performance: bounded loops + maxCount cap; safe for 100s of recurring tasks in views.
 */
export function getOccurrencesInRange(
  anchorDue: string | undefined | null,
  rule: string | null | undefined,
  rangeStart: Date,
  rangeEnd: Date,
  maxCount = 60,
  exceptionDates?: string[] | null
): Date[] {
  const pattern = parseRecurringRule(rule);
  if (!anchorDue || !pattern) return [];

  const anchor = parseLocalDate(anchorDue) ?? startOfDay(rangeStart);
  const rStart = startOfDay(rangeStart);
  const rEnd = startOfDay(rangeEnd);
  const occ: Date[] = [];

  const step = (d: Date): Date => {
    switch (pattern.freq) {
      case "DAILY": return addDays(d, pattern.interval);
      case "WEEKLY": return addWeeks(d, pattern.interval);
      case "MONTHLY": return addMonths(d, pattern.interval);
      case "YEARLY": return addYears(d, pattern.interval);
      default: return addDays(d, 1);
    }
  };

  const WEEKDAY_MAP: Record<WeekDay, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  // Start from anchor or earlier to catch past in view
  let current = new Date(anchor.getTime());
  if (current > rEnd) return []; // future anchor outside

  // If weekly BYDAY, normalize generation to hit the specified weekdays
  const isByDayWeekly = pattern.freq === "WEEKLY" && pattern.byDay && pattern.byDay.length > 0;
  const targetWeekdays = isByDayWeekly ? pattern.byDay!.map((d) => WEEKDAY_MAP[d]) : null;

  // Walk forward from a safe start point (anchor - generous lookback for monthly etc)
  const lookbackDays = pattern.freq === "YEARLY" ? 400 : pattern.freq === "MONTHLY" ? 120 : 30;
  current = addDays(current, -lookbackDays);

  // Safe until parser
  const getUntilDate = (): Date | null => {
    if (!pattern.until) return null;
    return parseLocalDate(pattern.until) ?? null;
  };
  const untilD = getUntilDate();

  // COUNT: anchor = occurrence 1. We count generated occurrences >= anchor date.
  const maxSeries = pattern.count && pattern.count > 0 ? pattern.count : Infinity;
  let seriesOccCounter = 0;

  let safety = 0;
  const maxSafety = maxCount * 3 + 100;
  while (safety < maxSafety && current <= addDays(rEnd, 2)) {
    safety++;
    let include = false;

    if (isByDayWeekly && targetWeekdays) {
      if (targetWeekdays.includes(getDay(current))) {
        const weekDiff = differenceInCalendarWeeks(current, anchor, { weekStartsOn: 0 });
        if (weekDiff >= 0 && weekDiff % pattern.interval === 0) {
          include = true;
        }
      }
    } else {
      // For non-BYDAY or other freqs, every stepped occurrence counts
      include = true;
    }

    if (include && current >= rStart && current <= rEnd) {
      if (current >= anchor) {
        seriesOccCounter++;
        if (seriesOccCounter > maxSeries) {
          break;
        }
      }

      if (untilD && current > untilD) break;

      occ.push(new Date(current));
      if (occ.length >= maxCount) break;
    }

    // BYDAY weekly: walk day-by-day so target weekdays are never skipped
    current = isByDayWeekly ? addDays(current, 1) : step(current);
  }

  // Dedup + sort
  let unique = Array.from(new Set(occ.map((d) => d.getTime())))
    .map((t) => new Date(t))
    .sort((a, b) => a.getTime() - b.getTime());

  // Apply exception filtering (Agent 13 core for "skip one")
  unique = filterExceptions(unique, exceptionDates);

  return unique;
}

/** Human preview of next N occurrences (for modal / tooltip).
 *  Updated (Agent 13): optional exceptionDates param passed through (skips honored in previews).
 */
export function getUpcomingRecurrencesPreview(
  anchorDue: string | undefined | null,
  rule: string | null | undefined,
  count = 5,
  exceptionDates?: string[] | null
): string[] {
  if (!anchorDue || !rule) return [];
  const now = new Date();
  const end = addMonths(now, 18); // generous window
  const dates = getOccurrencesInRange(anchorDue, rule, now, end, count + 2, exceptionDates);
  return dates.slice(0, count).map((d) => {
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    return format(d, "MMM d");
  });
}

/** Human description of series termination (for UI chips, tooltips, modal).
 *  Production quality for end conditions display.
 */
export function getRecurrenceEndDescription(rule?: string | null): string {
  const p = parseRecurringRule(rule);
  if (!p) return "No end";
  if (p.until) return `Ends ${p.until}`;
  if (p.count) return `Ends after ${p.count} occurrence${p.count > 1 ? "s" : ""}`;
  return "Ends never (open series)";
}

/** Optional: generate lightweight "concrete" instance descriptors for a task within range.
 *  Returns array of virtual instances (no DB materialization). Useful for advanced views,
 *  exports, or future "instance override" scaffolding. Keeps demo/live separation (pure compute).
 *  Each includes normalized date key + whether skipped.
 */
export interface RecurringInstanceInfo {
  taskId: string;
  occurrenceDate: Date;
  dateKey: string; // YYYY-MM-DD
  isException: boolean;
  seriesLabel: string; // for display
}

export function generateRecurringInstances(
  task: { id: string; dueDate?: string | null; recurringRule?: string | null; exceptionDates?: string[] | null; title?: string },
  rangeStart: Date,
  rangeEnd: Date,
  maxPerTask = 50
): RecurringInstanceInfo[] {
  if (!task.recurringRule || !task.dueDate) return [];
  const dates = getOccurrencesInRange(task.dueDate, task.recurringRule, rangeStart, rangeEnd, maxPerTask, task.exceptionDates);
  const label = getRecurringLabel(task.recurringRule);
  return dates.map((d) => ({
    taskId: task.id,
    occurrenceDate: d,
    dateKey: normalizeCalendarDateKey(d),
    isException: isOccurrenceException(d, task.exceptionDates),
    seriesLabel: label,
  }));
}

// ============================================================
// AGENT 18: TEAM/ADMIN FEATURES + EXPORT/IMPORT + TEMPLATES LIBRARY
// Built strictly on existing data models (Task, Note, WorkspaceMember, ActivityLog from types + hybridStore).
// No new files created. No new dependencies. 
// Gating: callers use `canManage = ["owner","admin"].includes(myRole)` from page/store (currentWorkspace.role).
// Audit logging integrated via hybridStore.logActivity (actionType 'admin.*').
// Handoff ready:
//   - Billing/integrations: workspace usage stats (task/note counts, activity volume) ready for quota/limits.
//   - Future: real Notion API import, advanced CSV mappings, template marketplace, storage metrics in workspace.settings JSONB.
// ============================================================

// Types already imported at top of file for AI/recurring sections (Task, Note, Priority, ActivityLog). Removed duplicate here to avoid TS2300.

/** Member row shape used by CSV/Markdown export (may include email from admin views). */
export type ExportMember = WorkspaceMember & { email?: string; id?: string };

export interface WorkspaceExportPayload {
  workspace: { id: string; name: string; slug: string };
  tasks: Task[];
  notes: Note[];
  members?: ExportMember[];
  activity?: ActivityLog[];
  exportedAt: string;
  version: 1;
}

/** Trigger browser download for any text content (used by export buttons). */
export function downloadFile(filename: string, content: string, mimeType = "text/plain;charset=utf-8"): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Tasks → CSV (headers + rows, quote-safe for Excel/Google Sheets). */
export function tasksToCSV(tasks: Task[]): string {
  if (tasks.length === 0) return "id,title,status,priority,dueDate,tags,recurringRule,description\n";
  const headers = ["id", "title", "status", "priority", "dueDate", "tags", "recurringRule", "description"];
  const rows = tasks.map((t) => {
    const safe = (s?: string) => `"${(s || "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
    return [
      t.id,
      safe(t.title),
      t.status,
      t.priority,
      t.dueDate || "",
      `"${(t.tags || []).join(";")}"`,
      t.recurringRule || "",
      safe(t.description),
    ].join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

/** Notes → CSV (content truncated for sheet safety; full in JSON/MD). */
export function notesToCSV(notes: Note[]): string {
  if (notes.length === 0) return "id,title,createdAt,updatedAt,tags,content\n";
  const headers = ["id", "title", "createdAt", "updatedAt", "tags", "content"];
  const rows = notes.map((n) => {
    const safe = (s?: string) => `"${(s || "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
    const contentShort = (n.content || "").slice(0, 2000); // safety for csv consumers
    return [
      n.id,
      safe(n.title),
      n.createdAt,
      n.updatedAt,
      `"${(n.tags || []).join(";")}"`,
      safe(contentShort),
    ].join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

/** Members → CSV for admin audit/portability. */
export function membersToCSV(members: ExportMember[]): string {
  if (members.length === 0) return "userId,role,joinedAt,email,fullName\n";
  const headers = ["userId", "role", "joinedAt", "email", "fullName"];
  const rows = members.map((m) => [
    m.userId || m.id || "",
    m.role || "",
    m.joinedAt || "",
    m.email || "",
    `"${(m.fullName || "").replace(/"/g, '""')}"`,
  ].join(","));
  return [headers.join(","), ...rows].join("\n");
}

/** Activity log → CSV (great for trends/analysis in Sheets). */
export function activityToCSV(activity: ActivityLog[]): string {
  if (activity.length === 0) return "id,createdAt,actionType,targetType,targetId,userId\n";
  const headers = ["id", "createdAt", "actionType", "targetType", "targetId", "userId", "metadata"];
  const rows = activity.map((a) => {
    const safe = (s?: string) => `"${(s || "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
    return [
      a.id || "",
      a.createdAt || "",
      a.actionType || "",
      a.targetType || "",
      a.targetId || "",
      a.userId || "",
      safe(JSON.stringify(a.metadata || {}).slice(0, 500)),
    ].join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

/** Notes + tasks summary as clean Markdown (Notion paste-friendly, human readable).
 * Enhanced for admin exports: optional members + activity summary included when provided.
 */
export function exportToMarkdown(workspaceName: string, tasks: Task[], notes: Note[], members: ExportMember[] = [], activity: ActivityLog[] = []): string {
  let md = `# ${workspaceName} — Export\n\n**Exported:** ${new Date().toLocaleString()}\n\n## Tasks\n\n`;
  tasks.forEach((t) => {
    const done = t.status === "done" ? "x" : " ";
    md += `- [${done}] **${t.title}** [${t.priority}] ${t.dueDate ? `(due ${new Date(t.dueDate).toLocaleDateString()})` : ""}\n`;
    if (t.description) md += `  ${t.description.replace(/\n/g, "\n  ")}\n`;
    if (t.tags?.length) md += `  _Tags:_ ${t.tags.join(", ")}\n`;
    if (t.recurringRule) md += `  _Recurring:_ ${t.recurringRule}\n`;
    md += "\n";
  });
  md += "## Notes\n\n";
  notes.forEach((n) => {
    md += `### ${n.title}\n\n${n.content || ""}\n\n---\n\n`;
  });
  if (members.length > 0) {
    md += `## Team Members (${members.length})\n\n`;
    members.forEach((m) => {
      md += `- **${m.fullName || m.email || m.userId}** — ${m.role}${m.joinedAt ? ` (joined ${new Date(m.joinedAt).toLocaleDateString()})` : ""}\n`;
    });
    md += "\n";
  }
  if (activity.length > 0) {
    md += `## Activity Log Summary (${activity.length} events)\n\n`;
    const recent = activity.slice(0, 8);
    recent.forEach((a) => {
      const when = a.createdAt ? new Date(a.createdAt).toLocaleString() : "";
      md += `- ${when} — **${a.actionType}** (${a.targetType || ""} ${a.targetId ? a.targetId.slice(0,8) : ""})\n`;
    });
    if (activity.length > 8) md += `_... and ${activity.length - 8} more_\n`;
    md += "\n";
  }
  md += "---\n*Full data (members, complete activity, raw fields) available in the accompanying .json export.*\n";
  return md.trim();
}

/** Full portable JSON dump (for backup/restore or other tools). */
export function exportToJSON(payload: Omit<WorkspaceExportPayload, "exportedAt" | "version">): string {
  const full: WorkspaceExportPayload = {
    ...payload,
    exportedAt: new Date().toISOString(),
    version: 1,
  };
  return JSON.stringify(full, null, 2);
}

export interface ImportMeta {
  sourceWorkspace?: { id?: string; name?: string; slug?: string };
  version?: number;
  exportedAt?: string;
}

/** Parse JSON export (tolerates partials; strips workspaceId for re-targeting on import). */
export function parseJSONImport(jsonStr: string): { tasks: Partial<Task>[]; notes: Partial<Note>[]; meta?: ImportMeta } {
  try {
    const data = JSON.parse(jsonStr) as Record<string, unknown>;
    const clean = (arr: Record<string, unknown>[] = []): Record<string, unknown>[] =>
      arr.map((item) => {
        const rest = { ...(item ?? {}) };
        delete rest.workspaceId;
        delete rest.workspace_id;
        return rest;
      });
    return {
      tasks: clean((data.tasks || data.Tasks) as Record<string, unknown>[]) as Partial<Task>[],
      notes: clean((data.notes || data.Notes) as Record<string, unknown>[]) as Partial<Note>[],
      meta: {
        sourceWorkspace: data.workspace as ImportMeta["sourceWorkspace"],
        version: data.version as number | undefined,
        exportedAt: data.exportedAt as string | undefined,
      },
    };
  } catch {
    return { tasks: [], notes: [] };
  }
}

/** Very basic CSV→tasks parser (matches our export format or simple title,status lists). */
export function parseCSVToTasks(csv: string): Partial<Task>[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.match(/(".*?"|[^,]+)/g)?.map((v) => v.replace(/^"|"$/g, "").replace(/""/g, '"')) || [];
    const obj: Partial<Task> & { tags: string[] } = { tags: [] };
    headers.forEach((h, i) => {
      const v = (vals[i] || "").trim();
      if (h.includes("title")) obj.title = v;
      else if (h.includes("status")) obj.status = (v || "todo") as TaskStatus;
      else if (h.includes("priority")) obj.priority = (v || "P2") as Priority;
      else if (h.includes("due")) obj.dueDate = v || undefined;
      else if (h.includes("tag")) obj.tags = v ? v.split(/;|,/) : [];
      else if (h.includes("recurr")) obj.recurringRule = v || undefined;
      else if (h.includes("desc")) obj.description = v;
    });
    return obj.title ? (obj as Partial<Task>) : null;
  }).filter(Boolean) as Partial<Task>[];
}

// Reusable + user-extensible templates library (static seeds + dynamic via 'template' tag on real items)
export const TEMPLATE_LIBRARY: Array<{
  type: "task" | "note";
  title: string;
  description?: string;
  content?: string;
  priority?: Priority;
  tags?: string[];
  recurringRule?: string;
}> = [
  // Personal / OKR
  {
    type: "task",
    title: "Define Q3 Personal OKRs",
    description: "1. 2-3 Objectives (qualitative)\n2. 3-5 Key Results per objective (measurable)\n3. Align with manager + share\n4. Set bi-weekly check-ins",
    priority: "P1",
    tags: ["template", "okr", "personal", "planning"],
  },
  {
    type: "note",
    title: "OKR Dashboard & Tracking",
    content: "## Objectives\n\n1. \n\n## Key Results\n- KR1: \n- KR2: \n\n## Weekly Progress\n| Week | Status | Notes |\n|------|--------|-------|\n\n## Risks & Support Needed",
    tags: ["template", "okr", "personal"],
  },
  // Startup Launch
  {
    type: "task",
    title: "MVP Launch Checklist",
    description: "☐ Finalize core feature set\n☐ Beta test with 5 users\n☐ Fix P0 bugs\n☐ Landing page + pricing live\n☐ Announce on Product Hunt / X / LinkedIn\n☐ Monitor onboarding funnel day 1-7",
    priority: "P0",
    tags: ["template", "startup", "launch", "mvp"],
  },
  {
    type: "note",
    title: "Startup Launch Plan",
    content: "## Vision\n\n## Target Users & Problem\n\n## MVP Scope (must have only)\n\n## Go-to-Market\n- Channels:\n- Messaging:\n\n## Success Metrics (Week 1 / Month 1)\n\n## Risks & Mitigations",
    tags: ["template", "startup", "launch"],
  },
  // Client Projects
  {
    type: "task",
    title: "Client Project Kickoff",
    description: "1. Schedule kickoff call\n2. Share project brief + timeline\n3. Collect assets + access\n4. Set weekly sync + Slack channel\n5. Define success criteria + milestones",
    priority: "P1",
    tags: ["template", "client", "project", "kickoff"],
  },
  {
    type: "note",
    title: "Client Project Brief & Scope",
    content: "## Client & Stakeholders\n\n## Project Goals\n\n## Scope (In / Out)\n\n## Timeline & Milestones\n\n## Budget / Resources\n\n## Risks & Assumptions\n\n## Next Steps & Owner",
    tags: ["template", "client", "project"],
  },
  // Team / Agile
  {
    type: "task",
    title: "Run Team Retrospective",
    description: "1. Send prep survey (3 questions)\n2. Gather + cluster feedback\n3. Vote on top 2 improvements\n4. Assign owners + due dates\n5. Add to next sprint",
    priority: "P2",
    tags: ["template", "team", "retro", "agile"],
  },
  {
    type: "note",
    title: "Sprint Retrospective Notes",
    content: "## What went well\n\n## What didn't\n\n## Action Items\n- [ ]  \n\n## Shoutouts",
    tags: ["template", "team", "retro"],
  },
  // Content & Ops
  {
    type: "task",
    title: "Plan 4-Week Content Calendar",
    description: "Themes by week\nAssign owners\nSEO/asset needs\nPublish schedule\nPromotion plan",
    priority: "P2",
    tags: ["template", "content", "marketing"],
  },
  {
    type: "note",
    title: "Weekly Team Update Template",
    content: "## Wins this week\n\n## Blockers & Asks\n\n## Upcoming (next 7d)\n\n## Metrics Snapshot\n\n## Shoutouts",
    tags: ["template", "team", "update"],
  },
  // Misc high value
  {
    type: "task",
    title: "Ship critical P0",
    description: "1. Define done criteria\n2. Implement core change\n3. Test + review\n4. Deploy & announce",
    priority: "P0",
    tags: ["template", "engineering", "p0"],
  },
  {
    type: "task",
    title: "Prepare daily standup",
    description: "Yesterday: X\nBlockers: Y\nToday: Z",
    tags: ["template", "team"],
  },
  {
    type: "note",
    title: "Meeting Notes",
    content: "## Attendees\n\n## Agenda\n\n## Decisions\n\n## Next Actions\n- [ ] ",
    tags: ["template"],
  },
];

export function getStaticTemplates() {
  return TEMPLATE_LIBRARY;
}

export function hasTemplateTag(tags?: string[] | null): boolean {
  return !!(tags || []).some((t) => t.toLowerCase() === "template");
}

// Convenience: turn a template seed into a creatable payload (caller adds workspaceId)
export function templateToTaskPayload(tpl: (typeof TEMPLATE_LIBRARY)[number]) {
  return {
    title: tpl.title,
    description: tpl.description,
    priority: tpl.priority || "P2",
    tags: [...(tpl.tags || []), "from-template"],
    recurringRule: tpl.recurringRule,
  };
}

export function templateToNotePayload(tpl: (typeof TEMPLATE_LIBRARY)[number]) {
  return {
    title: tpl.title,
    content: tpl.content || "",
    tags: [...(tpl.tags || []), "from-template"],
  };
}

/** Light haptic feedback on supported mobile browsers. */
export function triggerHaptic(kind: "light" | "medium" | "success" | "error" = "light") {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  const patterns: Record<string, number | number[]> = {
    light: 8,
    medium: 16,
    success: [12, 40, 12],
    error: [20, 60, 20, 60, 20],
  };
  try {
    navigator.vibrate(patterns[kind] ?? 8);
  } catch {
    /* ignore */
  }
}

export type HybridSearchResult = {
  id: string;
  type: "task" | "note";
  title: string;
  snippet: string;
  score: number;
  reasons: string[];
};

/** Simple hybrid search over tasks + notes (title, description, tags). */
export function getHybridSearchResults(
  query: string,
  data: { tasks: Task[]; notes: Note[] },
  opts?: { types?: Array<"task" | "note">; limit?: number }
): HybridSearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const types = opts?.types ?? ["task", "note"];
  const limit = opts?.limit ?? 12;
  const scoreText = (text: string) => {
    const t = text.toLowerCase();
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (t.includes(q)) return 50;
    return 0;
  };

  const results: HybridSearchResult[] = [];

  if (types.includes("task")) {
    for (const task of data.tasks) {
      const parts = [task.title, task.description || "", ...(task.tags || [])].join(" ");
      const score = scoreText(parts);
      if (score > 0) {
        results.push({
          id: task.id,
          type: "task",
          title: task.title,
          snippet: task.description?.slice(0, 120) || task.status,
          score,
          reasons: ["title match"],
        });
      }
    }
  }

  if (types.includes("note")) {
    for (const note of data.notes) {
      const parts = [note.title, note.content || "", ...(note.tags || [])].join(" ");
      const score = scoreText(parts);
      if (score > 0) {
        results.push({
          id: note.id,
          type: "note",
          title: note.title,
          snippet: (note.content || "").replace(/<[^>]+>/g, "").slice(0, 120),
          score,
          reasons: ["content match"],
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
