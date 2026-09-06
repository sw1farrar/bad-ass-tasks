import { generateRecurringRule, parseRecurringRule } from "@/lib/utils";
import { normalizeCalendarDateKey, parseLocalDate, toDueDateStorage } from "@/lib/datetime";
import type { Priority, TaskStatus } from "@/types";
import type { ImportKind, MappedImportTask } from "@/features/import/types";
import { parseToodledoRepeat } from "./toodledoRepeat";

export type ToodledoCsvRow = {
  TASK?: string;
  FOLDER?: string;
  CONTEXT?: string;
  GOAL?: string;
  LOCATION?: string;
  STARTDATE?: string;
  STARTTIME?: string;
  DUEDATE?: string;
  DUETIME?: string;
  REPEAT?: string;
  LENGTH?: string;
  TIMER?: string;
  PRIORITY?: string;
  TAG?: string;
  STATUS?: string;
  STAR?: string;
  NOTE?: string;
  COMPLETED?: string;
};

const TOODLEDO_STATUS: Record<string, TaskStatus> = {
  completed: "done",
  cancelled: "done",
  canceled: "done",
  "next action": "todo",
  active: "doing",
  planning: "backlog",
  delegated: "todo",
  waiting: "todo",
  hold: "backlog",
  postponed: "backlog",
  someday: "backlog",
  none: "todo",
};

export function mapToodledoPriority(raw: string | null | undefined): Priority {
  const v = (raw ?? "").trim();
  if (v === "3") return "P0";
  if (v === "2") return "P1";
  if (v === "0" || v === "-1") return "P3";
  return "P2";
}

export function mapToodledoStar(raw: string | null | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "star";
}

export function mapToodledoTags(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function mapToodledoLength(raw: string | null | undefined): number | undefined {
  const n = parseInt((raw ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function fingerprintNoteKey(note: string): string {
  let hash = 0;
  for (let i = 0; i < note.length; i++) {
    hash = (Math.imul(hash, 31) + note.charCodeAt(i)) | 0;
  }
  return `${note.length}:${hash}`;
}

function calendarToStorage(raw: string | null | undefined): string | undefined {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return undefined;
  const parsed = parseLocalDate(trimmed);
  if (!parsed) return trimmed;
  return toDueDateStorage(parsed);
}

export function importFingerprint(input: {
  kind: ImportKind;
  title: string;
  dueDate?: string;
  completedAt?: string;
  folderName?: string | null;
  note?: string;
  disambiguator?: string;
}): string {
  return [
    "toodledo",
    input.kind,
    input.title.trim().toLowerCase(),
    (input.folderName ?? "").trim().toLowerCase(),
    input.dueDate ?? "",
    input.completedAt ?? "",
    fingerprintNoteKey(input.note ?? ""),
    input.disambiguator ?? "",
  ].join("|");
}

export function mapToodledoTask(row: ToodledoCsvRow, kind: ImportKind): MappedImportTask | null {
  const title = (row.TASK ?? "").trim();
  if (!title) return null;

  const rawDue = (row.DUEDATE ?? "").trim() || (row.STARTDATE ?? "").trim();
  const dueDate = calendarToStorage(row.DUEDATE) ?? calendarToStorage(row.STARTDATE);
  const completedAt = kind === "completed" ? calendarToStorage(row.COMPLETED) : undefined;
  const dueKey = /^\d{4}-\d{2}-\d{2}$/.test(rawDue)
    ? rawDue.slice(0, 10)
    : dueDate
      ? normalizeCalendarDateKey(dueDate)
      : "";
  const completedKey =
    kind === "completed"
      ? ((row.COMPLETED ?? "").trim().slice(0, 10) ||
        (completedAt ? normalizeCalendarDateKey(completedAt) : ""))
      : "";
  const folderName = (row.FOLDER ?? "").trim() || null;
  const description = (row.NOTE ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  let status: TaskStatus = kind === "completed" ? "done" : "todo";
  if (kind !== "completed") {
    const mapped = TOODLEDO_STATUS[(row.STATUS ?? "").trim().toLowerCase()];
    if (mapped && mapped !== "done") status = mapped;
  }

  let recurringRule: string | null | undefined;
  let unmappedRepeat: string | undefined;
  if (kind === "current") {
    const parsed = parseToodledoRepeat(row.REPEAT);
    if (parsed.unmapped) {
      unmappedRepeat = (row.REPEAT ?? "").trim();
    } else if (parsed.pattern && dueDate) {
      const seriesAnchor = /^\d{4}-\d{2}-\d{2}$/.test(rawDue) ? rawDue : undefined;
      const withAnchor = {
        ...parsed.pattern,
        ...(seriesAnchor ? { seriesAnchor } : {}),
      };
      recurringRule = generateRecurringRule(withAnchor);
    } else if (parsed.rule) {
      recurringRule = parsed.rule;
    }
  }

  return {
    title,
    description,
    status,
    priority: mapToodledoPriority(row.PRIORITY),
    dueDate,
    completedAt,
    recurringRule: recurringRule ?? null,
    starred: mapToodledoStar(row.STAR),
    tags: mapToodledoTags(row.TAG),
    timeEstimate: mapToodledoLength(row.LENGTH),
    folderName,
    fingerprint: importFingerprint({
      kind,
      title,
      dueDate: dueKey || dueDate,
      completedAt: completedKey || completedAt,
      folderName,
      note: description,
    }),
    unmappedRepeat,
  };
}

/** True when the mapped rule still parses (guards generate/parse drift). */
export function mappedRuleIsValid(task: MappedImportTask): boolean {
  if (!task.recurringRule) return true;
  return !!parseRecurringRule(task.recurringRule);
}
