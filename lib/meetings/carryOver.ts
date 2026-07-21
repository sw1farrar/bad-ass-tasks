import type { Meeting, MeetingAgendaEntry, MeetingAgendaItem } from "@/types";
import { generateId } from "@/lib/utils";
import { sortMeetingEntriesChronological } from "@/lib/meetings/meetingFilters";

export interface CarryOverOptions {
  includeContinued: boolean;
  includeOpen: boolean;
}

export const DEFAULT_CARRY_OVER_OPTIONS: CarryOverOptions = {
  includeContinued: true,
  includeOpen: true,
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

/** Meetings that already had topics carried forward into a newer meeting. */
export function getMeetingsAlreadyCarriedForward(meetings: Meeting[]): Set<string> {
  return new Set(
    meetings
      .map((meeting) => meeting.previousMeetingId)
      .filter((id): id is string => Boolean(id)),
  );
}

export function hasCarryOverEligibleItems(
  meetingId: string,
  items: MeetingAgendaItem[],
  options: CarryOverOptions = DEFAULT_CARRY_OVER_OPTIONS,
): boolean {
  const meetingItems = items.filter((item) => item.meetingId === meetingId);
  return getCarryOverSourceItems(meetingItems, options).length > 0;
}

export function hasMeetingBeenCarriedForward(
  meetingId: string,
  meetings: Meeting[],
): boolean {
  return getMeetingsAlreadyCarriedForward(meetings).has(meetingId);
}

/** Meetings that still have carry-over topics and have not been used as a source yet. */
export function getCarryOverCandidateMeetings(
  meetings: Meeting[],
  items: MeetingAgendaItem[],
  options: CarryOverOptions = DEFAULT_CARRY_OVER_OPTIONS,
): Meeting[] {
  const alreadyUsed = getMeetingsAlreadyCarriedForward(meetings);
  return meetings.filter(
    (meeting) =>
      !alreadyUsed.has(meeting.id) &&
      hasCarryOverEligibleItems(meeting.id, items, options),
  );
}

export function buildNextMeetingTitle(previous: Meeting): string {
  const base =
    previous.title.replace(/\s*[-—]\s*[^-—]+,\s*\d{4}.*$/, "").trim() || previous.title;
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
  idFactory: () => string = generateId,
): MeetingAgendaItem[] {
  const now = new Date().toISOString();
  return sourceItems.map((item, index) => ({
    id: idFactory(),
    meetingId: newMeetingId,
    title: item.title,
    description: item.description ?? null,
    sortOrder: startSortOrder + index * 1000,
    ownerId: item.ownerId ?? null,
    ownerName: item.ownerName ?? null,
    status: "open" as const,
    reviewed: false,
    continuedFromItemId: item.id,
    linkedTaskIds: [...(item.linkedTaskIds ?? [])],
    timeBudgetMinutes: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }));
}

export function cloneCarryOverEntries(
  sourceEntries: MeetingAgendaEntry[],
  clonedItems: MeetingAgendaItem[],
  idFactory: () => string = generateId,
): MeetingAgendaEntry[] {
  const itemIdMap = new Map(
    clonedItems
      .filter((item) => item.continuedFromItemId)
      .map((item) => [item.continuedFromItemId!, item.id]),
  );

  return sortMeetingEntriesChronological(
    sourceEntries.filter((entry) => itemIdMap.has(entry.agendaItemId)),
  ).map((entry) => ({
    id: idFactory(),
    agendaItemId: itemIdMap.get(entry.agendaItemId)!,
    body: entry.body,
    authorId: entry.authorId ?? null,
    isDecision: entry.isDecision ?? false,
    createdAt: entry.createdAt,
  }));
}