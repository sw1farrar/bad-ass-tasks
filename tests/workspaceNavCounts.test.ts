import { describe, expect, it } from "vitest";
import {
  getWorkspaceNavTaskCounts,
  getWorkspacePendingReviewCount,
  mergeWorkspaceTasksForNavCounts,
} from "@/lib/nav/workspaceNavCounts";
import type { Note, Task } from "@/types";

function task(partial: Partial<Task> & { id: string; workspaceId: string }): Task {
  return {
    title: "Task",
    description: "",
    status: "todo",
    priority: "P2",
    assigneeIds: [],
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    linkedNoteIds: [],
    ...partial,
  };
}

function note(partial: Partial<Note> & { id: string; workspaceId: string }): Note {
  return {
    title: "Note",
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    tags: [],
    linkedTaskIds: [],
    ...partial,
  };
}

describe("workspaceNavCounts", () => {
  it("merges tasks from list and home focus slices", () => {
    const focusOnly = task({ id: "focus-1", workspaceId: "ws-1", title: "Focus only" });
    const merged = mergeWorkspaceTasksForNavCounts(
      "ws-1",
      [],
      [{ task: focusOnly, workspaceId: "ws-1", workspaceName: "WS" }],
      [],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("focus-1");
  });

  it("counts open tasks from merged slices instantly", () => {
    const open = task({ id: "t1", workspaceId: "ws-1", status: "todo" });
    const done = task({ id: "t2", workspaceId: "ws-1", status: "done" });
    const counts = getWorkspaceNavTaskCounts({
      workspaceId: "ws-1",
      tasks: [done],
      globalTodayFocus: [{ task: open, workspaceId: "ws-1", workspaceName: "WS" }],
      globalOpenTaskFocus: [],
      globalWorkspaceStats: {
        "ws-1": {
          openCount: 99,
          totalTaskCount: 99,
          doneCount: 0,
          overdueCount: 0,
          dueTodayCount: 0,
          assigneeBreakdown: [],
        },
      },
    });
    expect(counts.openCount).toBe(1);
  });

  it("counts pending review files for nav badge", () => {
    const notes = [
      note({ id: "n1", workspaceId: "ws-1", reviewStatus: "pending_review" }),
      note({ id: "n2", workspaceId: "ws-1", reviewStatus: "filed" }),
      note({ id: "n3", workspaceId: "ws-2", reviewStatus: "pending_review" }),
    ];
    expect(getWorkspacePendingReviewCount(notes, "ws-1")).toBe(1);
  });
});