import type { MeetingAgendaEntry, MeetingAgendaItem } from "@/types";
import { generateId } from "@/lib/utils";
import { sortAgendaItems, sortMeetingEntriesChronological } from "@/lib/meetings/meetingFilters";

export const DUPLICATE_MEETING_TITLE = "New meeting";

export interface DuplicateMeetingOptions {
  /** Title for the new meeting. Defaults to {@link DUPLICATE_MEETING_TITLE}. */
  title?: string;
  /** ISO scheduled date for the new meeting. Defaults to now when omitted. */
  scheduledAt?: string | null;
  includeNotes: boolean;
  /** When set, only these source agenda item ids are copied. */
  agendaItemIds?: string[];
}

export const DEFAULT_DUPLICATE_MEETING_OPTIONS: DuplicateMeetingOptions = {
  includeNotes: false,
};

/** Pick source topics for a duplicate, optionally filtered by id. */
export function selectAgendaItemsForDuplicate(
  sourceItems: MeetingAgendaItem[],
  agendaItemIds?: string[],
): MeetingAgendaItem[] {
  const sorted = sortAgendaItems(sourceItems);
  if (!agendaItemIds) return sorted;
  const selected = new Set(agendaItemIds);
  return sorted.filter((item) => selected.has(item.id));
}

/** Clone every agenda topic into a new meeting as fresh open items. */
export function cloneMeetingAgendaItemsForDuplicate(
  sourceItems: MeetingAgendaItem[],
  newMeetingId: string,
  idFactory: () => string = generateId,
): { items: MeetingAgendaItem[]; idMap: Map<string, string> } {
  const now = new Date().toISOString();
  const idMap = new Map<string, string>();
  const items = sortAgendaItems(sourceItems).map((item, index) => {
    const id = idFactory();
    idMap.set(item.id, id);
    return {
      id,
      meetingId: newMeetingId,
      title: item.title,
      description: item.description ?? null,
      sortOrder: index * 1000,
      ownerId: item.ownerId ?? null,
      ownerName: item.ownerName ?? null,
      status: "open" as const,
      continuedFromItemId: null,
      linkedTaskIds: [...(item.linkedTaskIds ?? [])],
      timeBudgetMinutes: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  });
  return { items, idMap };
}

/** Clone topic notes remapped onto duplicated agenda item ids. */
export function cloneMeetingAgendaEntriesForDuplicate(
  sourceEntries: MeetingAgendaEntry[],
  idMap: Map<string, string>,
  idFactory: () => string = generateId,
): MeetingAgendaEntry[] {
  return sortMeetingEntriesChronological(
    sourceEntries.filter((entry) => idMap.has(entry.agendaItemId)),
  ).map((entry) => ({
    id: idFactory(),
    agendaItemId: idMap.get(entry.agendaItemId)!,
    body: entry.body,
    authorId: entry.authorId ?? null,
    isDecision: entry.isDecision ?? false,
    createdAt: entry.createdAt,
  }));
}
