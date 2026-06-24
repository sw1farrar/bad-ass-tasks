import { describe, expect, it } from "vitest";
import {
  groupMeetingsByStatus,
  sortMeetingEntriesNewestFirst,
  sortMeetings,
} from "@/lib/meetings/meetingFilters";
import type { Meeting, MeetingAgendaEntry } from "@/types";

function meeting(
  id: string,
  status: Meeting["status"],
  scheduledAt: string,
): Meeting {
  return {
    id,
    workspaceId: "w1",
    title: `Meeting ${id}`,
    status,
    scheduledAt,
    attendeeIds: [],
    sortOrder: 0,
    createdAt: scheduledAt,
    updatedAt: scheduledAt,
  };
}

describe("meetingFilters", () => {
  it("sorts upcoming meetings with soonest date first", () => {
    const meetings = [
      meeting("m3", "scheduled", "2026-07-10T12:00:00Z"),
      meeting("m1", "scheduled", "2026-06-20T12:00:00Z"),
      meeting("m2", "draft", "2026-06-25T12:00:00Z"),
    ];

    const sorted = sortMeetings(meetings);
    expect(sorted.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("sorts meeting entries newest first", () => {
    const entries: MeetingAgendaEntry[] = [
      { id: "e1", agendaItemId: "a1", body: "First", createdAt: "2026-06-20T10:00:00Z" },
      { id: "e2", agendaItemId: "a1", body: "Latest", createdAt: "2026-06-20T12:00:00Z" },
      { id: "e3", agendaItemId: "a1", body: "Middle", createdAt: "2026-06-20T11:00:00Z" },
    ];

    expect(sortMeetingEntriesNewestFirst(entries).map((e) => e.id)).toEqual(["e2", "e3", "e1"]);
  });

  it("treats in-progress meetings as upcoming, not live", () => {
    const meetings = [
      meeting("active", "in_progress", "2026-06-18T12:00:00Z"),
      meeting("past", "completed", "2026-06-01T12:00:00Z"),
    ];

    const groups = groupMeetingsByStatus(meetings);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Upcoming");
    expect(groups[0].meetings.map((m) => m.id)).toEqual(["active"]);
    expect(groups.some((g) => g.label === "Live")).toBe(false);
  });

  it("groups upcoming meetings soonest-first and past meetings most-recent-first", () => {
    const meetings = [
      meeting("up-far", "scheduled", "2026-08-01T12:00:00Z"),
      meeting("up-soon", "scheduled", "2026-06-15T12:00:00Z"),
      meeting("past-old", "completed", "2026-05-01T12:00:00Z"),
      meeting("past-new", "completed", "2026-06-01T12:00:00Z"),
    ];

    const groups = groupMeetingsByStatus(meetings);
    expect(groups[0].label).toBe("Upcoming");
    expect(groups[0].meetings.map((m) => m.id)).toEqual(["up-soon", "up-far"]);
    expect(groups[1].label).toBe("Past");
    expect(groups[1].meetings.map((m) => m.id)).toEqual(["past-new", "past-old"]);
  });
});