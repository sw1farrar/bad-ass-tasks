import { hasMeetingBeenCarriedForward } from "@/lib/meetings/carryOver";
import type { Meeting, MeetingAgendaItem, MeetingStatus } from "@/types";

export function canCompleteMeeting(meeting: Meeting): boolean {
  return meeting.status !== "completed";
}

export function canReopenMeeting(meeting: Meeting): boolean {
  return meeting.status === "completed";
}

export function canStartNextMeeting(meeting: Meeting, meetings: Meeting[]): boolean {
  return (
    canReopenMeeting(meeting) && !hasMeetingBeenCarriedForward(meeting.id, meetings)
  );
}

export function meetingStatusLabel(status: MeetingStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    default:
      return status;
  }
}

export function getMeetingDurationMinutes(meeting: Meeting): number | null {
  if (!meeting.startedAt) return null;
  const end = meeting.completedAt ? new Date(meeting.completedAt) : new Date();
  const start = new Date(meeting.startedAt);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export interface CompleteMeetingStats {
  completedTopics: number;
  continuedTopics: number;
  openTopics: number;
  decisionCount: number;
}

export function computeCompleteMeetingStats(
  items: MeetingAgendaItem[],
  decisionCount: number,
): CompleteMeetingStats {
  return {
    completedTopics: items.filter((i) => i.status === "completed").length,
    continuedTopics: items.filter((i) => i.status === "continued").length,
    openTopics: items.filter((i) => i.status === "open" || i.status === "in_progress").length,
    decisionCount,
  };
}