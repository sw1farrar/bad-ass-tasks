import { addDays, nextFriday, nextMonday, nextSaturday, nextSunday, nextThursday, nextTuesday, nextWednesday } from "date-fns";
import { parseLocalDate, toDueDateStorage } from "@/lib/datetime";

export type ParsedInboundTaskDueDate = {
  dueDate: string;
  /** Body text with the due-date line removed. */
  bodyWithoutDueLine: string;
};

const DUE_LINE_RE = /^\s*due\s*:\s*(.+?)\s*$/i;

const RELATIVE_DUE: Record<string, (ref: Date) => Date> = {
  today: (ref) => ref,
  tomorrow: (ref) => addDays(ref, 1),
  "next week": (ref) => addDays(ref, 7),
  "next monday": (ref) => nextMonday(ref),
  "next tuesday": (ref) => nextTuesday(ref),
  "next wednesday": (ref) => nextWednesday(ref),
  "next thursday": (ref) => nextThursday(ref),
  "next friday": (ref) => nextFriday(ref),
  "next saturday": (ref) => nextSaturday(ref),
  "next sunday": (ref) => nextSunday(ref),
};

function startOfReferenceDay(reference = new Date()): Date {
  return new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
}

function parseDueValue(raw: string, reference = new Date()): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const relativeKey = trimmed.toLowerCase();
  const relativeFn = RELATIVE_DUE[relativeKey];
  if (relativeFn) {
    return toDueDateStorage(relativeFn(startOfReferenceDay(reference)));
  }

  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?$/i);
  if (iso) {
    const parsed = parseLocalDate(iso[1]);
    return parsed ? toDueDateStorage(parsed) : null;
  }

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const year = slash[3]
      ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3])
      : reference.getFullYear();
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) {
      return toDueDateStorage(parsed);
    }
  }

  const parsed = parseLocalDate(trimmed) ?? parseLocalDate(new Date(trimmed).toISOString());
  if (parsed) return toDueDateStorage(parsed);

  const natural = new Date(trimmed);
  if (!Number.isNaN(natural.getTime())) {
    return toDueDateStorage(
      new Date(natural.getFullYear(), natural.getMonth(), natural.getDate()),
    );
  }

  return null;
}

/**
 * Parse an optional due date from the first matching `Due: …` line in the email body.
 * That line is stripped from the returned description text.
 */
export function parseInboundTaskDueDate(
  body: string,
  reference = new Date(),
): ParsedInboundTaskDueDate | null {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let dueLineIndex = -1;
  let dueValue = "";

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(DUE_LINE_RE);
    if (match) {
      dueLineIndex = i;
      dueValue = match[1];
      break;
    }
  }

  if (dueLineIndex < 0) return null;

  const dueDate = parseDueValue(dueValue, reference);
  if (!dueDate) return null;

  const remaining = [...lines.slice(0, dueLineIndex), ...lines.slice(dueLineIndex + 1)]
    .join("\n")
    .replace(/^\n+/, "")
    .trim();

  return { dueDate, bodyWithoutDueLine: remaining };
}

export function buildInboundTaskDescription(body: string, senderLine?: string): string {
  const parsed = parseInboundTaskDueDate(body);
  const core = parsed?.bodyWithoutDueLine ?? body.trim();

  if (!core) {
    return senderLine ? `Created from email by ${senderLine}` : "";
  }

  if (senderLine) {
    return `${core}\n\n— ${senderLine}`;
  }

  return core;
}