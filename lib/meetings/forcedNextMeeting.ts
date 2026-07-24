import {
  hasCarryOverEligibleItems,
  hasMeetingBeenCarriedForward,
} from "@/lib/meetings/carryOver";
import type { Meeting, MeetingAgendaItem } from "@/types";

function storageKey(workspaceId: string): string {
  return `bat:forced-next-meeting:${workspaceId}`;
}

export function readForcedNextMeetingId(workspaceId: string): string | null {
  if (typeof window === "undefined" || !workspaceId) return null;
  try {
    return window.localStorage.getItem(storageKey(workspaceId));
  } catch {
    return null;
  }
}

export function writeForcedNextMeetingId(
  workspaceId: string,
  meetingId: string | null,
): void {
  if (typeof window === "undefined" || !workspaceId) return;
  try {
    if (!meetingId) window.localStorage.removeItem(storageKey(workspaceId));
    else window.localStorage.setItem(storageKey(workspaceId), meetingId);
  } catch {
    // ignore quota / private mode
  }
}

/** Keep or clear a persisted forced-next id based on current meeting data. */
export function resolveForcedNextMeetingId(
  workspaceId: string,
  meetingId: string | null,
  meetings: Meeting[],
  agendaItems: MeetingAgendaItem[],
): string | null {
  if (!meetingId) return null;
  // Data not loaded yet — keep the pending id so refresh can restore the modal.
  if (meetings.length === 0) return meetingId;

  const meeting = meetings.find((m) => m.id === meetingId);
  if (!meeting || meeting.status !== "completed") {
    writeForcedNextMeetingId(workspaceId, null);
    return null;
  }
  if (hasMeetingBeenCarriedForward(meetingId, meetings)) {
    writeForcedNextMeetingId(workspaceId, null);
    return null;
  }
  if (!hasCarryOverEligibleItems(meetingId, agendaItems)) {
    writeForcedNextMeetingId(workspaceId, null);
    return null;
  }
  return meetingId;
}
