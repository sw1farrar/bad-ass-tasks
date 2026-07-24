import { getMeetingsAlreadyCarriedForward } from "@/lib/meetings/carryOver";
import type { Meeting, MeetingAgendaEntry, MeetingAgendaItem, MeetingStatus } from "@/types";

export type MeetingListFilter = "all" | "mine" | "carryover";

export interface MeetingGroup {
  label: string;
  status: MeetingStatus;
  meetings: Meeting[];
}

export interface MeetingSearchContext {
  agendaItems?: MeetingAgendaItem[];
  agendaEntries?: MeetingAgendaEntry[];
}

function searchableText(value: string | null | undefined): string {
  return (value ?? "").replace(/<[^>]*>/g, " ").toLowerCase();
}

export function filterMeetingsBySearch(
  meetings: Meeting[],
  query: string,
  context: MeetingSearchContext = {},
): Meeting[] {
  const q = query.trim().toLowerCase();
  if (!q) return meetings;

  const items = context.agendaItems ?? [];
  const entries = context.agendaEntries ?? [];
  const itemsByMeeting = new Map<string, MeetingAgendaItem[]>();
  for (const item of items) {
    const list = itemsByMeeting.get(item.meetingId) ?? [];
    list.push(item);
    itemsByMeeting.set(item.meetingId, list);
  }
  const entriesByItem = new Map<string, MeetingAgendaEntry[]>();
  for (const entry of entries) {
    const list = entriesByItem.get(entry.agendaItemId) ?? [];
    list.push(entry);
    entriesByItem.set(entry.agendaItemId, list);
  }

  return meetings.filter((m) => {
    if (searchableText(m.title).includes(q)) return true;
    if (searchableText(m.description).includes(q)) return true;
    if ((m.attendees ?? []).some((name) => searchableText(name).includes(q))) return true;

    const meetingItems = itemsByMeeting.get(m.id) ?? [];
    for (const item of meetingItems) {
      if (searchableText(item.title).includes(q)) return true;
      if (searchableText(item.description).includes(q)) return true;
      if (searchableText(item.ownerName).includes(q)) return true;
      const itemEntries = entriesByItem.get(item.id) ?? [];
      if (itemEntries.some((entry) => searchableText(entry.body).includes(q))) return true;
    }
    return false;
  });
}

export function filterMeetingsByMode(
  meetings: Meeting[],
  filter: MeetingListFilter,
  userId?: string | null,
  agendaItems: MeetingAgendaItem[] = [],
): Meeting[] {
  if (filter === "all") return meetings;
  if (filter === "mine" && userId) {
    return meetings.filter(
      (m) => m.attendeeIds.includes(userId) || agendaItems.some(
        (item) => item.meetingId === m.id && item.ownerId === userId,
      ),
    );
  }
  if (filter === "carryover") {
    const alreadyUsed = getMeetingsAlreadyCarriedForward(meetings);
    const carryMeetingIds = new Set(
      agendaItems.filter((i) => i.status === "continued").map((i) => i.meetingId),
    );
    return meetings.filter((m) => carryMeetingIds.has(m.id) && !alreadyUsed.has(m.id));
  }
  return meetings;
}

function meetingListDate(meeting: Meeting): number {
  const value = meeting.scheduledAt ?? meeting.createdAt;
  return new Date(value).getTime();
}

function sortUpcomingMeetings(meetings: Meeting[]): Meeting[] {
  return [...meetings].sort((a, b) => {
    const aUndated = !a.scheduledAt;
    const bUndated = !b.scheduledAt;
    // Undated meetings sit at the top of the Upcoming queue.
    if (aUndated !== bUndated) return aUndated ? -1 : 1;
    if (aUndated && bUndated) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return meetingListDate(a) - meetingListDate(b);
  });
}

function sortMeetingsByDate(meetings: Meeting[], direction: "asc" | "desc"): Meeting[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...meetings].sort((a, b) => (meetingListDate(a) - meetingListDate(b)) * factor);
}

function isUpcomingMeeting(status: MeetingStatus): boolean {
  return status === "draft" || status === "scheduled" || status === "in_progress";
}

export function groupMeetingsByStatus(meetings: Meeting[]): MeetingGroup[] {
  const upcoming = sortUpcomingMeetings(
    meetings.filter((m) => isUpcomingMeeting(m.status)),
  );
  const past = sortMeetingsByDate(
    meetings.filter((m) => m.status === "completed"),
    "desc",
  );

  const groups: MeetingGroup[] = [];
  if (upcoming.length) groups.push({ label: "Upcoming", status: "scheduled", meetings: upcoming });
  if (past.length) groups.push({ label: "Past", status: "completed", meetings: past });
  return groups;
}

export function countOpenAgendaItems(
  meetingId: string,
  items: MeetingAgendaItem[],
): number {
  return items.filter(
    (i) => i.meetingId === meetingId && (i.status === "open" || i.status === "in_progress"),
  ).length;
}

export function countContinuedItems(
  meetingId: string,
  items: MeetingAgendaItem[],
): number {
  return items.filter((i) => i.meetingId === meetingId && i.status === "continued").length;
}

export function sortMeetings(meetings: Meeting[]): Meeting[] {
  return groupMeetingsByStatus(meetings).flatMap((group) => group.meetings);
}

export function sortAgendaItems(items: MeetingAgendaItem[]): MeetingAgendaItem[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Topic notes in the live meeting UI: most recent first. */
export function sortMeetingEntriesNewestFirst(entries: MeetingAgendaEntry[]): MeetingAgendaEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** Meeting summaries and carry-over: oldest first so notes read as a timeline. */
export function sortMeetingEntriesChronological(entries: MeetingAgendaEntry[]): MeetingAgendaEntry[] {
  return [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}
