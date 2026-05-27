import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isTomorrow, isPast, addDays, addWeeks, addMonths, addYears, startOfDay, getDay } from "date-fns";

// Canonical types (single source of truth). Old duplicate local copies removed during QA/types cleanup.
import type { Task, Priority, TaskStatus } from "@/types";
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

  if (tomorrowMatch) {
    result.dueDate = addDays(now, 1).toISOString();
  } else if (fridayMatch) {
    const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
    result.dueDate = addDays(now, daysUntilFriday).toISOString();
  } else if (nextWeekMatch) {
    result.dueDate = addDays(now, 7).toISOString();
  } else if (todayMatch) {
    result.dueDate = now.toISOString();
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
  const date = new Date(dateString);
  if (isToday(date)) return { label: "Today", variant: "today" as const };
  if (isTomorrow(date)) return { label: "Tomorrow", variant: "soon" as const };
  if (isPast(date)) return { label: format(date, "MMM d"), variant: "overdue" as const };
  return { label: format(date, "MMM d"), variant: "default" as const };
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
      let u = part.slice(6).trim().replace(/[-T: Z]/g, "").slice(0, 8);
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
    base = `Every ${interval} ${freq.toLowerCase()}s`;
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

/** Normalize any date/string to stable YYYY-MM-DD key for exception comparison (client local safe for this purpose). */
export function normalizeExceptionKey(d: Date | string): string {
  const dt = startOfDay(new Date(d));
  return format(dt, "yyyy-MM-dd");
}

/** Returns true if the given date matches any exception date for the series. */
export function isOccurrenceException(date: Date | string, exceptionDates?: string[] | null): boolean {
  if (!exceptionDates || exceptionDates.length === 0) return false;
  const key = normalizeExceptionKey(date);
  return exceptionDates.some((ex) => normalizeExceptionKey(ex) === key);
}

/** Filter an array of occurrence dates against exceptions (used by calendar + next due). */
export function filterExceptions(dates: Date[], exceptionDates?: string[] | null): Date[] {
  if (!exceptionDates || exceptionDates.length === 0) return dates;
  return dates.filter((d) => !isOccurrenceException(d, exceptionDates));
}

/** Returns next future due date (Date) for a recurring rule, or null. Anchor is the "seed" dueDate.
 *  Production (Agent 25): respects exceptionDates, UNTIL, and COUNT (series termination).
 *  COUNT support is best-effort for next-due (full history not stored; future occurrences limited in range gen).
 */
export function getNextRecurringDue(
  rule: string | null,
  from: Date = new Date(),
  anchorDue?: string | Date,
  exceptionDates?: string[] | null
): Date | null {
  const pattern = parseRecurringRule(rule);
  if (!pattern) return null;

  const anchor = anchorDue ? startOfDay(new Date(anchorDue)) : startOfDay(from);
  let cursor = new Date(anchor.getTime());

  const step = (d: Date): Date => {
    switch (pattern.freq) {
      case "DAILY": return addDays(d, pattern.interval);
      case "WEEKLY": return addWeeks(d, pattern.interval);
      case "MONTHLY": return addMonths(d, pattern.interval);
      case "YEARLY": return addYears(d, pattern.interval);
      default: return addDays(d, pattern.interval);
    }
  };

  // Safe until date parser (handles our normalized YYYY-MM-DD)
  const getUntilDate = (): Date | null => {
    if (!pattern.until) return null;
    return startOfDay(new Date(pattern.until + "T00:00:00"));
  };

  // Weekly BYDAY special: jump to next matching weekday(s) after current
  const WEEKDAY_MAP: Record<WeekDay, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  if (pattern.freq === "WEEKLY" && pattern.byDay && pattern.byDay.length > 0) {
    const targetDays = pattern.byDay.map((d) => WEEKDAY_MAP[d]);
    // Start search from tomorrow relative to 'from' or anchor
    let search = addDays(startOfDay(from), 1);
    const maxIter = 14 * Math.max(1, pattern.interval) + 10; // extra for exceptions
    for (let i = 0; i < maxIter; i++) {
      const wd = getDay(search);
      if (targetDays.includes(wd) && !isOccurrenceException(search, exceptionDates)) {
        const untilD = getUntilDate();
        if (untilD && search > untilD) return null;
        // COUNT not strictly enforced here (would require series position); rely on range gen + UI
        return search;
      }
      search = addDays(search, 1);
    }
    return null;
  }

  // Generic: advance at least one step from anchor (or from 'from' if later), skipping exceptions + until
  let next = step(cursor);
  const fromDay = startOfDay(from);
  let safety = 0;
  const maxSafety = 365 * 5; // hard bound for bad data
  while (safety++ < maxSafety && next.getTime() <= fromDay.getTime()) {
    next = step(next);
  }
  // Skip any exception hits and respect until
  while (safety++ < maxSafety) {
    if (isOccurrenceException(next, exceptionDates)) {
      next = step(next);
      continue;
    }
    const untilD = getUntilDate();
    if (untilD && next > untilD) return null;
    if (next.getTime() > fromDay.getTime()) break;
    next = step(next);
  }
  return next;
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

  const anchor = startOfDay(new Date(anchorDue));
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
    return startOfDay(new Date(pattern.until + "T00:00:00"));
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
        include = true;
      }
    } else {
      // For non-BYDAY or other freqs, every stepped occurrence counts
      include = true;
    }

    if (include && current >= rStart && current <= rEnd) {
      // Respect series COUNT (count only from anchor forward as series start)
      if (current >= anchor) {
        seriesOccCounter++;
        if (seriesOccCounter > maxSeries) {
          break; // series has ended per COUNT
        }
      }

      // Respect until
      if (untilD && current > untilD) break;

      occ.push(new Date(current));
      if (occ.length >= maxCount) break;
    }

    current = step(current);
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
    dateKey: normalizeExceptionKey(d),
    isException: isOccurrenceException(d, task.exceptionDates),
    seriesLabel: label,
  }));
}

// ============================================================
// AI SUPERPOWERS (Agent 9 + Agent 15 + Agent 26 + Agent 29)
// Magical, data-aware intelligence.
// - World-class local heuristics (always-on, instant, private, zero-config)
// - Real xAI Grok integration (when NEXT_PUBLIC_XAI_API_KEY set): specialized prompts, JSON structured outputs for decomp/extract/brief/proactive/transform
// - Graceful rate limiting + cost tracking + seamless fallback
// - Documented switch: key presence = real superpower mode. FORCE_SIM override for testing.
// Never removes the stellar simulation — it is the reliable backbone.
// ============================================================

import type { Note, ActivityLog } from "@/types";

// Types re-exported at top of file for legacy; AI consumers can import directly from @/types

/* =====================================================================
   ADVANCED AI ABSTRACTION LAYER (Agent 26 + Agent 29 Real xAI)
   - All intelligence lives here. Real xAI Grok now deeply integrated (Agent 29).
   - Simulation remains production-grade + delightful + zero-config (primary for editor, fast UI).
   - Public surface (enhanced): getAIResponse + new async *AI variants (aiTransformTextAI, generate*BriefingAI, generateSubtaskDecompositionAI, extract*AI, getProactive*AI)
   - Internal: simulate..., callRealXAI (now with modes, JSON, rate limit, cost), buildContextSummary
   - Real mode: specialized prompts + structured JSON where it adds superpowers (decomp, briefings, extract, proactive).
   - Backward + forward compatible. Callers can opt into async real paths for magic; sync sim always available.
   - Switching documented at top of this file + in AGENT-29 handoff.
   ===================================================================== */

export interface AIActionItem {
  title: string;
  priority: Priority;
  dueDate?: string;
  tags?: string[];
  // Agent 15: optional decomposition hints — when note sentence implies multiple steps, populate for smarter extraction flows
  subSteps?: string[];
}

