import { describe, expect, it } from "vitest";
import { duplicateIdsToDelete } from "@/lib/notifications/cleanupDuplicateNotifications";
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

describe("cleanupDuplicateNotifications", () => {
  it("keeps newest unread duplicate and deletes the rest", () => {
    const ids = duplicateIdsToDelete([
      base({
        id: "old",
        createdAt: "2026-06-10T08:00:00.000Z",
        metadata: { reminder_key: "deadline:task-1:2026-06-10" },
      }),
      base({
        id: "newest",
        createdAt: "2026-06-10T09:00:00.000Z",
        metadata: { reminder_key: "deadline:task-1:2026-06-10" },
      }),
      base({
        id: "other",
        type: "mention",
        title: "Mention",
        message: "Hi",
        metadata: {},
      }),
    ]);

    expect(ids).toEqual(["old"]);
  });

  it("keeps unread over read when deduping", () => {
    const ids = duplicateIdsToDelete([
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

    expect(ids).toEqual(["read"]);
  });
});