import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  getWorkspaceNavTaskCounts,
  getWorkspacePendingReviewCount,
  mergeWorkspaceTasksForNavCounts,
} from "@/lib/nav/workspaceNavCounts";
import { startOfLocalToday, toDueDateStorage } from "@/lib/datetime";
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
    expect(counts.hotListCount).toBe(0);
  });

  it("clears counts instantly when local tasks are empty after hydrate", () => {
    const counts = getWorkspaceNavTaskCounts({
      workspaceId: "ws-1",
      tasks: [],
      globalTodayFocus: [],
      globalOpenTaskFocus: [],
      preferLocalTasks: true,
      globalWorkspaceStats: {
        "ws-1": {
          openCount: 4,
          totalTaskCount: 4,
          doneCount: 0,
          overdueCount: 2,
          dueTodayCount: 1,
          assigneeBreakdown: [],
        },
      },
    });
    expect(counts).toEqual({ openCount: 0, overdueCount: 0, hotListCount: 0 });
  });

  it("falls back to aggregate stats before local tasks hydrate", () => {
    const counts = getWorkspaceNavTaskCounts({
      workspaceId: "ws-1",
      tasks: [],
      globalTodayFocus: [],
      globalOpenTaskFocus: [],
      preferLocalTasks: false,
      globalWorkspaceStats: {
        "ws-1": {
          openCount: 4,
          totalTaskCount: 4,
          doneCount: 0,
          overdueCount: 2,
          dueTodayCount: 1,
          assigneeBreakdown: [],
        },
      },
    });
    expect(counts).toEqual({ openCount: 4, overdueCount: 2, hotListCount: 3 });
  });

  it("counts hot-list tasks as past due, today, and tomorrow", () => {
    const today = startOfLocalToday();
    const counts = getWorkspaceNavTaskCounts({
      workspaceId: "ws-1",
      preferLocalTasks: true,
      tasks: [
        task({ id: "overdue", workspaceId: "ws-1", dueDate: toDueDateStorage(addDays(today, -2)) }),
        task({ id: "today", workspaceId: "ws-1", dueDate: toDueDateStorage(today) }),
        task({ id: "tomorrow", workspaceId: "ws-1", dueDate: toDueDateStorage(addDays(today, 1)) }),
        task({ id: "later", workspaceId: "ws-1", dueDate: toDueDateStorage(addDays(today, 5)) }),
        task({ id: "undated", workspaceId: "ws-1" }),
        task({ id: "starred", workspaceId: "ws-1", starred: true }),
        task({ id: "done", workspaceId: "ws-1", status: "done", dueDate: toDueDateStorage(today) }),
      ],
      globalTodayFocus: [],
      globalOpenTaskFocus: [],
    });
    expect(counts.openCount).toBe(6);
    expect(counts.overdueCount).toBe(1);
    expect(counts.hotListCount).toBe(4);
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