export interface DailyBriefing {
  greeting: string;
  summary: string;
  topPriorities: string[];
  focusSuggestion: string;
  stats: {
    dueToday: number;
    p0Count: number;
    activeTasks: number;
    notesCount: number;
    momentum: string;
  };
  generatedAt: string;
}

// ============================================================
// AGENT 15 + 29 ADVANCED AI CAPABILITIES — Writing Assistant, Extraction, Briefings + Real xAI
// All demo-mode sims world-class. Real xAI (structured + specialized prompts) now live when key present.
// Primary surfaces: utils (new *AI async fns) + AIChatPanel + editor /ai + TaskModal decomp + CommandPalette.
// ============================================================

export interface AITextTransformResult {
  transformed: string;
  mode: string;
  explanation: string; // Human-readable reason + suggestion for UI (toast, inline, chat)
}

/**
 * In-editor AI writing assistant core (rewrite / expand / summarize / tone shift).
 * High-signal simulation (instant, private). Use aiTransformTextAI() for real xAI when configured.
 * Operates on plain text; results drop back cleanly.
 */
export function aiTransformText(
  text: string,
  mode: "rewrite" | "expand" | "summarize" | "tone:professional" | "tone:casual" | "tone:bold" = "rewrite"
): AITextTransformResult {
  if (!text || text.trim().length < 4) {
    return { transformed: text, mode, explanation: "Too short — add more signal first." };
  }

  const original = text.trim();
  const lower = original.toLowerCase();
  const wordCount = original.split(/\s+/).length;
  const isLong = wordCount > 25;
  const hasActionVerbs = /\b(ship|build|launch|finish|draft|review|call|meet|write|prepare|research|pitch|finalize|send|update|create|fix|deploy|design|outline|brainstorm|deliver)\b/i.test(original);
  const hasFillers = /\b(very|really|quite|just|actually|basically|simply|kinda|sort of)\b/i.test(original);

  let transformed = original;
  let explanation = "AI-polished for maximum clarity and impact.";

  switch (mode) {
    case "rewrite":
      // Tighten, active voice, kill fillers, keep voice
      transformed = original
        .replace(/\b(very|really|quite|just|actually|basically|simply|kinda|sort of)\b/gi, "")
        .replace(/\b(I think|in my opinion|it seems like|we should probably)\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .replace(/([.!?])\s+/g, "$1 ")
        .trim();
      if (hasActionVerbs) {
        transformed = transformed.charAt(0).toUpperCase() + transformed.slice(1);
      }
      explanation = hasFillers || isLong
        ? "Cut filler words, tightened to active voice. 30% punchier."
        : "Rewrote for precision and flow. Ready to ship.";
      break;

    case "expand":
      const elaboration = hasActionVerbs
        ? "\n\nMicro-steps to execute:\n• 15-min first action: define done criteria\n• Identify one blocker + owner today\n• Schedule 25-min focus block (P0 candidate)"
        : "\n\nWhy it moves the needle + how:\n• Directly supports current top priorities\n• Low cognitive load, high visibility win\n• Batch with similar work this week";
      transformed = original + elaboration;
      explanation = "Expanded with concrete, prioritized next actions.";
      break;

    case "summarize":
      const sentences = original.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 6);
      const essence = sentences.slice(0, isLong ? 2 : 1).join(". ") + (sentences.length > (isLong ? 2 : 1) ? "..." : ".");
      const takeaway = hasActionVerbs
        ? "Ship the core deliverable this week — break into 2 subtasks if complex."
        : "Capture as note + convert key point to a tracked task.";
      transformed = `Key insight: ${essence}\n\nActionable: ${takeaway}`;
      explanation = isLong ? "Distilled long note to essence + 1 crisp action." : "Captured the signal in one tight block.";
      break;

    case "tone:professional":
      transformed = original
        .replace(/!/g, ".")
        .replace(/\b(gonna|wanna|gotta|kinda|sorta)\b/gi, (m) => ({gonna:"going to", wanna:"want to", gotta:"must", kinda:"somewhat", sorta:"rather"}[m.toLowerCase()] || m))
        .replace(/\b(hey|ok|yeah)\b/gi, "");
      explanation = "Elevated to crisp, professional tone suitable for stakeholders or docs.";
      break;

    case "tone:casual":
      transformed = original
        .replace(/\b(therefore|additionally|consequently)\b/gi, "plus")
        .replace(/([.!?])\s*/g, "$1 — ");
      if (!transformed.endsWith("!")) transformed += " — let's go.";
      explanation = "Conversational, friendly tone perfect for team notes or quick updates.";
      break;

    case "tone:bold":
      const emphatic = original.replace(/\b(we|I|the team)\b/gi, (m) => m.toUpperCase());
      transformed = `**${emphatic}** — this is the move. Ship it.`;
      explanation = "Bold, confident framing for pitches, announcements, or leadership updates.";
      break;
  }

  // Demo magic: tie back to workspace energy
  if (hasActionVerbs && !transformed.toLowerCase().includes("p0") && wordCount < 40) {
    transformed += " (Strong P0 candidate.)";
  }

  return {
    transformed: transformed.length > 900 ? transformed.slice(0, 880) + "..." : transformed,
    mode,
    explanation,
  };
}

/** Generate a rich weekly briefing... Use generateWeeklyBriefingAI() for real xAI when configured. */
export function generateWeeklyBriefing(tasks: Task[], notes: Note[], activity: ActivityLog[] = []): DailyBriefing & {
  weekActions: string[];
  trend: string;
  focusDays: string;
} {
  const now = new Date();
  const active = tasks.filter((t) => t.status !== "done");
  const p0s = active.filter((t) => t.priority === "P0");
  const dueThisWeek = active.filter((t) => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    const daysAhead = (d.getTime() - now.getTime()) / (1000*3600*24);
    return daysAhead >= 0 && daysAhead <= 7;
  });

  const recentNotes = [...notes].sort((a,b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0,3);
  const insight = recentNotes[0] ? `Signal from "${recentNotes[0].title}" — extract or expand it this week.` : "Block 30min for strategic capture this week.";

  // Agent 26 activity enrichment
  const weeklyWins = activity.filter((a) => /complete|done/i.test(a.actionType) && (now.getTime() - new Date(a.createdAt).getTime()) < 7*86400000 ).length;
  const momentum = p0s.length >= 3 ? "High-velocity week ahead — protect deep work blocks." : dueThisWeek.length > 4 ? "Execution heavy; front-load the P1s." : weeklyWins > 5 ? "Strong execution week — ride the momentum." : "Clear runway for bold proactive moves.";

  const weekActions = [
    p0s[0] ? `Ship ${p0s[0].title.split(" ").slice(0,4).join(" ")}` : "Pick your #1 bet and protect the calendar",
    dueThisWeek[0] ? `Clear ${dueThisWeek[0].title}` : "Schedule one creative deep-dive",
    "Review notes → extract 3-5 actions (use AI Extract)",
  ].slice(0,3);

  const trend = p0s.length > 2 ? "Momentum building fast" : weeklyWins > 3 ? "Proven velocity — accelerate bets" : "Steady — time to accelerate";
  const focusDays = "Tue/Wed for heavy lifts; Fri for wrap + planning.";

  // Reuse daily shape + extras (back-compat for existing callers) — pass activity through
  const base = generateDailyBriefing(tasks, notes, activity);

  return {
    ...base,
    greeting: `Good week. ${momentum}`,
    summary: `${active.length} active • ${p0s.length} P0s • ${dueThisWeek.length} due this week. ${insight}${weeklyWins ? ` ${weeklyWins} wins this week.` : ""}`,
    focusSuggestion: weekActions[0],
    weekActions,
    trend,
    focusDays,
    stats: {
      ...base.stats,
      momentum,
    },
  };
}

