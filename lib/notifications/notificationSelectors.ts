import {
  dedupeNotifications,
  notificationDedupeKey,
} from "@/lib/notifications/dedupeNotifications";
import type { Notification } from "@/types";

/** Action-required types use the persistent banner, not the bell badge. */
const BELL_BADGE_EXCLUDED_TYPES = new Set<Notification["type"]>(["invite", "list_share"]);

function countsForBellBadge(notification: Notification): boolean {
  return !notification.readAt && !BELL_BADGE_EXCLUDED_TYPES.has(notification.type);
}

export function getDedupedNotifications(notifications: Notification[]): Notification[] {
  return dedupeNotifications(notifications);
}

export function countUnreadDeduped(notifications: Notification[]): number {
  return getDedupedNotifications(notifications).filter((n) => !n.readAt).length;
}

/** Bell badge: unread excluding invites and list shares (those use persistent banners). */
export function countBellBadgeUnread(notifications: Notification[]): number {
  return getDedupedNotifications(notifications).filter(countsForBellBadge).length;
}

/** Workspace tile badge: unread in one workspace, excluding invites. */
export function countWorkspaceBadgeUnread(
  notifications: Notification[],
  workspaceId: string,
): number {
  return getDedupedNotifications(notifications).filter(
    (n) => n.workspaceId === workspaceId && countsForBellBadge(n),
  ).length;
}

/** Workspace tile panel: unread first, then read; scoped to one workspace. */
export function getWorkspacePanelNotifications(
  notifications: Notification[],
  workspaceId: string,
  maxVisible = 20,
): Notification[] {
  const deduped = getDedupedNotifications(notifications).filter(
    (n) => n.workspaceId === workspaceId && !BELL_BADGE_EXCLUDED_TYPES.has(n.type),
  );
  const unread = deduped.filter((n) => !n.readAt);
  const read = deduped.filter((n) => !!n.readAt);

  if (unread.length >= maxVisible) {
    return unread.slice(0, maxVisible);
  }

  return [...unread, ...read.slice(0, maxVisible - unread.length)];
}

/**
 * Build the bell inbox: always include every unread item, then fill with recent read.
 * Fixes badge/list drift when old unread rows fall outside the recent fetch window.
 */
export function buildInboxNotifications(
  recentRows: Notification[],
  unreadRows: Notification[],
  maxItems = 50,
): Notification[] {
  const dedupedUnread = dedupeNotifications(unreadRows);
  const dedupedRecent = dedupeNotifications(recentRows);
  const unreadIds = new Set(dedupedUnread.map((n) => n.id));
  const unreadKeys = new Set(dedupedUnread.map(notificationDedupeKey));

  const readRecent = dedupedRecent.filter(
    (n) =>
      !!n.readAt &&
      !unreadIds.has(n.id) &&
      !unreadKeys.has(notificationDedupeKey(n)),
  );

  const sortNewestFirst = (a: Notification, b: Notification) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  const sortedUnread = [...dedupedUnread].sort(sortNewestFirst);
  const sortedRead = [...readRecent].sort(sortNewestFirst);
  const unreadCap = Math.min(sortedUnread.length, maxItems);
  const readSlots = Math.max(0, maxItems - unreadCap);

  return [...sortedUnread.slice(0, unreadCap), ...sortedRead.slice(0, readSlots)];
}

/**
 * Merge recent + unread fetches into a single inbox and authoritative badge count.
 * Injects any badge-eligible unread rows missing from the capped inbox build.
 */
export function reconcileBellInbox(
  recentRows: Notification[],
  unreadRows: Notification[],
  maxItems = 50,
): { notifications: Notification[]; unreadNotifCount: number; overflowUnread: number } {
  const dedupedUnread = dedupeNotifications(unreadRows);
  const authoritativeBadge = countBellBadgeUnread(dedupedUnread);
  let notifications = buildInboxNotifications(recentRows, unreadRows, maxItems);
  let inboxBadge = countBellBadgeUnread(notifications);

  if (inboxBadge < authoritativeBadge) {
    const presentKeys = new Set(notifications.map(notificationDedupeKey));
    const missingUnread = dedupedUnread.filter(
      (n) =>
        countsForBellBadge(n) &&
        !presentKeys.has(notificationDedupeKey(n)),
    );
    if (missingUnread.length > 0) {
      notifications = dedupeNotifications([...missingUnread, ...notifications]).slice(
        0,
        maxItems,
      );
      inboxBadge = countBellBadgeUnread(notifications);
    }
  }

  return {
    notifications,
    unreadNotifCount: authoritativeBadge,
    overflowUnread: Math.max(0, authoritativeBadge - inboxBadge),
  };
}

export function syncInboxFromFetches(
  recentRows: Notification[],
  unreadRows: Notification[],
  maxItems = 50,
): { notifications: Notification[]; unreadNotifCount: number; overflowUnread: number } {
  return reconcileBellInbox(recentRows, unreadRows, maxItems);
}

/** Panel list: badge-eligible unread first, then banner types + read, capped for display. */
export function getBellPanelNotifications(
  notifications: Notification[],
  maxVisible = 20,
): Notification[] {
  const deduped = getDedupedNotifications(notifications);
  const unreadBadgeEligible = deduped.filter(countsForBellBadge);
  const rest = deduped.filter(
    (n) => n.readAt || BELL_BADGE_EXCLUDED_TYPES.has(n.type),
  );

  if (unreadBadgeEligible.length >= maxVisible) {
    return unreadBadgeEligible.slice(0, maxVisible);
  }

  return [
    ...unreadBadgeEligible,
    ...rest.slice(0, maxVisible - unreadBadgeEligible.length),
  ];
}

