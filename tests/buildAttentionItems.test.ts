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
    expect(items.some((i) => i.kind === "invite")).toBe(true);
    expect(items.some((i) => i.kind === "notification")).toBe(true);
  });
});