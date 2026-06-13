import { describe, expect, it } from "vitest";
import {
  TASK_ASSIGNEE_ALL_LABEL,
  buildAssigneeBreakdown,
  enrichTaskWithAssignee,
  isAllAssigneePool,
  resolveAssigneeLabel,
} from "@/lib/assignee";
import type { Task } from "@/types";

const members = [
  {
    workspaceId: "ws-1",
    userId: "u-me",
    role: "owner" as const,
    joinedAt: "",
    fullName: "Casey Owner",
  },
  {
    workspaceId: "ws-1",
    userId: "u-rachel",
    role: "member" as const,
    joinedAt: "",
    fullName: "Rachel Kim",
  },
];

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t-1",
    title: "Test",
    status: "todo",
    priority: "P2",
    workspaceId: "ws-1",
    ...overrides,
  } as Task;
}

describe("assignee Anyone pool", () => {
  it("resolves empty assigneeIds to Anyone", () => {
    expect(resolveAssigneeLabel([], members, "u-me")).toBe(TASK_ASSIGNEE_ALL_LABEL);
    expect(resolveAssigneeLabel(undefined, members, "u-me")).toBe(TASK_ASSIGNEE_ALL_LABEL);
  });

  it("enriches tasks without assignees as Anyone", () => {
    const enriched = enrichTaskWithAssignee(task({ assigneeIds: [] }), members, "u-me");
    expect(enriched.assignee).toBe(TASK_ASSIGNEE_ALL_LABEL);
    expect(enriched.assigneeIds).toEqual([]);
  });

  it("treats legacy labels as the Anyone pool", () => {
    expect(isAllAssigneePool([], "Unassigned")).toBe(true);
    expect(isAllAssigneePool([], "All")).toBe(true);
    expect(isAllAssigneePool([], TASK_ASSIGNEE_ALL_LABEL)).toBe(true);
  });

  it("groups open Anyone-pool tasks under Anyone in breakdown", () => {
    const breakdown = buildAssigneeBreakdown(
      [task({ assigneeIds: [], assignee: TASK_ASSIGNEE_ALL_LABEL })],
      members,
      "u-me",
    );
    expect(breakdown).toEqual([{ label: TASK_ASSIGNEE_ALL_LABEL, count: 1 }]);
  });
});