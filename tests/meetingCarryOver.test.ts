import { describe, expect, it } from "vitest";
import {
  buildNextMeetingTitle,
  cloneCarryOverItems,
  getCarryOverSourceItems,
} from "@/lib/meetings/carryOver";
import type { Meeting, MeetingAgendaItem } from "@/types";

const baseMeeting: Meeting = {
  id: "m1",
  workspaceId: "w1",
  title: "Weekly Sync — Jun 16, 2026",
  status: "completed",
  attendeeIds: [],
  sortOrder: 0,
  createdAt: "2026-06-16T10:00:00Z",
  updatedAt: "2026-06-16T11:00:00Z",
};

const items: MeetingAgendaItem[] = [
  {
    id: "a1",
    meetingId: "m1",
    title: "Done topic",
    sortOrder: 0,
    status: "completed",
    linkedTaskIds: [],
    createdAt: "2026-06-16T10:00:00Z",
    updatedAt: "2026-06-16T10:30:00Z",
  },
  {
    id: "a2",
    meetingId: "m1",
    title: "Carry topic",
    sortOrder: 1000,
    status: "continued",
    linkedTaskIds: [],
    createdAt: "2026-06-16T10:00:00Z",
    updatedAt: "2026-06-16T10:45:00Z",
  },
  {
    id: "a3",
    meetingId: "m1",
    title: "Open topic",
    sortOrder: 2000,
    status: "open",
    linkedTaskIds: [],
    createdAt: "2026-06-16T10:00:00Z",
    updatedAt: "2026-06-16T10:00:00Z",
  },
];

describe("carryOver", () => {
  it("pulls continued items by default", () => {
    const source = getCarryOverSourceItems(items, {
      includeContinued: true,
      includeOpen: false,
    });
    expect(source.map((i) => i.id)).toEqual(["a2"]);
  });

  it("can include open items", () => {
    const source = getCarryOverSourceItems(items, {
      includeContinued: true,
      includeOpen: true,
    });
    expect(source.map((i) => i.id)).toEqual(["a2", "a3"]);
  });

  it("clones carry-over with lineage", () => {
    const cloned = cloneCarryOverItems(
      items.filter((i) => i.status === "continued"),
      "m2",
    );
    expect(cloned).toHaveLength(1);
    expect(cloned[0].meetingId).toBe("m2");
    expect(cloned[0].continuedFromItemId).toBe("a2");
    expect(cloned[0].status).toBe("open");
  });

  it("builds next meeting title with date", () => {
    const title = buildNextMeetingTitle(baseMeeting);
    expect(title.startsWith("Weekly Sync —")).toBe(true);
  });
});