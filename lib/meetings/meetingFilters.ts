import type { Meeting, MeetingAgendaItem, MeetingStatus } from "@/types";

export type MeetingListFilter = "all" | "mine" | "carryover";

export interface MeetingGroup {
  label: string;
  status: MeetingStatus | "live";
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
    const carryMeetingIds = new Set(
      agendaItems.filter((i) => i.status === "continued").map((i) => i.meetingId),
    );
    return meetings.filter((m) => carryMeetingIds.has(m.id));
  }
  return meetings;
}

export function groupMeetingsByStatus(meetings: Meeting[]): MeetingGroup[] {
  const live = meetings.filter((m) => m.status === "in_progress");
  const upcoming = meetings.filter((m) => m.status === "draft" || m.status === "scheduled");
  const past = meetings.filter((m) => m.status === "completed");

  const groups: MeetingGroup[] = [];
  if (live.length) groups.push({ label: "Live", status: "live", meetings: live });
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
  return [...meetings].sort((a, b) => {
    const statusOrder: Record<MeetingStatus, number> = {
      in_progress: 0,
      scheduled: 1,
      draft: 2,
      completed: 3,
    };
    const sa = statusOrder[a.status];
    const sb = statusOrder[b.status];
    if (sa !== sb) return sa - sb;
    const da = a.scheduledAt || a.createdAt;
    const db = b.scheduledAt || b.createdAt;
    return new Date(db).getTime() - new Date(da).getTime();
  });
}

export function sortAgendaItems(items: MeetingAgendaItem[]): MeetingAgendaItem[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}