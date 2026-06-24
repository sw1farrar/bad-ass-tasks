import { getMeetingsAlreadyCarriedForward } from "@/lib/meetings/carryOver";
import type { Meeting, MeetingAgendaEntry, MeetingAgendaItem, MeetingStatus } from "@/types";

export type MeetingListFilter = "all" | "mine" | "carryover";

export interface MeetingGroup {
  label: string;
  status: MeetingStatus;
  meetings: Meeting[];
}

export function filterMeetingsBySearch(meetings: Meeting[], query: string): Meeting[] {
  const q = query.trim().toLowerCase();
  if (!q) return meetings;
  return meetings.filter((m) => m.title.toLowerCase().includes(q));
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

function sortMeetingsByDate(meetings: Meeting[], direction: "asc" | "desc"): Meeting[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...meetings].sort((a, b) => (meetingListDate(a) - meetingListDate(b)) * factor);
}

function isUpcomingMeeting(status: MeetingStatus): boolean {
  return status === "draft" || status === "scheduled" || status === "in_progress";
}

export function groupMeetingsByStatus(meetings: Meeting[]): MeetingGroup[] {
  const upcoming = sortMeetingsByDate(
    meetings.filter((m) => isUpcomingMeeting(m.status)),
    "asc",
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

/** Exported agendas: oldest first so comments read as a timeline. */
export function sortMeetingEntriesChronological(entries: MeetingAgendaEntry[]): MeetingAgendaEntry[] {
  return [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}