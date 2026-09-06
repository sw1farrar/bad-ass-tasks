import { describe, expect, it } from "vitest";
import type { Task } from "@/types";
import {
  buildCompletedOccurrenceSnapshot,
  latestCompletedOccurrenceId,
} from "@/features/tasks/lib/recurrenceCompletion";

const series: Task = {
  id: "series-1",
  title: "Water Backyard Plants",
  description: "Front and back",
  status: "todo",
  priority: "P2",
  dueDate: "2026-09-05T00:00:00.000Z",
  tags: ["yard"],
  createdAt: "2026-01-01T00:00:00.000Z",
  linkedNoteIds: ["note-1"],
  workspaceId: "ws",
  recurringRule: "FREQ=WEEKLY;BYDAY=WE,SA",
  starred: true,
  folderId: "folder-home",
};

describe("recurrenceCompletion", () => {
  it("snapshots the occurrence as done without the live series rule or file links", () => {
    const snap = buildCompletedOccurrenceSnapshot(series, "2026-09-05T18:00:00.000Z", "occ-1");
    expect(snap.id).toBe("occ-1");
    expect(snap.status).toBe("done");
    expect(snap.completedAt).toBe("2026-09-05T18:00:00.000Z");
    expect(snap.dueDate).toBe(series.dueDate);
    expect(snap.title).toBe(series.title);
    expect(snap.description).toBe(series.description);
    expect(snap.recurringRule).toBeNull();
    expect(snap.parentTaskId).toBe("series-1");
    expect(snap.linkedNoteIds).toEqual([]);
    expect(snap.folderId).toBe("folder-home");
    expect(snap.starred).toBe(true);
  });

  it("finds the latest completed occurrence for a series", () => {
    const older = buildCompletedOccurrenceSnapshot(series, "2026-09-01T18:00:00.000Z", "occ-old");
    const newer = buildCompletedOccurrenceSnapshot(series, "2026-09-05T18:00:00.000Z", "occ-new");
    expect(latestCompletedOccurrenceId([series, older, newer], "series-1")).toBe("occ-new");
    expect(latestCompletedOccurrenceId([series], "series-1")).toBeNull();
  });
});
