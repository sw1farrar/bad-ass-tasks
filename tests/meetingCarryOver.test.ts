import { describe, expect, it } from "vitest";
import {
  buildNextMeetingTitle,
  cloneCarryOverEntries,
  cloneCarryOverItems,
  DEFAULT_CARRY_OVER_OPTIONS,
  getCarryOverCandidateMeetings,
  getCarryOverSourceItems,
  hasMeetingBeenCarriedForward,
} from "@/lib/meetings/carryOver";
import type { Meeting, MeetingAgendaEntry, MeetingAgendaItem } from "@/types";

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

  it("default carry-over includes deferred and unresolved topics", () => {
    const source = getCarryOverSourceItems(items, DEFAULT_CARRY_OVER_OPTIONS);
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

  it("clones comments onto carried-over agenda items", () => {
    const entries: MeetingAgendaEntry[] = [
      {
        id: "e1",
        agendaItemId: "a2",
        body: "Still blocked on vendor",
        createdAt: "2026-06-16T10:20:00Z",
      },
      {
        id: "e2",
        agendaItemId: "a3",
        body: "Need design review",
        createdAt: "2026-06-16T10:25:00Z",
      },
      {
        id: "e3",
        agendaItemId: "a1",
        body: "Completed note",
        createdAt: "2026-06-16T10:15:00Z",
      },
    ];
    const picked = getCarryOverSourceItems(items, DEFAULT_CARRY_OVER_OPTIONS);
    let nextItemId = 0;
    let nextEntryId = 0;
    const clonedItems = cloneCarryOverItems(picked, "m2", 0, () => `new-item-${++nextItemId}`);
    const clonedEntries = cloneCarryOverEntries(entries, clonedItems, () => `new-entry-${++nextEntryId}`);

    expect(clonedEntries).toHaveLength(2);
    expect(clonedEntries.map((entry) => entry.body)).toEqual([
      "Still blocked on vendor",
      "Need design review",
    ]);
    expect(clonedEntries.map((entry) => entry.agendaItemId)).toEqual(["new-item-1", "new-item-2"]);
    expect(clonedEntries[0].createdAt).toBe("2026-06-16T10:20:00Z");
  });

  it("builds next meeting title with date", () => {
    const title = buildNextMeetingTitle(baseMeeting);
    expect(title.startsWith("Weekly Sync —")).toBe(true);
  });

  it("excludes meetings that already had topics carried forward", () => {
    const meetings: Meeting[] = [
      baseMeeting,
      {
        id: "m2",
        workspaceId: "w1",
        title: "Weekly Sync — Jun 23, 2026",
        status: "scheduled",
        previousMeetingId: "m1",
        attendeeIds: [],
        sortOrder: 1000,
        createdAt: "2026-06-23T10:00:00Z",
        updatedAt: "2026-06-23T10:00:00Z",
      },
      {
        id: "m3",
        workspaceId: "w1",
        title: "Planning",
        status: "completed",
        attendeeIds: [],
        sortOrder: 2000,
        createdAt: "2026-06-10T10:00:00Z",
        updatedAt: "2026-06-10T11:00:00Z",
      },
    ];
    const planningItems: MeetingAgendaItem[] = [
      {
        id: "a4",
        meetingId: "m3",
        title: "Still open",
        sortOrder: 0,
        status: "continued",
        linkedTaskIds: [],
        createdAt: "2026-06-10T10:00:00Z",
        updatedAt: "2026-06-10T10:45:00Z",
      },
    ];

    expect(hasMeetingBeenCarriedForward("m1", meetings)).toBe(true);
    expect(hasMeetingBeenCarriedForward("m3", meetings)).toBe(false);
    expect(getCarryOverCandidateMeetings(meetings, [...items, ...planningItems]).map((m) => m.id)).toEqual([
      "m3",
    ]);
  });
});