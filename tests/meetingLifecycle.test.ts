import { describe, expect, it } from "vitest";
import {
  computeCompleteMeetingStats,
  resolveAgendaItemsForMeetingCompletion,
  shouldAutoDeferAgendaItem,
} from "@/lib/meetings/meetingLifecycle";
import type { MeetingAgendaItem } from "@/types";

function item(status: MeetingAgendaItem["status"], id = "a1"): MeetingAgendaItem {
  return {
    id,
    meetingId: "m1",
    title: "Topic",
    sortOrder: 0,
    status,
    linkedTaskIds: [],
    createdAt: "2026-06-23T12:00:00Z",
    updatedAt: "2026-06-23T12:00:00Z",
  };
}

describe("meetingLifecycle", () => {
  it("flags open and in-progress topics for auto-defer", () => {
    expect(shouldAutoDeferAgendaItem(item("open"))).toBe(true);
    expect(shouldAutoDeferAgendaItem(item("in_progress"))).toBe(true);
    expect(shouldAutoDeferAgendaItem(item("completed"))).toBe(false);
    expect(shouldAutoDeferAgendaItem(item("continued"))).toBe(false);
  });

  it("defers unfinished topics when completing a meeting", () => {
    const items = [
      item("completed", "a1"),
      item("continued", "a2"),
      item("open", "a3"),
      item("in_progress", "a4"),
    ];
    const resolved = resolveAgendaItemsForMeetingCompletion(items);
    expect(resolved.map((i) => [i.id, i.status])).toEqual([
      ["a1", "completed"],
      ["a2", "continued"],
      ["a3", "continued"],
      ["a4", "continued"],
    ]);
  });

  it("counts auto-deferred topics in complete meeting stats", () => {
    const stats = computeCompleteMeetingStats(
      [item("completed", "a1"), item("open", "a2"), item("continued", "a3")],
      2,
    );
    expect(stats).toEqual({
      completedTopics: 1,
      continuedTopics: 2,
      autoDeferredTopics: 1,
      decisionCount: 2,
    });
  });
});