import { describe, expect, it } from "vitest";
import { isPendingImportReview } from "@/features/import/lib/pendingReview";
import { countOpenAndOverdueTasks } from "@/features/home/lib/computeWorkspaceTaskStats";
import type { Task } from "@/types";

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

describe("pending import review", () => {
  it("detects pending_review", () => {
    expect(isPendingImportReview({ importStatus: "pending_review" })).toBe(true);
    expect(isPendingImportReview({ importStatus: null })).toBe(false);
    expect(isPendingImportReview({})).toBe(false);
  });

  it("does not count pending imports as open tasks", () => {
    const stats = countOpenAndOverdueTasks([
      task({ id: "a", status: "todo" }),
      task({ id: "b", status: "todo", importStatus: "pending_review" }),
      task({ id: "c", status: "done" }),
    ]);
    expect(stats.openCount).toBe(1);
  });
});
