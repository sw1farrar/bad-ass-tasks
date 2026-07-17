import { describe, expect, it } from "vitest";
import {
  cloneMeetingAgendaEntriesForDuplicate,
  cloneMeetingAgendaItemsForDuplicate,
  DUPLICATE_MEETING_TITLE,
  selectAgendaItemsForDuplicate,
} from "@/lib/meetings/duplicateMeeting";
import type { MeetingAgendaEntry, MeetingAgendaItem } from "@/types";

const items: MeetingAgendaItem[] = [
  {
    id: "a1",
    meetingId: "m1",
    title: "Demos",
    sortOrder: 1000,
    status: "completed",
    linkedTaskIds: ["t1"],
    completedAt: "2026-06-23T14:30:00Z",
    createdAt: "2026-06-23T12:00:00Z",
    updatedAt: "2026-06-23T14:30:00Z",
  },
  {
    id: "a2",
    meetingId: "m1",
    title: "Roadmap",
    description: "Q4 planning",
    sortOrder: 0,
    status: "continued",
    ownerName: "Alex",
    linkedTaskIds: [],
    createdAt: "2026-06-23T12:00:00Z",
    updatedAt: "2026-06-23T14:30:00Z",
  },
];

const entries: MeetingAgendaEntry[] = [
  {
    id: "e1",
    agendaItemId: "a1",
    body: "Demo went well",
    createdAt: "2026-06-23T14:10:00Z",
  },
  {
    id: "e2",
    agendaItemId: "a2",
    body: "#decision Ship Friday",
    isDecision: true,
    createdAt: "2026-06-23T14:20:00Z",
  },
];

describe("duplicateMeeting helpers", () => {
  it("exposes the default new meeting title", () => {
    expect(DUPLICATE_MEETING_TITLE).toBe("New meeting");
  });

  it("filters source topics by selected ids", () => {
    const selected = selectAgendaItemsForDuplicate(items, ["a1"]);
    expect(selected.map((i) => i.id)).toEqual(["a1"]);
    expect(selectAgendaItemsForDuplicate(items).map((i) => i.title)).toEqual([
      "Roadmap",
      "Demos",
    ]);
  });

  it("clones all topics as open items in sort order", () => {
    let n = 0;
    const { items: cloned, idMap } = cloneMeetingAgendaItemsForDuplicate(
      items,
      "m2",
      () => `new-${++n}`,
    );
    expect(cloned).toHaveLength(2);
    expect(cloned.map((i) => i.title)).toEqual(["Roadmap", "Demos"]);
    expect(cloned.every((i) => i.meetingId === "m2")).toBe(true);
    expect(cloned.every((i) => i.status === "open")).toBe(true);
    expect(cloned.every((i) => i.completedAt == null)).toBe(true);
    expect(cloned.every((i) => i.continuedFromItemId == null)).toBe(true);
    expect(cloned[0].description).toBe("Q4 planning");
    expect(cloned[0].ownerName).toBe("Alex");
    expect(cloned[1].linkedTaskIds).toEqual(["t1"]);
    expect(idMap.get("a2")).toBe(cloned[0].id);
    expect(idMap.get("a1")).toBe(cloned[1].id);
  });

  it("clones notes remapped onto new topic ids", () => {
    let n = 0;
    const { idMap } = cloneMeetingAgendaItemsForDuplicate(items, "m2", () => `item-${++n}`);
    n = 0;
    const clonedEntries = cloneMeetingAgendaEntriesForDuplicate(
      entries,
      idMap,
      () => `entry-${++n}`,
    );
    expect(clonedEntries).toHaveLength(2);
    expect(clonedEntries.map((e) => e.body)).toEqual([
      "Demo went well",
      "#decision Ship Friday",
    ]);
    expect(clonedEntries[0].agendaItemId).toBe(idMap.get("a1"));
    expect(clonedEntries[1].isDecision).toBe(true);
  });
});