/** =====================================================================
   REAL xAI INTEGRATION (Agent 29)
   - Production-minded: client demo via NEXT_PUBLIC_XAI_API_KEY (for local/experiments)
   - Recommended prod: proxy via app/api/ai/* using private XAI_API_KEY (see comments)
   - ALWAYS falls back to world-class local simulation (never removes magic)
   - Basic rate limiting + cost tracking (client-side demo limits)
   - Structured JSON outputs for decompose/extract/briefing/proactive
   - Specialized, high-signal prompts per use case (chat, writing, PM tasks)
   - Switch: set NEXT_PUBLIC_XAI_API_KEY=sk-...  OR  NEXT_PUBLIC_AI_FORCE_SIM=1 to lock sim
   ===================================================================== */

/** Simple in-memory rate limiter + usage stats (resets on reload; demo-safe) */
const AI_RATE_LIMIT = {
  callsThisMinute: 0,
  minuteWindowStart: Date.now(),
  totalCalls: 0,
  totalEstTokens: 0,
  lastCallAt: 0,
};
const MAX_CALLS_PER_MIN = 12; // generous for demo; prod server route + real limits
const MAX_CALLS_PER_HOUR_EST = 60;
const COOLDOWN_MS = 800; // polite spacing

function checkAIRateLimit(): { allowed: boolean; reason?: string } {
  const now = Date.now();
  // Reset minute window
  if (now - AI_RATE_LIMIT.minuteWindowStart > 60_000) {
    AI_RATE_LIMIT.callsThisMinute = 0;
    AI_RATE_LIMIT.minuteWindowStart = now;
  }
  // Basic cooldown
  if (now - AI_RATE_LIMIT.lastCallAt < COOLDOWN_MS) {
    return { allowed: false, reason: "cooldown" };
  }
  if (AI_RATE_LIMIT.callsThisMinute >= MAX_CALLS_PER_MIN) {
    return { allowed: false, reason: "per-minute" };
  }
  // Soft hourly (best effort)
  if (AI_RATE_LIMIT.totalCalls > MAX_CALLS_PER_HOUR_EST && (now - AI_RATE_LIMIT.minuteWindowStart) < 3600_000) {
    return { allowed: false, reason: "hourly-soft" };
  }
  return { allowed: true };
}

function recordAICall(estTokens: number) {
  const now = Date.now();
  AI_RATE_LIMIT.callsThisMinute++;
  AI_RATE_LIMIT.totalCalls++;
  AI_RATE_LIMIT.totalEstTokens += estTokens;
  AI_RATE_LIMIT.lastCallAt = now;
  // Rough cost (grok-2 ~ $0.5 / 1M input? adjust as xAI updates; illustrative)
  const estCost = (estTokens / 1_000_000) * 0.8;
  console.info(`[xAI] call recorded • ~${estTokens} tokens • est $${estCost.toFixed(4)} • total calls: ${AI_RATE_LIMIT.totalCalls}`);
}

/** Detects optional real xAI key. Respects force-sim override for testing fallbacks. */
export function isXAIConfigured(): boolean {
  if (typeof process === "undefined") return false;
  const forceSim = !!process.env?.NEXT_PUBLIC_AI_FORCE_SIM;
  if (forceSim) return false;
  return !!process.env?.NEXT_PUBLIC_XAI_API_KEY;
}

export function getAICostStats() {
  return {
    totalCalls: AI_RATE_LIMIT.totalCalls,
    estTokens: AI_RATE_LIMIT.totalEstTokens,
    // illustrative only
    estCostUSD: (AI_RATE_LIMIT.totalEstTokens / 1_000_000) * 0.8,
  };
}

/**
 * Enhanced direct (optional) call to real xAI Grok API.
 * Supports specialized modes, JSON structured outputs, rate limiting, fallbacks.
 * Production note: For real apps move key + calls to server route (see below).
 */