export function isBellUnread(notification: Notification): boolean {
  return countsForBellBadge(notification);
}

export function computeBellUnreadOverflow(
  notifications: Notification[],
  unreadNotifCount: number,
): number {
  return Math.max(0, unreadNotifCount - countBellBadgeUnread(notifications));
}

export function getPendingInviteNotifications(notifications: Notification[]): Notification[] {
  return getDedupedNotifications(notifications).filter(
    (n) => n.type === "invite" && !n.readAt,
  );
}

export function getPendingListShareNotifications(notifications: Notification[]): Notification[] {
  return getDedupedNotifications(notifications).filter(
    (n) => n.type === "list_share" && !n.readAt,
  );
}

/** Visible inbox unread only — may be capped at maxItems; not authoritative for the bell badge. */
export function syncUnreadCountFromList(notifications: Notification[]): number {
  return countBellBadgeUnread(notifications);
}

/** Authoritative bell badge: prefer full unread fetch over truncated inbox list. */
export function resolveBellBadgeCount(
  inboxNotifications: Notification[],
  authoritativeUnreadRows?: Notification[],
): number {
  if (authoritativeUnreadRows) {
    return countBellBadgeUnread(authoritativeUnreadRows);
  }
  return countBellBadgeUnread(inboxNotifications);
}

export function adjustBellBadgeCount(current: number, delta: number): number {
  return Math.max(0, current + delta);
}

function badgeDeltaOnMarkRead(notification: Notification): number {
  if (notification.readAt || BELL_BADGE_EXCLUDED_TYPES.has(notification.type)) return 0;
  return -1;
}

export function applyMarkReadBadgeDelta(currentBadge: number, notification: Notification): number {
  return adjustBellBadgeCount(currentBadge, badgeDeltaOnMarkRead(notification));
}

export function computeInsertBadgeDelta(
  current: Notification[],
  inserted: Notification,
): number {
  if (inserted.readAt || BELL_BADGE_EXCLUDED_TYPES.has(inserted.type)) return 0;
  if (current.some((n) => n.id === inserted.id)) return 0;
  const key = notificationDedupeKey(inserted);
  const existing = dedupeNotifications(current).find((n) => notificationDedupeKey(n) === key);
  if (!existing) return 1;
  if (existing.readAt && !inserted.readAt) return 1;
  return 0;
}

export function computeUpdateBadgeDelta(
  before: Notification | undefined,
  after: Notification,
): number {
  if (!before) return 0;
  const wasCounted = countsForBellBadge(before);
  const isCounted = countsForBellBadge(after);
  if (wasCounted && !isCounted) return -1;
  if (!wasCounted && isCounted) return 1;
  return 0;
}

export function computeDeleteBadgeDelta(deleted: Notification | undefined): number {
  if (!deleted || deleted.readAt || BELL_BADGE_EXCLUDED_TYPES.has(deleted.type)) return 0;
  return -1;
}

/** All non-invite unread ids for mark-all-read (includes rows beyond inbox cap). */
export function getMarkAllReadIds(unreadRows: Notification[]): string[] {
  return dedupeNotifications(unreadRows)
    .filter(countsForBellBadge)
    .map((n) => n.id);
}

export type RealtimeNotificationChange =
  | {
      eventType: "INSERT";
      currentNotifications: Notification[];
      currentBadge: number;
      inserted: Notification;
      maxItems?: number;
    }
  | {
      eventType: "UPDATE";
      currentNotifications: Notification[];
      currentBadge: number;
      updated: Notification;
      maxItems?: number;
    }
  | {
      eventType: "DELETE";
      currentNotifications: Notification[];
      currentBadge: number;
      deletedId: string;
      maxItems?: number;
    };

export function applyRealtimeNotificationChange(
  input: RealtimeNotificationChange,
): { notifications: Notification[]; unreadNotifCount: number } {
  const maxItems = input.maxItems ?? 50;
  const { currentNotifications, currentBadge } = input;

  if (input.eventType === "INSERT") {
    const { inserted } = input;
    if (currentNotifications.some((n) => n.id === inserted.id)) {
      return { notifications: currentNotifications, unreadNotifCount: currentBadge };
    }
    const merged = dedupeNotifications([inserted, ...currentNotifications]);
    const notifications = buildInboxNotifications(
      merged,
      merged.filter((n) => !n.readAt),
      maxItems,
    );
    const delta = computeInsertBadgeDelta(currentNotifications, inserted);
    return {
      notifications,
      unreadNotifCount: adjustBellBadgeCount(currentBadge, delta),
    };
  }

  if (input.eventType === "UPDATE") {
    const before = currentNotifications.find((n) => n.id === input.updated.id);
    const notifications = dedupeNotifications(
      currentNotifications.map((n) => (n.id === input.updated.id ? input.updated : n)),
    );
    const after = notifications.find((n) => n.id === input.updated.id);
    const delta = after ? computeUpdateBadgeDelta(before, after) : 0;
    return {
      notifications,
      unreadNotifCount: adjustBellBadgeCount(currentBadge, delta),
    };
  }

  const deleted = currentNotifications.find((n) => n.id === input.deletedId);
  const notifications = currentNotifications.filter((n) => n.id !== input.deletedId);
  const delta = computeDeleteBadgeDelta(deleted);
  return {
    notifications,
    unreadNotifCount: adjustBellBadgeCount(currentBadge, delta),
  };
}