import type { MeetingAgendaItem } from "@/types";
import { sortAgendaItems } from "@/lib/meetings/meetingFilters";

/** Topics still on the agenda for this meeting (not done or deferred). */
export function isActiveAgendaItem(item: MeetingAgendaItem): boolean {
  return item.status === "open" || item.status === "in_progress";
}

export function getSortedAgendaItems(items: MeetingAgendaItem[]): MeetingAgendaItem[] {
  return sortAgendaItems(items);
}

export function getFirstAgendaItemId(items: MeetingAgendaItem[]): string | null {
  const sorted = getSortedAgendaItems(items);
  const active = sorted.find(isActiveAgendaItem);
  return active?.id ?? sorted[0]?.id ?? null;
}

export function getNextActiveAgendaItemId(
  items: MeetingAgendaItem[],
  currentId: string,
): string | null {
  const sorted = getSortedAgendaItems(items);
  const currentIndex = sorted.findIndex((i) => i.id === currentId);
  if (currentIndex < 0) return getFirstAgendaItemId(items);
  for (let i = currentIndex + 1; i < sorted.length; i++) {
    if (isActiveAgendaItem(sorted[i])) return sorted[i].id;
  }
  for (let i = 0; i < currentIndex; i++) {
    if (isActiveAgendaItem(sorted[i])) return sorted[i].id;
  }
  return null;
}