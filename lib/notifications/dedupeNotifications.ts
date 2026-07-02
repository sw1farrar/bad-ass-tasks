import type { Notification } from "@/types";

/** Stable key for collapsing duplicate rows that represent the same event. */
export function notificationDedupeKey(notification: Notification): string {
  const meta = notification.metadata ?? {};

  if (notification.type === "invite") {
    const inviteId = meta.invite_id as string | undefined;
    if (inviteId) return `invite:${inviteId}`;
  }

  if (notification.type === "list_share") {
    const shareId = meta.list_share_id as string | undefined;
    if (shareId) return `list_share:${shareId}`;
  }

  if (notification.type === "deadline") {
    const reminderKey = meta.reminder_key as string | undefined;
    if (reminderKey) return `deadline:${reminderKey}`;
    const taskId = meta.task_id as string | undefined;
    if (taskId) return `deadline:task:${taskId}`;
  }

  const commentId = meta.comment_id as string | undefined;
  if (commentId) return `${notification.type}:comment:${commentId}`;

  const activityLogId =
    notification.activityLogId || (meta.activity_log_id as string | undefined);
  if (activityLogId) return `${notification.type}:activity:${activityLogId}`;

  const noteId = meta.note_id as string | undefined;
  if (noteId && notification.type === "activity") return `activity:note:${noteId}`;
  if (noteId && notification.type === "inbound_file") return `inbound_file:note:${noteId}`;

  const taskId = meta.task_id as string | undefined;
  if (taskId) return `${notification.type}:task:${taskId}`;

  if (noteId) return `${notification.type}:note:${noteId}`;

  return `${notification.type}:${notification.workspaceId}:${notification.title}:${notification.message}`;
}

function preferNotification(current: Notification, candidate: Notification): Notification {
  if (!current.readAt && candidate.readAt) return current;
  if (current.readAt && !candidate.readAt) return candidate;
  return new Date(current.createdAt).getTime() >= new Date(candidate.createdAt).getTime()
    ? current
    : candidate;
}

/**
 * Collapse duplicate notification rows (same event, different ids) while keeping
 * the most relevant copy — unread beats read; otherwise newest wins.
 */
export function dedupeNotifications(notifications: Notification[]): Notification[] {
  const byId = new Map<string, Notification>();
  for (const notification of notifications) {
    if (!byId.has(notification.id)) {
      byId.set(notification.id, notification);
    }
  }

  const byKey = new Map<string, Notification>();
  for (const notification of byId.values()) {
    const key = notificationDedupeKey(notification);
    const existing = byKey.get(key);
    byKey.set(key, existing ? preferNotification(existing, notification) : notification);
  }

  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}