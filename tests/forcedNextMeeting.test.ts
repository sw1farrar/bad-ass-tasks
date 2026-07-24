import { afterEach, describe, expect, it } from "vitest";
import {
  readForcedNextMeetingId,
  resolveForcedNextMeetingId,
  writeForcedNextMeetingId,
} from "@/lib/meetings/forcedNextMeeting";
import type { Meeting, MeetingAgendaItem } from "@/types";

const workspaceId = "ws-test";

function meeting(id: string, status: Meeting["status"] = "completed"): Meeting {
  return {
    id,
    workspaceId,
    title: "Sync",
    status,
    attendeeIds: [],
    attendees: [],
    sortOrder: 0,
    createdAt: "2026-07-01T12:00:00Z",
    updatedAt: "2026-07-01T12:00:00Z",
  };
}

function continuedItem(meetingId: string): MeetingAgendaItem {
  return {
    id: "a1",
    meetingId,
    title: "Topic",
    sortOrder: 0,
    status: "continued",
    reviewed: true,
    linkedTaskIds: [],
    createdAt: "2026-07-01T12:00:00Z",
    updatedAt: "2026-07-01T12:00:00Z",
  };
}

describe("forcedNextMeeting", () => {
  afterEach(() => {
    writeForcedNextMeetingId(workspaceId, null);
  });

  it("persists and reads a forced next meeting id", () => {
    writeForcedNextMeetingId(workspaceId, "m1");
    expect(readForcedNextMeetingId(workspaceId)).toBe("m1");
  });

  it("keeps the id while meetings have not loaded yet", () => {
    expect(resolveForcedNextMeetingId(workspaceId, "m1", [], [])).toBe("m1");
  });

  it("clears when the meeting was already carried forward", () => {
    writeForcedNextMeetingId(workspaceId, "m1");
    const meetings = [
      meeting("m1"),
      { ...meeting("m2", "draft"), previousMeetingId: "m1" },
    ];
    expect(
      resolveForcedNextMeetingId(workspaceId, "m1", meetings, [continuedItem("m1")]),
    ).toBeNull();
    expect(readForcedNextMeetingId(workspaceId)).toBeNull();
  });

  it("keeps a completed meeting that still has carry-over topics", () => {
    writeForcedNextMeetingId(workspaceId, "m1");
    expect(
      resolveForcedNextMeetingId(workspaceId, "m1", [meeting("m1")], [continuedItem("m1")]),
    ).toBe("m1");
  });
});
