import { describe, expect, it } from "vitest";
import {
  buildInboxNotifications,
  countBellBadgeUnread,
  countUnreadDeduped,
  countWorkspaceBadgeUnread,
  getBellPanelNotifications,
  getPendingInviteNotifications,
  getPendingListShareNotifications,
  getWorkspacePanelNotifications,
  isBellUnread,
  reconcileBellInbox,
  resolveBellBadgeCount,
  syncInboxFromFetches,
  syncUnreadCountFromList,
} from "@/lib/notifications/notificationSelectors";
import type { Notification } from "@/types";

describe("notificationSelectors", () => {
  it("counts unread after dedupe", () => {
    const count = countUnreadDeduped([
      {
        id: "n1",
        workspaceId: "ws1",
        userId: "u1",
        type: "deadline",
        title: "Task due today",
        message: "Finish the report",
        createdAt: "2026-06-10T08:00:00.000Z",
        metadata: { reminder_key: "deadline:task-1:2026-06-10" },
      } as Notification,
      {
        id: "n2",
        workspaceId: "ws1",
        userId: "u1",
        type: "deadline",
        title: "Task due today",
        message: "Finish the report",
        createdAt: "2026-06-10T09:00:00.000Z",
        metadata: { reminder_key: "deadline:task-1:2026-06-10" },
      } as Notification,
      {
        id: "n3",
        workspaceId: "ws1",
        userId: "u1",
        type: "mention",
        title: "Mention",
        message: "Hi",
        createdAt: "2026-06-10T10:00:00.000Z",
        metadata: {},
      } as Notification,
    ]);

    expect(count).toBe(2);
  });

  it("dedupes pending invites by invite_id", () => {
    const invites = getPendingInviteNotifications([
      {
        id: "n1",
        workspaceId: "ws1",
        userId: "u1",
        type: "invite",
        title: "Invite",
        message: "Join",
        createdAt: "2026-06-10T08:00:00.000Z",
        metadata: { invite_id: "inv-1" },
      } as Notification,
      {
        id: "n2",
        workspaceId: "ws1",
        userId: "u1",
        type: "invite",
        title: "Invite",
        message: "Join",
        createdAt: "2026-06-10T09:00:00.000Z",
        metadata: { invite_id: "inv-1" },
      } as Notification,
    ]);

    expect(invites).toHaveLength(1);
  });

  it("includes hidden unread items in the inbox and aligns badge count", () => {
    const read = Array.from({ length: 50 }, (_, i) => ({
      id: `read-${i}`,
      workspaceId: "ws1",
      userId: "u1",
      type: "comment" as const,
      title: `Read ${i}`,
      message: "Done",
      readAt: "2026-06-10T12:00:00.000Z",
      createdAt: `2026-06-10T12:${String(i).padStart(2, "0")}:00.000Z`,
      metadata: {},
    })) as Notification[];

    const hiddenUnread = {
      id: "hidden-unread",
      workspaceId: "ws1",
      userId: "u1",
      type: "mention",
      title: "Old mention",
      message: "Still unread",
      createdAt: "2026-06-01T08:00:00.000Z",
      metadata: {},
    } as Notification;

    const inbox = syncInboxFromFetches(read, [hiddenUnread]);

    expect(inbox.unreadNotifCount).toBe(1);
    expect(inbox.notifications.some((n) => n.id === "hidden-unread")).toBe(true);
    expect(buildInboxNotifications(read, [hiddenUnread]).filter((n) => !n.readAt)).toHaveLength(1);
  });

  it("keeps badge aligned with full unread fetch when inbox truncates unread at 50", () => {
    const unreadRows = Array.from({ length: 55 }, (_, i) => ({
      id: `unread-${i}`,
      workspaceId: "ws1",
      userId: "u1",
      type: "mention" as const,
      title: `Mention ${i}`,
      message: "Hi",
      createdAt: `2026-06-10T${String(i).padStart(2, "0")}:00:00.000Z`,
      metadata: {},
    })) as Notification[];

    const inbox = syncInboxFromFetches([], unreadRows);

    expect(inbox.unreadNotifCount).toBe(55);
    expect(inbox.notifications.filter((n) => !n.readAt)).toHaveLength(50);
    expect(resolveBellBadgeCount(inbox.notifications, unreadRows)).toBe(55);
    expect(syncUnreadCountFromList(inbox.notifications)).toBe(50);
  });

  it("dedupes pending list shares by list_share_id", () => {
    const shares = getPendingListShareNotifications([
      {
        id: "n1",
        workspaceId: "ws1",
        userId: "u1",
        type: "list_share",
        title: "Shared list",
        message: "Join",
        createdAt: "2026-06-10T08:00:00.000Z",
        metadata: { list_share_id: "share-1" },
      } as Notification,
      {
        id: "n2",
        workspaceId: "ws1",
        userId: "u1",
        type: "list_share",
        title: "Shared list",
        message: "Join",
        createdAt: "2026-06-10T09:00:00.000Z",
        metadata: { list_share_id: "share-1" },
      } as Notification,
    ]);

    expect(shares).toHaveLength(1);
  });

  it("excludes invites and list shares from the bell badge count", () => {
    expect(
      countBellBadgeUnread([
        {
          id: "inv",
          workspaceId: "ws1",
          userId: "u1",
          type: "invite",
          title: "Invite",
          message: "Join",
          createdAt: "2026-06-10T08:00:00.000Z",
          metadata: { invite_id: "inv-1" },
        } as Notification,
      ]),
    ).toBe(0);

    expect(
      countBellBadgeUnread([
        {
          id: "share",
          workspaceId: "ws1",
          userId: "u1",
          type: "list_share",
          title: "Shared list",
          message: "Review",
          createdAt: "2026-06-10T08:00:00.000Z",
          metadata: { list_share_id: "share-1" },
        } as Notification,
      ]),
    ).toBe(0);

    expect(
      countBellBadgeUnread([
        {
          id: "m1",
          workspaceId: "ws1",
          userId: "u1",
          type: "mention",
          title: "Mention",
          message: "Hi",
          createdAt: "2026-06-10T08:00:00.000Z",
          metadata: {},
        } as Notification,
      ]),
    ).toBe(1);
  });

  it("reconcileBellInbox injects unread rows missing from the recent fetch window", () => {
    const read = Array.from({ length: 50 }, (_, i) => ({
      id: `read-${i}`,
      workspaceId: "ws1",
      userId: "u1",
      type: "mention" as const,
      title: `Read ${i}`,
      message: "Done",
      readAt: "2026-06-10T12:00:00.000Z",
      createdAt: `2026-06-10T12:${String(i).padStart(2, "0")}:00.000Z`,
      metadata: {},
    })) as Notification[];

    const hiddenUnread = {
      id: "hidden-unread",
      workspaceId: "ws1",
      userId: "u1",
      type: "mention",
      title: "Old mention",
      message: "Still unread",
      createdAt: "2026-06-01T08:00:00.000Z",
      metadata: {},
    } as Notification;

    const inbox = reconcileBellInbox(read, [hiddenUnread]);
    expect(inbox.unreadNotifCount).toBe(1);
    expect(inbox.notifications.some((n) => n.id === "hidden-unread")).toBe(true);
    expect(getBellPanelNotifications(inbox.notifications, 20).filter(isBellUnread)).toHaveLength(1);
  });

  it("counts workspace badge unread per workspace and excludes invites", () => {
    const rows = [
      {
        id: "ws1-unread",
        workspaceId: "ws-1",
        userId: "u1",
        type: "mention",
        title: "Hi",
        message: "Ping",
        createdAt: "2026-06-10T08:00:00.000Z",
      },
      {
        id: "ws2-unread",
        workspaceId: "ws-2",
        userId: "u1",
        type: "comment",
        title: "Note",
        message: "Comment",
        createdAt: "2026-06-10T09:00:00.000Z",
      },
      {
        id: "ws1-invite",
        workspaceId: "ws-1",
        userId: "u1",
        type: "invite",
        title: "Invite",
        message: "Join",
        createdAt: "2026-06-10T10:00:00.000Z",
      },
    ] as Notification[];

    expect(countWorkspaceBadgeUnread(rows, "ws-1")).toBe(1);
    expect(countWorkspaceBadgeUnread(rows, "ws-2")).toBe(1);
  });

  it("builds workspace panel with unread first and workspace scope", () => {
    const rows = [
      {
        id: "read",
        workspaceId: "ws-1",
        userId: "u1",
        type: "mention",
        title: "Read",
        message: "Done",
        readAt: "2026-06-10T12:00:00.000Z",
        createdAt: "2026-06-10T08:00:00.000Z",
      },
      {
        id: "unread",
        workspaceId: "ws-1",
        userId: "u1",
        type: "mention",
        title: "Unread",
        message: "New",
        createdAt: "2026-06-10T09:00:00.000Z",
      },
      {
        id: "other-ws",
        workspaceId: "ws-2",
        userId: "u1",
        type: "mention",
        title: "Other",
        message: "Skip",
        createdAt: "2026-06-10T10:00:00.000Z",
      },
    ] as Notification[];

    const panel = getWorkspacePanelNotifications(rows, "ws-1", 10);
    expect(panel.map((n) => n.id)).toEqual(["unread", "read"]);
  });
});