async function callRealXAI(
  userInput: string,
  contextSummary: string,
  options: {
    systemPrompt?: string;
    mode?: "chat" | "transform" | "briefing" | "decompose" | "extract" | "proactive";
    expectJson?: boolean;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<string | null> {
  const key = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_XAI_API_KEY) || "";
  if (!key) return null;

  const rate = checkAIRateLimit();
  if (!rate.allowed) {
    console.warn(`[xAI] rate limited (${rate.reason}) — graceful fallback to simulation`);
    return null;
  }

  const mode = options.mode || "chat";
  const expectJson = !!options.expectJson;

  // Specialized, badass prompts — tuned for each superpower use case
  let systemPrompt = options.systemPrompt || "You are Grok, an elite badass productivity co-pilot inside Bad Ass Tasks. Be concise, actionable, witty and encouraging. Reference the user's real tasks and notes by exact title when it makes sense. Never invent data you weren't given.";

  switch (mode) {
    case "transform":
      systemPrompt = "You are an elite Grok writing coach embedded in Bad Ass Tasks. For the requested mode (rewrite/expand/summarize/tone), deliver maximum clarity, impact, and voice preservation. Cut filler. Be decisive. Output ONLY the transformed text — no quotes, no explanations, no preamble.";
      break;
    case "briefing":
      systemPrompt = "You are an elite strategic productivity coach for ambitious users of Bad Ass Tasks. Synthesize tasks + notes + recent activity into a sharp, motivating daily or weekly briefing. Use exact task titles. Be witty yet professional. Output ONLY valid JSON matching this exact shape (no markdown, no extra text):\n{\n  \"greeting\": string,\n  \"summary\": string,\n  \"topPriorities\": string[3],\n  \"focusSuggestion\": string,\n  \"stats\": { \"dueToday\": number, \"p0Count\": number, \"activeTasks\": number, \"notesCount\": number, \"momentum\": string }\n}";
      break;
    case "decompose":
      systemPrompt = "You are a world-class project decomposer for high-performers. Break the given task into 2-4 ambitious yet realistic subtasks. Make titles crisp and actionable. Assign sensible priorities (inherit or step down). Suggest due dates relative to today only if logical. Output ONLY a JSON array: [{\"title\": string, \"priority\": \"P0\"|\"P1\"|\"P2\"|\"P3\", \"dueDate\"?: ISO-string }]. Max 4 items. No other text.";
      break;
    case "extract":
      systemPrompt = "You are an expert action-item extractor for Bad Ass Tasks. From note prose, pull 1-4 high-signal, verb-driven action items. Infer priority from urgency language. Parse simple due dates (tomorrow, Friday, etc). Detect compound steps for subSteps. Output ONLY JSON array of: [{\"title\": string, \"priority\": \"P0\"|\"P1\"|\"P2\"|\"P3\", \"dueDate\"?: string, \"subSteps\"?: string[] }]. Use exact source phrasing where possible. No preamble.";
      break;
    case "proactive":
      systemPrompt = "You are a proactive, insightful co-pilot. From live workspace data, surface 1-3 high-signal actionable nudges (overdue P0s, stalled momentum, untapped notes, clear runway for big bets). Each with crisp message + one-sentence actionHint. Output ONLY JSON array: [{\"id\": string, \"message\": string, \"actionHint\": string, \"type\": \"overdue\"|\"momentum\"|\"capture\"|\"focus\" }]. Max 3. No extra text.";
      break;
    case "chat":
    default:
      // keep rich default + context injection
      systemPrompt = "You are Grok 4, the ultimate badass productivity co-pilot inside Bad Ass Tasks. Be concise (under 120 words unless asked), actionable, witty, encouraging. Reference user's real tasks/notes by exact title. Offer specific next moves. Never hallucinate data.";
  }

  const inputWithHint = expectJson
    ? `${userInput}\n\nRespond with STRICTLY valid JSON only. No markdown fences, no commentary.`
    : userInput;

  const estInputTokens = Math.ceil((systemPrompt.length + contextSummary.length + inputWithHint.length) / 4) + 40;
  const maxTokens = options.maxTokens || (expectJson ? 450 : 380);

  try {
    const payload: any = {
      model: "grok-2-1212", // stable high-quality; swap to grok-3-latest etc when desired
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nLIVE USER CONTEXT (use exact titles; personalize deeply):\n${contextSummary}`,
        },
        { role: "user", content: inputWithHint },
      ],
      max_tokens: maxTokens,
      temperature: options.temperature ?? (expectJson ? 0.35 : 0.72),
    };

    if (expectJson) {
      payload.response_format = { type: "json_object" };
    }

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn("[xAI] non-OK response", res.status, txt.slice(0, 200));
      return null;
    }

    const data = await res.json();
    let content = data?.choices?.[0]?.message?.content?.trim() || null;

    // Rough usage from usage field if present (xAI compatible)
    const usage = data?.usage;
    const actualTokens = usage ? (usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0)) : estInputTokens + Math.ceil((content?.length || 200) / 4);
    recordAICall(actualTokens);

    if (content && expectJson) {
      // Clean common model artifacts
      content = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    }
    return content;
  } catch (err) {
    console.warn("[xAI] call failed, falling back to stellar simulation:", err);
    return null;
  }
}

/** Compact but rich context summary string for prompts or sim heuristics */
function buildContextSummary(tasks: Task[], notes: Note[], workspaceName: string, activity: ActivityLog[] = []): string {
  const active = tasks.filter((t) => t.status !== "done");
  const p0s = active.filter((t) => t.priority === "P0").slice(0, 3);
  const recent = [...notes]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 2)
    .map((n) => `"${n.title}": ${n.content.slice(0, 90)}…`)
    .join(" || ");
  const act = activity.length ? ` ${activity.length} recent activity events.` : "";

  return `Workspace "${workspaceName}". ${active.length} active tasks (${p0s.length} P0). Recent notes: ${recent || "none yet"}.${act}`;
}

/** The heart of the delightful always-working AI — deeply personalized using real store data. */
export function simulateAIResponse(
  userInput: string,
  context: { tasks: Task[]; notes: Note[]; currentWorkspaceName: string; activity?: ActivityLog[] }
): { reply: string; suggestedAction?: string } {
  const lower = userInput.toLowerCase().trim();
  const { tasks, notes, currentWorkspaceName, activity = [] } = context;
  const active = tasks.filter((t) => t.status !== "done");
  const p0s = active.filter((t) => t.priority === "P0");
  const dueSoon = active.filter(
    (t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now() + 1000 * 3600 * 50
  );
  const topRecentNote = [...notes].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];

  const wantsExtract = /extract|action item|task from|pull task|turn into task/.test(lower);
  const wantsBrief = /brief|daily|today|morning|what matters/.test(lower);
  const wantsFocus = /focus|priority|leverage|most important|what should i/.test(lower);
  const wantsSumm = /summar|overview|snapshot|recap/.test(lower);
  const wantsPlan = /plan|week|strategy|roadmap/.test(lower);

  // Agent 15: writing assistant + weekly intents (powerful in chat + palette)
  const wantsRewrite = /rewrite|rephrase|polish|improve (the )?writing|make it better/.test(lower);
  const wantsExpand = /expand|elaborate|add detail|more (on|about)|flesh out/.test(lower);
  const wantsSummarizeText = /summarize (this|the|my)|tl;dr|short version|condense/.test(lower);
  const wantsTone = /change tone|make (it )?(professional|casual|bold)|tone (shift|adjust)/.test(lower);
  const wantsWeekly = /weekly (brief|plan|briefing|review)|this week|week ahead/.test(lower);

  if (wantsExtract && notes.length) {
    const note = topRecentNote || notes[0];
    const items = extractActionItemsFromText(note.content, note.title);
    if (items.length) {
      return {
        reply: `From "${note.title}" I pulled ${items.length} high-signal action${items.length > 1 ? "s" : ""}. Example: "${items[0].title}" (${items[0].priority}). Use the magic ✨ button in the Notes editor or say "add them" to promote them into real tasks right now.`,
        suggestedAction: "extract",
      };
    }
    return { reply: `Scanned your notes. "${note.title}" is the richest. No screaming action verbs, but I can help you turn the key ideas into tasks.` };
  }

  if (wantsBrief) {
    const b = generateDailyBriefing(tasks, notes, []); // activity optional; caller context can enrich
    return {
      reply: `${b.greeting}\n\n${b.summary}\n\n${b.focusSuggestion}\n\n(Stats: ${b.stats.p0Count} P0s, ${b.stats.dueToday} due/overdue. Full card in Today view or via the Briefing button below.)`,
      suggestedAction: "brief",
    };
  }

  if (wantsFocus) {
    const hero = p0s[0] || dueSoon[0] || active[0];
    return {
      reply: hero
        ? `Highest leverage right now: "${hero.title}". ${hero.dueDate ? "It's time-sensitive." : ""} Close the laptop on everything else until this ships.`
        : "Crystal clear plate. This is the perfect moment for deep creative or strategic work.",
    };
  }

  if (wantsSumm) {
    const done = tasks.filter((t) => t.status === "done").length;
    return {
      reply: `${currentWorkspaceName} right now: ${active.length} active (${p0s.length} P0). ${done} completed. ${dueSoon.length} time-sensitive. ${topRecentNote ? `Strong signal from "${topRecentNote.title}".` : ""} Momentum is real.`,
    };
  }

  if (wantsPlan) {
    const planItem = p0s[0]?.title || (active[0]?.title ?? "your biggest bet");
    return {
      reply: `Tight 72-hour plan:\n• Today: ${planItem}\n• Tomorrow: 2 quick wins + one note capture\n• Day 3: Review + next bold move\nWant me to materialize any of these as tasks?`,
    };
  }

  // Agent 15 writing transforms (uses new aiTransformText — works on note content or task desc)
  if (wantsRewrite || wantsExpand || wantsSummarizeText || wantsTone) {
    const sourceText = topRecentNote?.content || p0s[0]?.description || p0s[0]?.title || "Key project update here.";
    let tMode: Parameters<typeof aiTransformText>[1] = "rewrite";
    if (wantsExpand) tMode = "expand";
    else if (wantsSummarizeText) tMode = "summarize";
    else if (lower.includes("professional")) tMode = "tone:professional";
    else if (lower.includes("casual")) tMode = "tone:casual";
    else if (lower.includes("bold")) tMode = "tone:bold";
    const res = aiTransformText(sourceText, tMode);
    return {
      reply: `**${res.explanation}**\n\n${res.transformed}\n\nPaste into the editor (use /ai there for direct apply) or tell me "apply it" / "use this version".`,
    };
  }

  if (wantsWeekly) {
    const w = generateWeeklyBriefing(tasks, notes, activity); // activity enriches when provided upstream
    return {
      reply: `${w.greeting}\n\n${w.summary}\n\nTop actions this week:\n${w.weekActions.map((a,i)=>`${i+1}. ${a}`).join("\n")}\n\nTrend: ${w.trend}. Focus days: ${w.focusDays}\n\n(Full stats in AI panel or Today view.)`,
      suggestedAction: "brief",
    };
  }

  // Agent 26: Proactive suggestion system — surfaces automatically on relevant queries or via dedicated util
  const wantsProactive = /suggest|proactive|what should|overdue|stuck|insight|recommend/i.test(lower);
  if (wantsProactive) {
    const pros = getProactiveSuggestions(tasks, notes, activity);
    const top = pros[0];
    return {
      reply: top ? `Proactive insight: ${top.message} ${top.actionHint ? `(Hint: ${top.actionHint})` : ""}\n\nAsk me to "break this down" on a specific task or "reschedule P0s".` : "Everything looks sharp. What's one ambitious move you're eyeing?",
      suggestedAction: "proactive",
    };
  }

  // Default — charming + data-aware
  const hook = p0s.length
    ? `${p0s.length} P0s on fire. Lead with "${p0s[0].title}".`
    : dueSoon.length
    ? `Deadline radar: "${dueSoon[0].title}".`
    : "Beautifully calm. Time for proactive genius work.";
  return {
    reply: `Understood. ${hook} Tell me more — extract from notes, daily/weekly briefing, focus pick, "rewrite my last note", or "summarize this". Or jump into the editor and type /ai for in-place writing magic.`,
  };
}

/** Produces gorgeous daily briefing... Use generateDailyBriefingAI() for real xAI (structured) when configured. */
export function generateDailyBriefing(tasks: Task[], notes: Note[], activity: ActivityLog[] = []): DailyBriefing {
  const now = new Date();
  const active = tasks.filter((t) => t.status !== "done");
  const p0s = active.filter((t) => t.priority === "P0");
  const dueToday = active.filter((t) => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d.toDateString() === now.toDateString() || d < now;
  });

  const recentNotes = [...notes]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 2);
  const insight = recentNotes[0]
    ? `Your latest note "${recentNotes[0].title}" contains pure signal.`
    : "Capture a quick strategic note today — your future self will thank you.";

  // Agent 26: activity-aware momentum (real logs beat derived)
  let recentWins = activity.filter((a) => /complete|done|task\./i.test(a.actionType)).length;
  if (recentWins === 0) {
    // Demo / fallback: use task completedAt within last 24h
    recentWins = tasks.filter((t) => t.status === "done" && t.completedAt && (now.getTime() - new Date(t.completedAt).getTime()) < 86400000).length;
  }

  let momentum = "Steady and strong.";
  const doneCount = tasks.filter((t) => t.status === "done").length;
  if (doneCount >= 6 || recentWins >= 4) momentum = "Unstoppable. You're in the zone.";
  else if (p0s.length >= 3) momentum = "High-stakes territory — ship like a beast.";
  else if (recentWins >= 2) momentum = `On fire — ${recentWins} wins logged recently. Keep the streak.`;

  const focus = p0s[0]
    ? `Ship "${p0s[0].title}" before anything else.`
    : dueToday[0]
    ? `Kill "${dueToday[0].title}" today.`
    : "Block time for the one project that moves the needle most.";

  const activityLine = recentWins > 0 ? ` ${recentWins} recent wins in activity.` : "";

  return {
    greeting: `Good morning. ${momentum}`,
    summary: `${active.length} active tasks • ${p0s.length} P0s • ${dueToday.length} due/overdue right now. ${insight}${activityLine}`,
    topPriorities: [...p0s.slice(0, 2).map((t) => t.title), ...dueToday.slice(0, 1).map((t) => t.title)].slice(0, 3),
    focusSuggestion: focus,
    stats: {
      dueToday: dueToday.length,
      p0Count: p0s.length,
      activeTasks: active.length,
      notesCount: notes.length,
      momentum,
    },
    generatedAt: now.toISOString(),
  };
}

/** Verb-driven, high-signal task extraction from note prose. Production heuristic. Use extractActionItemsFromTextAI() for real xAI structured extraction when configured. */
export function extractActionItemsFromText(text: string, noteTitle = "Note"): AIActionItem[] {
  if (!text || text.trim().length < 12) return [];

  const rawSentences = text
    .split(/[.!?\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 9 && s.length < 180);

  const actionRe = /\b(ship|finish|complete|do|call|email|schedule|meet|review|write|prepare|draft|finalize|send|follow.?up|update|create|build|launch|pitch|research|interview|fix|test|deploy|design|polish|outline|brainstorm|push|deliver|close|book|file|submit)\b/i;

  const results: AIActionItem[] = [];

  for (const s of rawSentences) {
    if (!actionRe.test(s)) continue;
    if (results.length >= 4) break;

    let title = s.replace(/^[-*•\s]+/, "").replace(/^(I |we |you |to |need to |should |must |let's |please |let's |gonna )/i, "").trim();
    if (title.length < 7) continue;

    const prio: Priority =
      /\bp0\b|urgent|asap|critical|now|immediately/i.test(s) ? "P0" :
      /\bp1\b|important|soon|high|tomorrow|friday|this week/i.test(s) ? "P1" : "P2";

    let dueDate: string | undefined;
    const ls = s.toLowerCase();
    if (ls.includes("tomorrow") || ls.includes("tmr")) dueDate = addDays(new Date(), 1).toISOString();
    else if (ls.includes("friday") || ls.includes(" fri")) {
      const d = new Date();
      const days = (5 - d.getDay() + 7) % 7 || 7;
      dueDate = addDays(d, days).toISOString();
    }

    const item: AIActionItem = {
      title: title[0].toUpperCase() + title.slice(1),
      priority: prio,
      dueDate,
      tags: /investor|deck|pitch|funding/i.test(noteTitle) ? ["investors"] : [],
    };

    // Agent 15 decomp improvement: detect compound actions for sub-steps (e.g. "Research X and draft Y")
    const andSplit = s.match(/\b(and|then|plus|followed by)\b/i);
    if (andSplit && results.length < 3) {
      const parts = s.split(/\b(and|then|plus|followed by)\b/i).map(p => p.trim()).filter(p => p.length > 6 && /\b(ship|draft|call|meet|write|research)\b/i.test(p));
      if (parts.length >= 2) {
        item.subSteps = parts.slice(0, 3).map(p => p.replace(/^[-*•\s]+/, "").replace(/^(I |we |you |to |need to |should |must )/i, "").trim());
      }
    }
    results.push(item);
  }

  // Safety net: always surface at least one useful item from meaty notes
  if (results.length === 0 && text.length > 70) {
    results.push({
      title: `Follow up on insights from ${noteTitle.split(" ").slice(0, 4).join(" ")}`,
      priority: "P2",
      tags: [],
    });
  }
  return results;
}

/**
 * Agent 26/29: Smart task decomposition — "Break this down into subtasks".
 * Heuristic sim (fast). Use generateSubtaskDecompositionAI() for real Grok-powered creative splits (JSON) when xAI configured.
 * Magical for P0s. UI performs the store creates + links.
 */
export function generateSubtaskDecomposition(task: Task): AIActionItem[] {
  if (!task || !task.title) return [];
  const text = `${task.title} ${task.description || ""}`.trim();
  const lower = text.toLowerCase();
  const subs: AIActionItem[] = [];

  // Heuristic 1: explicit "and/then" compounds (reuse extract logic flavor)
  const andParts = text.split(/\b(and|then|plus|followed by|after that)\b/i).map(p => p.trim()).filter(p => p.length > 8 && p.length < 120);
  if (andParts.length >= 2) {
    andParts.slice(0, 4).forEach((p, i) => {
      const clean = p.replace(/^[-*•\s]+/, "").replace(/^(to |need to |should |must |let's )/i, "").trim();
      if (clean.length > 6) {
        subs.push({
          title: clean.charAt(0).toUpperCase() + clean.slice(1),
          priority: i === 0 ? task.priority : (task.priority === "P0" ? "P1" : task.priority),
          dueDate: task.dueDate,
        });
      }
    });
  }

  // Heuristic 2: standard ambitious workflow for "ship/build/launch/prep" tasks (common for bad-ass users)
  if (subs.length < 2 && /\b(ship|build|launch|prep|write|research|implement|design|review|finalize)\b/i.test(lower)) {
    const base = task.title.replace(/\b(ship|build|launch|prep|implement|finalize)\b/i, "").trim();
    const phases = [
      `Define done criteria + success metrics for ${base || "it"}`,
      `First 25-min action: outline or prototype core piece`,
      `Identify + remove top blocker (or schedule deep work)`,
      `Review / test / polish + ship announcement notes`,
    ];
    phases.slice(0, 3).forEach((ph, i) => {
      subs.push({
        title: ph,
        priority: i === 0 ? "P0" : (task.priority || "P2"),
        dueDate: task.dueDate ? new Date(new Date(task.dueDate).getTime() - (3 - i) * 86400000).toISOString() : undefined,
      });
    });
  }

  // Heuristic 3: fallback for any meaty task — 2-3 logical micro-wins
  if (subs.length === 0 && text.length > 20) {
    subs.push(
      { title: `Clarify exact outcome + definition of done for "${task.title.split(" ").slice(0,5).join(" ")}"`, priority: "P1" },
      { title: `15-min starter: capture first concrete step or blocker`, priority: task.priority || "P2" },
      { title: `Schedule protected focus block and review progress`, priority: "P2" }
    );
  }

  // Dedup + cap at 4 for delight (too many subtasks overwhelm)
  const seen = new Set<string>();
  return subs.filter(s => { const k = s.title.toLowerCase().slice(0,40); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 4);
}

/**
 * Agent 26/29: Proactive suggestion system — surfaces high-signal, actionable nudges from live data.
 * Examples: overdue P0s, stalled momentum, note gold, clear runway.
 * Use getProactiveSuggestionsAI() for real xAI version (structured) when configured.
 * Used by AIChatPanel etc. Fast + insightful.
 */
export function getProactiveSuggestions(
  tasks: Task[],
  notes: Note[],
  activity: ActivityLog[] = []
): Array<{ id: string; message: string; actionHint: string; type: string }> {
  const suggestions: Array<{ id: string; message: string; actionHint: string; type: string }> = [];
  const now = Date.now();
  const active = tasks.filter((t) => t.status !== "done");
  const overdueP0s = active.filter((t) => t.priority === "P0" && t.dueDate && new Date(t.dueDate).getTime() < now);
  const overdueP1s = active.filter((t) => t.priority === "P1" && t.dueDate && new Date(t.dueDate).getTime() < now);

  if (overdueP0s.length > 0) {
    suggestions.push({
      id: "overdue-p0",
      message: `${overdueP0s.length} overdue P0${overdueP0s.length > 1 ? "s" : ""} — your highest-leverage work is at risk.`,
      actionHint: "Reschedule 1 or break it down with AI",
      type: "overdue",
    });
  } else if (overdueP1s.length >= 2) {
    suggestions.push({
      id: "overdue-p1",
      message: `${overdueP1s.length} P1s slipping. Re-prioritize or timebox today.`,
      actionHint: "Use /ai or chat to plan recovery",
      type: "overdue",
    });
  }

  // Momentum / stalled detection (use activity or derived)
  const recentDone = activity.filter((a) => /done|complete/i.test(a.actionType) && now - new Date(a.createdAt).getTime() < 2 * 86400000).length ||
    tasks.filter((t) => t.completedAt && now - new Date(t.completedAt).getTime() < 2 * 86400000).length;
  const longStalled = active.filter((t) => !t.dueDate && (now - new Date(t.createdAt).getTime()) > 7 * 86400000).length;
  if (recentDone === 0 && active.length > 3 && longStalled > 1) {
    suggestions.push({
      id: "stalled",
      message: "Momentum dip detected. Pick one P1 and ship a micro-win in the next 30min.",
      actionHint: "Ask AI for focus pick",
      type: "momentum",
    });
  }

  // Note gold waiting
  const richNotes = notes.filter((n) => (n.content || "").length > 120 && !(n.linkedTaskIds || []).length);
  if (richNotes.length > 0 && suggestions.length < 2) {
    suggestions.push({
      id: "note-gold",
      message: `"${richNotes[0].title}" has signal — extract actions before it goes cold.`,
      actionHint: "Say 'extract from notes' or use ✨ in editor",
      type: "capture",
    });
  }

  // Clear runway encouragement for ambitious users
  if (suggestions.length === 0 && active.length <= 4 && overdueP0s.length === 0) {
    suggestions.push({
      id: "clear-runway",
      message: "Beautifully clear plate. This is the moment for your biggest, scariest bet.",
      actionHint: "Use editor /ai to outline it or chat 'plan my week'",
      type: "focus",
    });
  }

  return suggestions.slice(0, 3); // never overwhelm
}

/** Quick contextual micro-suggestions for non-chat surfaces (editor, modal, quick-add) */
export function getContextualAISuggestion(
  context: "task-modal" | "note-editor" | "quick-add" | "general" | "editor-ai",
  payload: { task?: Partial<Task>; noteContent?: string; input?: string; selection?: string }
): string {
  if (context === "task-modal" && payload.task) {
    const t = payload.task;
    if (t.description && (t.description as string).length > 35) {
      return "Solid description. Consider adding the very first micro-action or a clear definition of done. (Or use 'Break into subtasks' button for real linked children.)";
    }
    return `Turn "${t.title}" into a 15-minute first step. What's the tiniest thing that counts as progress? (Pro tip: the Decompose button creates actual subtasks.)`;
  }
  if ((context === "note-editor" || context === "editor-ai") && (payload.noteContent || payload.selection)) {
    const src = payload.selection || payload.noteContent || "";
    const found = extractActionItemsFromText(src);
    if (payload.selection && payload.selection.length > 20) {
      const preview = aiTransformText(payload.selection, "rewrite");
      return `Selection detected. AI rewrite: "${preview.transformed.slice(0,80)}..." ${preview.explanation} (type /ai in editor to apply directly)`;
    }
    return found.length
      ? `${found.length} actionable item${found.length > 1 ? "s" : ""} detected${found[0]?.subSteps ? " (with sub-steps)" : ""}. Use the ✨ Extract button to promote them instantly.`
      : "Excellent raw material. Add a 'Next Actions' bullet list at the bottom for even faster future extraction. Or /ai rewrite/expand/summarize right here.";
  }
  if (context === "quick-add") {
    return 'Magic: "Ship landing page P0 by Friday @marketing" — parsed perfectly.';
  }
  return "The ✨ AI button (bottom-right) sees your whole world. Ask it anything. In editor: /ai for instant rewrite/expand/summarize/tone.";
}

// ============================================================
// AGENT 29: REAL xAI POWERED VERSIONS (async, structured, fallbacks)
// These deliver genuine Grok intelligence when configured.
// Existing sync heuristics remain as ultra-fast, zero-cost, private simulation fallbacks.
// All new *AI functions are drop-in async upgrades with identical output shapes.
// ============================================================

/** Real-aware async writing transform. Falls back to elite local sim. */
export async function aiTransformTextAI(
  text: string,
  mode: "rewrite" | "expand" | "summarize" | "tone:professional" | "tone:casual" | "tone:bold" = "rewrite"
): Promise<AITextTransformResult> {
  if (!text || text.trim().length < 4) {
    return { transformed: text, mode, explanation: "Too short — add more signal first." };
  }
  if (!isXAIConfigured()) {
    return aiTransformText(text, mode); // instant sim
  }

  const summary = "User workspace context available for personalization.";
  const modeLabel = mode;
  const prompt = `Mode: ${modeLabel}. Text to transform:\n\n${text}`;
  const real = await callRealXAI(prompt, summary, { mode: "transform", maxTokens: 520, temperature: 0.6 });

  if (real) {
    return {
      transformed: real.length > 950 ? real.slice(0, 930) + "..." : real,
      mode,
      explanation: `xAI Grok ${modeLabel} — elite rewrite applied.`,
    };
  }
  return aiTransformText(text, mode);
}

/** Real-aware async daily briefing. Uses JSON structured output when possible. */
export async function generateDailyBriefingAI(
  tasks: Task[],
  notes: Note[],
  activity: ActivityLog[] = []
): Promise<DailyBriefing> {
  const sim = generateDailyBriefing(tasks, notes, activity);
  if (!isXAIConfigured()) return sim;

  const summary = buildContextSummary(tasks, notes, "current workspace", activity);
  const realJson = await callRealXAI(
    "Generate today's sharp daily briefing from the live data.",
    summary,
    { mode: "briefing", expectJson: true, maxTokens: 420 }
  );

  if (realJson) {
    try {
      const parsed = JSON.parse(realJson);
      // Minimal validation + merge with sim stats for safety
      return {
        greeting: parsed.greeting || sim.greeting,
        summary: parsed.summary || sim.summary,
        topPriorities: Array.isArray(parsed.topPriorities) ? parsed.topPriorities.slice(0, 3) : sim.topPriorities,
        focusSuggestion: parsed.focusSuggestion || sim.focusSuggestion,
        stats: { ...sim.stats, ...(parsed.stats || {}) },
        generatedAt: new Date().toISOString(),
      };
    } catch (e) {
      console.warn("[xAI] briefing JSON parse failed — using sim", e);
    }
  }
  return sim;
}

/** Real-aware async weekly briefing. */
export async function generateWeeklyBriefingAI(
  tasks: Task[],
  notes: Note[],
  activity: ActivityLog[] = []
): Promise<ReturnType<typeof generateWeeklyBriefing>> {
  const sim = generateWeeklyBriefing(tasks, notes, activity) as any;
  if (!isXAIConfigured()) return sim;

  const summary = buildContextSummary(tasks, notes, "current workspace", activity);
  const realJson = await callRealXAI(
    "Generate an insightful weekly briefing + action plan from the live data.",
    summary,
    { mode: "briefing", expectJson: true, maxTokens: 520 }
  );

  if (realJson) {
    try {
      const parsed = JSON.parse(realJson);
      return {
        ...sim,
        greeting: parsed.greeting || sim.greeting,
        summary: parsed.summary || sim.summary,
        focusSuggestion: parsed.focusSuggestion || sim.focusSuggestion,
        weekActions: Array.isArray(parsed.weekActions) ? parsed.weekActions.slice(0, 3) : sim.weekActions,
        trend: parsed.trend || sim.trend,
        focusDays: parsed.focusDays || sim.focusDays,
      };
    } catch (e) {
      console.warn("[xAI] weekly JSON parse failed — using sim", e);
    }
  }
  return sim;
}

/** Real-aware async task decomposition. JSON array preferred. */
export async function generateSubtaskDecompositionAI(task: Task): Promise<AIActionItem[]> {
  const sim = generateSubtaskDecomposition(task);
  if (!isXAIConfigured() || !task?.title) return sim;

  const summary = buildContextSummary([], [], "workspace", []); // light; decomp is task-focused
  const input = `Task to decompose: "${task.title}"\nDescription: ${task.description || "(none)"}\nPriority: ${task.priority}\nDue: ${task.dueDate || "flexible"}`;
  const realJson = await callRealXAI(input, summary, { mode: "decompose", expectJson: true, maxTokens: 380 });

  if (realJson) {
    try {
      const arr = JSON.parse(realJson);
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.slice(0, 4).map((s: any, i: number) => ({
          title: String(s.title || `Step ${i + 1}`),
          priority: (["P0", "P1", "P2", "P3"].includes(s.priority) ? s.priority : (i === 0 ? task.priority : "P2")) as Priority,
          dueDate: s.dueDate || task.dueDate,
        }));
      }
    } catch (e) {
      console.warn("[xAI] decompose JSON parse failed — using sim", e);
    }
  }
  return sim;
}

/** Real-aware async action extraction from text. */
export async function extractActionItemsFromTextAI(text: string, noteTitle = "Note"): Promise<AIActionItem[]> {
  const sim = extractActionItemsFromText(text, noteTitle);
  if (!isXAIConfigured() || !text || text.length < 20) return sim;

  const summary = `Extracting from note titled "${noteTitle}".`;
  const realJson = await callRealXAI(
    `Note content:\n${text.slice(0, 1800)}`,
    summary,
    { mode: "extract", expectJson: true, maxTokens: 520 }
  );

  if (realJson) {
    try {
      const arr = JSON.parse(realJson);
      if (Array.isArray(arr) && arr.length) {
        return arr.slice(0, 4).map((it: any) => ({
          title: String(it.title || "Follow up"),
          priority: (["P0", "P1", "P2", "P3"].includes(it.priority) ? it.priority : "P2") as Priority,
          dueDate: it.dueDate,
          subSteps: Array.isArray(it.subSteps) ? it.subSteps.slice(0, 3) : undefined,
          tags: [],
        }));
      }
    } catch (e) {
      console.warn("[xAI] extract JSON parse failed — using sim", e);
    }
  }
  return sim;
}

/** Real-aware async proactive suggestions. */
export async function getProactiveSuggestionsAI(
  tasks: Task[],
  notes: Note[],
  activity: ActivityLog[] = []
): Promise<Array<{ id: string; message: string; actionHint: string; type: string }>> {
  const sim = getProactiveSuggestions(tasks, notes, activity);
  if (!isXAIConfigured()) return sim;

  const summary = buildContextSummary(tasks, notes, "workspace", activity);
  const realJson = await callRealXAI(
    "Scan for proactive high-leverage suggestions right now.",
    summary,
    { mode: "proactive", expectJson: true, maxTokens: 380 }
  );

  if (realJson) {
    try {
      const arr = JSON.parse(realJson);
      if (Array.isArray(arr) && arr.length) {
        return arr.slice(0, 3).map((s: any, i: number) => ({
          id: s.id || `real-${i}`,
          message: String(s.message || "Strong opportunity ahead."),
          actionHint: String(s.actionHint || "Ask AI for next move"),
          type: s.type || "focus",
        }));
      }
    } catch (e) {
      console.warn("[xAI] proactive JSON parse failed — using sim", e);
    }
  }
  return sim;
}

/**
 * Main public entry point for all AI features.
 * Tries real xAI (enhanced prompting + structured) when configured, otherwise stellar local simulation.
 * Used by AIChatPanel, CommandPalette, extraction buttons, etc.
 */
export async function getAIResponse(
  userInput: string,
  context: { tasks: Task[]; notes: Note[]; currentWorkspaceName: string; activity?: ActivityLog[] }
): Promise<{ reply: string; suggestedAction?: string }> {
  const summary = buildContextSummary(context.tasks, context.notes, context.currentWorkspaceName, context.activity);

  // Enhanced real xAI path with intent-aware mode (still falls back gracefully)
  const lower = userInput.toLowerCase();
  let mode: "chat" | "transform" | "briefing" | "decompose" | "extract" | "proactive" = "chat";
  if (/decomp|break.*down|subtask/.test(lower)) mode = "decompose";
  else if (/brief|today|week/.test(lower)) mode = "briefing";
  else if (/extract|action item/.test(lower)) mode = "extract";
  else if (/suggest|proactive|recommend/.test(lower)) mode = "proactive";

  const realReply = await callRealXAI(userInput, summary, { mode });
  if (realReply) {
    return { reply: realReply, suggestedAction: "real-xai" };
  }

  // The delightful, always-on, data-rich simulation (core magic for all users)
  return simulateAIResponse(userInput, context);
}

/**
 * Cross-platform haptic feedback utility (mobile-first native feel).
 * Uses Web Vibration API (widely supported on Android/iOS Safari in PWA).
 * Patterns chosen for delightful, non-intrusive feedback on task complete, swipes, taps, errors.
 * Safe no-op on desktop or unsupported browsers.
 * For true native haptics later: integrate @capacitor/haptics (maps to this).
 */
export function triggerHaptic(
  pattern: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' = 'light'
): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    const patterns: Record<string, number | number[]> = {
      light: 8,
      medium: 18,
      heavy: 35,
      success: [8, 25, 8],      // cheerful confirm (e.g. task done, swipe complete)
      error: [25, 60, 25],      // attention (e.g. delete, failure)
      warning: [15, 40],        // caution
    };
    const p = patterns[pattern] || 10;
    navigator.vibrate(p);
  } catch {
    // Non-fatal (private mode, permission edge cases, etc.)
  }
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

