import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Notification } from "@/types";
import {
  applyRealtimeNotificationChange,
  getMarkAllReadIds,
  resolveBellBadgeCount,
  syncUnreadCountFromList,
} from "@/lib/notifications/notificationSelectors";

const makeMention = (
  id: string,
  createdAt: string,
  overrides: Partial<Notification> = {},
): Notification =>
  ({
    id,
    workspaceId: "ws1",
    userId: "u1",
    type: "mention",
    title: `Mention ${id}`,
    message: "Hi",
    createdAt,
    metadata: {},
    ...overrides,
  }) as Notification;

const makeInvite = (id: string, inviteId: string): Notification =>
  ({
    id,
    workspaceId: "ws1",
    userId: "u1",
    type: "invite",
    title: "Invite",
    message: "Join",
    createdAt: "2026-06-10T08:00:00.000Z",
    metadata: { invite_id: inviteId },
  }) as Notification;

describe("bell badge parity and mark-all helpers", () => {
  it("resolveBellBadgeCount uses full unread fetch when inbox is capped at 50", () => {
    const unreadRows = Array.from({ length: 55 }, (_, i) =>
      makeMention(`unread-${i}`, `2026-06-10T${String(i).padStart(2, "0")}:00:00.000Z`),
    );

    const inboxUnread = unreadRows.slice(0, 50);
    expect(resolveBellBadgeCount(inboxUnread, unreadRows)).toBe(55);
    expect(syncUnreadCountFromList(inboxUnread)).toBe(50);
  });

  it("getMarkAllReadIds includes unread rows beyond the visible inbox cap", () => {
    const unreadRows = Array.from({ length: 55 }, (_, i) =>
      makeMention(`unread-${i}`, `2026-06-10T${String(i).padStart(2, "0")}:00:00.000Z`),
    );

    expect(getMarkAllReadIds(unreadRows)).toHaveLength(55);
  });

  it("getMarkAllReadIds excludes invites", () => {
    const unreadRows = [
      makeMention("m1", "2026-06-10T08:00:00.000Z"),
      makeInvite("inv-1", "invite-abc"),
    ];

    expect(getMarkAllReadIds(unreadRows)).toEqual(["m1"]);
  });

  it("realtime UPDATE mark-read decrements badge without recounting truncated inbox", () => {
    const unreadRows = Array.from({ length: 55 }, (_, i) =>
      makeMention(`unread-${i}`, `2026-06-10T${String(i).padStart(2, "0")}:00:00.000Z`),
    );
    const inboxUnread = unreadRows.slice(0, 50);
    const currentBadge = resolveBellBadgeCount(inboxUnread, unreadRows);
    expect(currentBadge).toBe(55);

    const target = inboxUnread[0]!;
    const updated = { ...target, readAt: "2026-06-10T12:00:00.000Z" };

    const result = applyRealtimeNotificationChange({
      eventType: "UPDATE",
      currentNotifications: inboxUnread,
      currentBadge,
      updated,
    });

    expect(result.unreadNotifCount).toBe(54);
    expect(syncUnreadCountFromList(result.notifications)).toBe(49);
  });

  it("realtime INSERT merges same dedupe key and upgrades read to unread badge", () => {
    const readDeadline = {
      id: "old-deadline",
      workspaceId: "ws1",
      userId: "u1",
      type: "deadline" as const,
      title: "Task due today",
      message: "Finish report",
      readAt: "2026-06-10T07:00:00.000Z",
      createdAt: "2026-06-10T07:00:00.000Z",
      metadata: { reminder_key: "deadline:task-1:2026-06-10" },
    } as Notification;
    const freshDeadline = {
      ...readDeadline,
      id: "new-deadline",
      readAt: undefined,
      createdAt: "2026-06-10T08:00:00.000Z",
    } as Notification;

    const result = applyRealtimeNotificationChange({
      eventType: "INSERT",
      currentNotifications: [readDeadline],
      currentBadge: 0,
      inserted: freshDeadline,
    });

    expect(result.unreadNotifCount).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.id).toBe("new-deadline");
    expect(result.notifications[0]?.readAt).toBeUndefined();
  });

  it("realtime INSERT of non-invite unread increments badge; invites do not", () => {
    const current = [makeMention("m1", "2026-06-10T08:00:00.000Z")];
    const insertedMention = makeMention("m2", "2026-06-10T09:00:00.000Z");

    const mentionResult = applyRealtimeNotificationChange({
      eventType: "INSERT",
      currentNotifications: current,
      currentBadge: 1,
      inserted: insertedMention,
    });
    expect(mentionResult.unreadNotifCount).toBe(2);

    const insertedInvite = makeInvite("inv-1", "invite-abc");
    const inviteResult = applyRealtimeNotificationChange({
      eventType: "INSERT",
      currentNotifications: current,
      currentBadge: 1,
      inserted: insertedInvite,
    });
    expect(inviteResult.unreadNotifCount).toBe(1);
  });
});

vi.mock("@/lib/data/hybridStore", () => ({
  isSupabaseLive: vi.fn(() => true),
  getUserNotifications: vi.fn(),
  markNotificationsRead: vi.fn().mockResolvedValue(true),
  processDeadlineReminders: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: vi.fn(() => null),
  isSupabaseConfigured: vi.fn(() => true),
}));

import { useTaskStore } from "@/store/useTaskStore";
import * as hybrid from "@/lib/data/hybridStore";

describe("useTaskStore markAllNotifsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTaskStore.setState({
      user: { id: "user-1" } as any,
      notifications: [],
      unreadNotifCount: 0,
    });
  });

  it("marks every non-invite unread row in the backend, not only visible inbox rows", async () => {
    const unreadRows = Array.from({ length: 55 }, (_, i) =>
      makeMention(`unread-${i}`, `2026-06-10T${String(i).padStart(2, "0")}:00:00.000Z`),
    );
    const visibleInbox = unreadRows.slice(0, 50);

    vi.mocked(hybrid.getUserNotifications).mockResolvedValue(unreadRows);

    useTaskStore.setState({
      notifications: visibleInbox,
      unreadNotifCount: 55,
    });

    await useTaskStore.getState().markAllNotifsRead();

    expect(hybrid.markNotificationsRead).toHaveBeenCalledWith(
      expect.arrayContaining(unreadRows.map((n) => n.id)),
    );
    expect(vi.mocked(hybrid.markNotificationsRead).mock.calls[0]?.[0]).toHaveLength(55);
    expect(useTaskStore.getState().unreadNotifCount).toBe(0);
  });

  it("leaves invite notifications unread while clearing the bell badge", async () => {
    const invite = makeInvite("inv-1", "invite-abc");
    const mention = makeMention("m1", "2026-06-10T08:00:00.000Z");

    vi.mocked(hybrid.getUserNotifications).mockResolvedValue([mention, invite]);

    useTaskStore.setState({
      notifications: [mention, invite],
      unreadNotifCount: 1,
    });

    await useTaskStore.getState().markAllNotifsRead();

    expect(hybrid.markNotificationsRead).toHaveBeenCalledWith(["m1"]);
    expect(useTaskStore.getState().unreadNotifCount).toBe(0);
    expect(useTaskStore.getState().notifications.find((n) => n.id === "inv-1")?.readAt).toBeUndefined();
  });
});