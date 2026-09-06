import { describe, expect, it } from "vitest";
import type { Task } from "@/types";
import {
  buildTaskListQueryKey,
  escapeIlikePattern,
  formatTaskListCount,
  mergeTaskListRows,
  resolveTaskStatusMode,
} from "@/features/tasks/lib/taskListPage";

function task(partial: Partial<Task>): Task {
  return {
    id: partial.id ?? "t1",
    title: "Task",
    description: "",
    status: partial.status ?? "todo",
    priority: "P2",
    tags: [],
    createdAt: "2026-09-06T00:00:00.000Z",
    linkedNoteIds: [],
    workspaceId: "ws",
    ...partial,
  };
}

describe("task list paging helpers", () => {
  it("treats completed as a distinct status mode", () => {
    expect(resolveTaskStatusMode({ statusMode: "completed" })).toBe("completed");
    expect(resolveTaskStatusMode({ statusMode: "all" })).toBe("all");
    expect(resolveTaskStatusMode({})).toBe("incomplete");
  });

  it("changes query key when search or filters change", () => {
    const base = {
      workspaceId: "ws",
      statusMode: "completed" as const,
      search: "",
      starred: "all" as const,
      recurrence: "all" as const,
      folderFilter: "all" as const,
    };
    expect(buildTaskListQueryKey({ ...base, search: "mail" })).not.toBe(buildTaskListQueryKey(base));
    expect(buildTaskListQueryKey({ ...base, starred: "only" })).not.toBe(buildTaskListQueryKey(base));
  });

  it("merges remote pages without duplicating local rows", () => {
    const local = [task({ id: "a", status: "done" })];
    const remote = [task({ id: "a", status: "done" }), task({ id: "b", status: "done" })];
    expect(mergeTaskListRows(local, remote).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("formats loaded vs total counts", () => {
    expect(formatTaskListCount(18, 18)).toBe("18 shown");
    expect(formatTaskListCount(100, 19898)).toBe("100 of 19,898");
  });

  it("escapes ilike wildcards", () => {
    expect(escapeIlikePattern("100% done_now")).toBe("100\\% done\\_now");
  });
});