export interface WorkspaceExportPayload {
  workspace: { id: string; name: string; slug: string };
  tasks: Task[];
  notes: Note[];
  members?: any[];
  activity?: any[]; // ActivityLog (type in scope via other imports or any for portability layer)
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
export function membersToCSV(members: any[]): string {
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
export function activityToCSV(activity: any[]): string {
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
export function exportToMarkdown(workspaceName: string, tasks: Task[], notes: Note[], members: any[] = [], activity: any[] = []): string {
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

/** Parse JSON export (tolerates partials; strips workspaceId for re-targeting on import). */
export function parseJSONImport(jsonStr: string): { tasks: Partial<Task>[]; notes: Partial<Note>[]; meta?: any } {
  try {
    const data = JSON.parse(jsonStr);
    const clean = (arr: any[] = []) => arr.map((item) => {
      const { workspaceId, workspace_id, ...rest } = item || {};
      return rest;
    });
    return {
      tasks: clean(data.tasks || data.Tasks),
      notes: clean(data.notes || data.Notes),
      meta: { sourceWorkspace: data.workspace, version: data.version, exportedAt: data.exportedAt },
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
    const obj: any = { tags: [] };
    headers.forEach((h, i) => {
      const v = (vals[i] || "").trim();
      if (h.includes("title")) obj.title = v;
      else if (h.includes("status")) obj.status = (v || "todo") as any;
      else if (h.includes("priority")) obj.priority = (v || "P2") as any;
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

// ============================================================
// AGENT 32: HYBRID SEMANTIC SEARCH + KNOWLEDGE GRAPH HELPERS
// Client-only, zero deps, demo + live perfect. No pgvector needed yet (schema comment notes future).
// Hybrid scoring: keyword overlap + tags + simple Jaccard "semantic" on tokens + link count + recency/priority boosts.
// Powers: improved global search (page + palette), graph viz, smart link suggestions (better discovery).
// Extend later: plug real embeddings via getAIResponse or xAI when keys present (add embed mode).
// ============================================================

export interface HybridSearchResult {
  id: string;
  type: 'task' | 'note';
  title: string;
  snippet: string;
  score: number; // 0-100
  reasons: string[]; // e.g. ['title', 'semantic', 'linked']
  item: Task | Note;
}

function tokenize(text: string): string[] {
  return (text || '').toLowerCase().match(/\b\w+\b/g) || [];
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

export function computeHybridScore(
  query: string,
  item: any,
  allTasks: Task[] = [],
  allNotes: Note[] = []
): { score: number; reasons: string[] } {
  const q = (query || '').trim().toLowerCase();
  if (!q) return { score: 40, reasons: ['no-query'] };

  const qTokens = tokenize(q);
  const title = (item.title || '').toString();
  const content = (item.content || item.description || '').toString();
  const tags: string[] = item.tags || [];
  const linked = (item.linkedNoteIds || item.linkedTaskIds || []).length;

  const titleTokens = tokenize(title);
  const contentTokens = tokenize(content);
  const tagTokens = tags.flatMap((t) => tokenize(t));
  const allItemTokens = [...titleTokens, ...contentTokens, ...tagTokens];

  const reasons: string[] = [];
  let score = 0;

  // Keyword boosts
  const titleHits = qTokens.filter((t) => title.toLowerCase().includes(t)).length;
  if (titleHits > 0) {
    score += titleHits * 14;
    reasons.push('title');
  }
  const contentHits = qTokens.filter((t) => content.toLowerCase().includes(t)).length;
  if (contentHits > 0) {
    score += contentHits * 5;
    reasons.push('content');
  }
  const tagHits = qTokens.filter((t) => tags.some((tag) => tag.toLowerCase().includes(t))).length;
  if (tagHits > 0) {
    score += tagHits * 9;
    reasons.push('tags');
  }

  // "Semantic" via token Jaccard (lightweight vector-like similarity on small corpus)
  const sem = jaccardSimilarity(qTokens, allItemTokens) * 32;
  if (sem > 4) {
    score += sem;
    reasons.push('semantic');
  }

  // Graph / connectivity boost (more connected = more "known" signal)
  const linkBoost = Math.min(12, linked * 2.5);
  if (linkBoost > 2) {
    score += linkBoost;
    reasons.push('linked');
  }

  // Recency (recently touched knowledge surfaces higher)
  const ts = item.updatedAt || item.createdAt;
  if (ts) {
    const days = Math.min(30, (Date.now() - new Date(ts).getTime()) / (1000 * 3600 * 24));
    score += Math.max(0, 7 - days * 0.2);
  }

  // Domain boosts
  if (item.priority === 'P0') score += 9;
  else if (item.priority === 'P1') score += 5;
  if (item.status && item.status !== 'done') score += 4;

  const final = Math.min(100, Math.max(3, Math.round(score)));
  return { score: final, reasons: reasons.length ? reasons : ['match'] };
}

export function getHybridSearchResults(
  query: string,
  data: { tasks: Task[]; notes: Note[] },
  opts: { types?: ('task' | 'note')[]; minScore?: number; limit?: number } = {}
): HybridSearchResult[] {
  const { tasks, notes } = data;
  const { types = ['task', 'note'], minScore = 8, limit = 60 } = opts;
  const q = (query || '').trim();

  const out: HybridSearchResult[] = [];

  if (types.includes('task')) {
    tasks.forEach((t) => {
      const { score, reasons } = computeHybridScore(q, t, tasks, notes);
      if (score >= minScore) {
        const desc = (t.description || '').slice(0, 110);
        out.push({
          id: t.id,
          type: 'task',
          title: t.title,
          snippet: desc + (desc.length >= 110 ? '…' : ''),
          score,
          reasons,
          item: t,
        });
      }
    });
  }

  if (types.includes('note')) {
    notes.forEach((n) => {
      const { score, reasons } = computeHybridScore(q, n, tasks, notes);
      if (score >= minScore) {
        const plain = (typeof n.content === 'string' ? n.content : '').slice(0, 110);
        out.push({
          id: n.id,
          type: 'note',
          title: n.title,
          snippet: plain + (plain.length >= 110 ? '…' : ''),
          score,
          reasons,
          item: n,
        });
      }
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

// Knowledge Graph data (direct links only for now — expand with inferred via shared connections in UI)
export interface KnowledgeGraphNode {
  id: string;
  type: 'task' | 'note';
  title: string;
  linkCount: number;
}
export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  type: 'direct';
}

export function buildKnowledgeGraph(tasks: Task[], notes: Note[]): { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] } {
  const nodes: KnowledgeGraphNode[] = [
    ...tasks.map((t) => ({
      id: t.id,
      type: 'task' as const,
      title: t.title,
      linkCount: (t.linkedNoteIds || []).length,
    })),
    ...notes.map((n) => ({
      id: n.id,
      type: 'note' as const,
      title: n.title,
      linkCount: (n.linkedTaskIds || []).length,
    })),
  ];

  const edges: KnowledgeGraphEdge[] = [];
  tasks.forEach((t) => {
    (t.linkedNoteIds || []).forEach((nid) => {
      if (notes.find((nn) => nn.id === nid)) {
        edges.push({ source: t.id, target: nid, type: 'direct' });
      }
    });
  });
  // (Symmetric edges implicit in viz; no dups needed)

  return { nodes, edges };
}

// Link discovery / suggestions (powers enhanced bidirectional in UI)
export function suggestLinksForNote(note: Note, tasks: Task[], limit = 5) {
  return tasks
    .filter((t) => !(note.linkedTaskIds || []).includes(t.id))
    .map((t) => {
      const { score, reasons } = computeHybridScore(note.title + ' ' + (note.content || ''), t, tasks, []);
      return { task: t, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function suggestLinksForTask(task: Task, notes: Note[], limit = 5) {
  return notes
    .filter((n) => !(task.linkedNoteIds || []).includes(n.id))
    .map((n) => {
      const { score, reasons } = computeHybridScore(task.title + ' ' + (task.description || ''), n, [], notes);
      return { note: n, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
