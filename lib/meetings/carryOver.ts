import type { Meeting, MeetingAgendaItem } from "@/types";
import { generateId } from "@/lib/utils";

export interface CarryOverOptions {
  includeContinued: boolean;
  includeOpen: boolean;
}

export const DEFAULT_CARRY_OVER_OPTIONS: CarryOverOptions = {
  includeContinued: true,
  includeOpen: false,
};

export function getCarryOverSourceItems(
  items: MeetingAgendaItem[],
  options: CarryOverOptions,
): MeetingAgendaItem[] {
  return items.filter((item) => {
    if (options.includeContinued && item.status === "continued") return true;
    if (options.includeOpen && (item.status === "open" || item.status === "in_progress")) return true;
    return false;
  });
}

export function buildNextMeetingTitle(previous: Meeting): string {
  const base = previous.title.replace(/\s*—\s*.+$/, "").trim() || previous.title;
  const date = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${base} — ${date}`;
}

export function cloneCarryOverItems(
  sourceItems: MeetingAgendaItem[],
  newMeetingId: string,
  startSortOrder = 0,
): MeetingAgendaItem[] {
  const now = new Date().toISOString();
  return sourceItems.map((item, index) => ({
    id: generateId(),
    meetingId: newMeetingId,
    title: item.title,
    description: item.description ?? null,
    sortOrder: startSortOrder + index * 1000,
    ownerId: item.ownerId ?? null,
    status: "open" as const,
    continuedFromItemId: item.id,
    linkedTaskIds: [...(item.linkedTaskIds ?? [])],
    timeBudgetMinutes: item.timeBudgetMinutes ?? null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }));
}