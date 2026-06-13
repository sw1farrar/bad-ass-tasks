import { describe, expect, it } from "vitest";
import {
  expandToSiblingIds,
  idempotencyMetadataMatch,
  notificationMatchesSiblingQuery,
  siblingQueryForNotification,
} from "@/lib/notifications/notificationIdempotency";
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

describe("notificationIdempotency", () => {
  it("uses reminder_key for deadline idempotency", () => {
    expect(
      idempotencyMetadataMatch("deadline", {
        reminder_key: "deadline:task-1:2026-06-10",
        task_id: "task-1",
      }),
    ).toEqual({ reminder_key: "deadline:task-1:2026-06-10" });
  });

  it("prefers activity_log_id over note_id for activity rows", () => {
    expect(
      idempotencyMetadataMatch(
        "activity",
        { note_id: "note-1", activity_log_id: "log-1" },
        null,
      ),
    ).toEqual({ activity_log_id: "log-1" });
  });

  it("expands mark-read ids to duplicate sibling rows", () => {
    const seed = base({
      id: "n1",
      metadata: { reminder_key: "deadline:task-1:2026-06-10", task_id: "task-1" },
    });
    const sibling = base({
      id: "n2",
      createdAt: "2026-06-10T09:00:00.000Z",
      metadata: { reminder_key: "deadline:task-1:2026-06-10", task_id: "task-1" },
    });
    const other = base({
      id: "n3",
      type: "mention",
      title: "Mention",
      message: "Hi",
      metadata: {},
    });

    expect(expandToSiblingIds([seed], [seed, sibling, other])).toEqual(
      expect.arrayContaining(["n1", "n2"]),
    );
    expect(expandToSiblingIds([seed], [seed, sibling, other])).toHaveLength(2);
  });

  it("builds fallback sibling queries for rows without metadata keys", () => {
    const notification = base({
      id: "generic",
      type: "mention",
      title: "Ping",
      message: "Hello",
      metadata: {},
    });

    expect(siblingQueryForNotification(notification)).toEqual({
      kind: "fallback",
      type: "mention",
      workspaceId: "ws1",
      title: "Ping",
      message: "Hello",
    });
    expect(
      notificationMatchesSiblingQuery(notification, {
        kind: "fallback",
        type: "mention",
        workspaceId: "ws1",
        title: "Ping",
        message: "Hello",
      }),
    ).toBe(true);
  });
});