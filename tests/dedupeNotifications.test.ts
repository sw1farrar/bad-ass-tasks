import { describe, expect, it } from "vitest";
import { dedupeNotifications } from "@/lib/notifications/dedupeNotifications";
import type { Notification } from "@/types";

const base = (overrides: Partial<Notification> & Pick<Notification, "id">): Notification =>
  ({
    workspaceId: "ws1",
    userId: "u1",
    type: "deadline",
    title: "Task due today",
    message: "Finish the report",
    createdAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  }) as Notification;

describe("dedupeNotifications", () => {
  it("collapses duplicate deadline reminders for the same task", () => {
    const deduped = dedupeNotifications([
      base({
        id: "n1",
        createdAt: "2026-06-10T08:00:00.000Z",
        metadata: { reminder_key: "deadline:task-1:2026-06-10", task_id: "task-1" },
      }),
      base({
        id: "n2",
        createdAt: "2026-06-10T09:00:00.000Z",
        metadata: { reminder_key: "deadline:task-1:2026-06-10", task_id: "task-1" },
      }),
      base({
        id: "n3",
        createdAt: "2026-06-10T07:00:00.000Z",
        metadata: { reminder_key: "deadline:task-1:2026-06-10", task_id: "task-1" },
      }),
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("n2");
  });

  it("keeps unread over read when keys match", () => {
    const deduped = dedupeNotifications([
      base({
        id: "read",
        readAt: "2026-06-10T10:00:00.000Z",
        createdAt: "2026-06-10T10:00:00.000Z",
        metadata: { reminder_key: "deadline:task-1:2026-06-10" },
      }),
      base({
        id: "unread",
        createdAt: "2026-06-10T09:00:00.000Z",
        metadata: { reminder_key: "deadline:task-1:2026-06-10" },
      }),
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("unread");
  });
});