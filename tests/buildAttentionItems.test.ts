import { describe, it, expect } from "vitest";
import { buildAttentionItems } from "@/features/home/lib/buildAttentionItems";
import type { Notification, Task } from "@/types";

const task = (id: string, dueDate?: string): Task =>
  ({
    id,
    title: `Task ${id}`,
    workspaceId: "ws1",
    status: "todo",
    dueDate,
    priority: "P2",
    tags: [],
    createdAt: new Date().toISOString(),
    description: "",
    linkedNoteIds: [],
  }) as Task;

describe("buildAttentionItems", () => {
  it("includes invites and unread notifications but not due tasks", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const items = buildAttentionItems(
      [
        {
          task: task("t1", yesterday.toISOString()),
          workspaceId: "ws1",
          workspaceName: "Main",
        },
      ],
      [
        {
          id: "n1",
          workspaceId: "ws2",
          userId: "u1",
          type: "invite",
          title: "Invite",
          message: "Join us",
          createdAt: new Date().toISOString(),
          metadata: { workspace_name: "Acme", invite_id: "inv1" },
        } as Notification,
        {
          id: "n2",
          workspaceId: "ws1",
          userId: "u1",
          type: "mention",
          title: "You were mentioned",
          message: "Check the note",
          createdAt: new Date().toISOString(),
          metadata: {},
        } as Notification,
      ]
    );

    expect(items.some((i) => i.kind === "task")).toBe(false);
    expect(items.some((i) => i.kind === "invite")).toBe(false);
    expect(items.some((i) => i.kind === "notification")).toBe(true);
  });

  it("hides deadline notifications when the task is already in focus", () => {
    const items = buildAttentionItems(
      [
        {
          task: task("task-1", new Date().toISOString()),
          workspaceId: "ws1",
          workspaceName: "Main",
        },
      ],
      [
        {
          id: "n1",
          workspaceId: "ws1",
          userId: "u1",
          type: "deadline",
          title: "Task due today",
          message: "Finish the report",
          createdAt: new Date().toISOString(),
          metadata: { task_id: "task-1", reminder_key: "deadline:task-1:2026-06-10" },
        } as Notification,
      ],
    );

    expect(items).toHaveLength(0);
  });

  it("shows duplicate unread notifications once in needs attention", () => {
    const items = buildAttentionItems(
      [],
      [
        {
          id: "n1",
          workspaceId: "ws1",
          userId: "u1",
          type: "deadline",
          title: "Task due today",
          message: "Finish the report",
          createdAt: "2026-06-10T08:00:00.000Z",
          metadata: { reminder_key: "deadline:task-1:2026-06-10", task_id: "task-1" },
        } as Notification,
        {
          id: "n2",
          workspaceId: "ws1",
          userId: "u1",
          type: "deadline",
          title: "Task due today",
          message: "Finish the report",
          createdAt: "2026-06-10T09:00:00.000Z",
          metadata: { reminder_key: "deadline:task-1:2026-06-10", task_id: "task-1" },
        } as Notification,
        {
          id: "n3",
          workspaceId: "ws1",
          userId: "u1",
          type: "deadline",
          title: "Task due today",
          message: "Finish the report",
          createdAt: "2026-06-10T07:00:00.000Z",
          metadata: { reminder_key: "deadline:task-1:2026-06-10", task_id: "task-1" },
        } as Notification,
      ],
    );

    expect(items.filter((i) => i.kind === "notification")).toHaveLength(1);
  });
});