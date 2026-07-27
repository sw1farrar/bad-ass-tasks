import { notificationDedupeKey } from "@/lib/notifications/dedupeNotifications";
import type { Notification, NotificationType } from "@/types";

/**
 * Metadata subset for insert idempotency (.contains) and sibling lookups.
 * Priority mirrors notificationDedupeKey so deliver + dedupe stay aligned.
 */
export function idempotencyMetadataMatch(
  type: NotificationType,
  metadata: Record<string, unknown> = {},
  activityLogId?: string | null,
): Record<string, unknown> | null {
  if (type === "invite" && metadata.invite_id) {
    return { invite_id: metadata.invite_id };
  }

  if (type === "list_share" && metadata.list_share_id) {
    return { list_share_id: metadata.list_share_id };
  }

  if (type === "deadline" && metadata.reminder_key) {
    return { reminder_key: metadata.reminder_key };
  }

  if (metadata.comment_id) {
    return { comment_id: metadata.comment_id };
  }

  const logId = activityLogId ?? metadata.activity_log_id;
  if (logId) {
    return { activity_log_id: logId };
  }

  if (
    type === "activity" &&
    metadata.event === "list_item_completed" &&
    metadata.list_item_id
  ) {
    return {
      event: "list_item_completed",
      list_item_id: metadata.list_item_id,
      ...(metadata.completed_at ? { completed_at: metadata.completed_at } : {}),
    };
  }

  if (
    type === "activity" &&
    metadata.event === "task_completed" &&
    metadata.task_id
  ) {
    return {
      event: "task_completed",
      task_id: metadata.task_id,
      ...(metadata.completed_at ? { completed_at: metadata.completed_at } : {}),
    };
  }

  if ((type === "activity" || type === "inbound_file") && metadata.note_id) {
    return { note_id: metadata.note_id };
  }

  if (type === "task_assigned" && metadata.task_id) {
    return { task_id: metadata.task_id };
  }

  if (type === "deadline" && metadata.task_id) {
    return { task_id: metadata.task_id };
  }

  return null;
}

export function usesFallbackDedupeKey(notification: Notification): boolean {
  return idempotencyMetadataMatch(
    notification.type,
    notification.metadata ?? {},
    notification.activityLogId,
  ) === null;
}

type SiblingQuery =
  | { kind: "metadata"; type: NotificationType; match: Record<string, unknown> }
  | {
      kind: "fallback";
      type: NotificationType;
      workspaceId: string;
      title: string;
      message: string;
    };

export function siblingQueryForNotification(notification: Notification): SiblingQuery | null {
  const metadata = notification.metadata ?? {};
  const match = idempotencyMetadataMatch(
    notification.type,
    metadata,
    notification.activityLogId,
  );

  if (match) {
    return { kind: "metadata", type: notification.type, match };
  }

  if (usesFallbackDedupeKey(notification)) {
    return {
      kind: "fallback",
      type: notification.type,
      workspaceId: notification.workspaceId,
      title: notification.title,
      message: notification.message,
    };
  }

  return null;
}

export function notificationMatchesSiblingQuery(
  notification: Notification,
  query: SiblingQuery,
): boolean {
  if (query.kind === "metadata") {
    if (notification.type !== query.type) return false;
    const match = idempotencyMetadataMatch(
      notification.type,
      notification.metadata ?? {},
      notification.activityLogId,
    );
    if (!match) return false;
    return Object.entries(query.match).every(
      ([key, value]) => (notification.metadata ?? {})[key] === value,
    );
  }

  return (
    notification.type === query.type &&
    notification.workspaceId === query.workspaceId &&
    notification.title === query.title &&
    notification.message === query.message
  );
}

/** Expand seed notifications to every row id that shares the same dedupe key. */
export async function fetchNotificationsByMetadataMatch(
  supabase: any,
  userId: string,
  type: NotificationType,
  match: Record<string, unknown>,
): Promise<Notification[]> {
  const queries: Promise<{ data: unknown[] | null; error: unknown }>[] = [
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("type", type)
      .contains("metadata", match),
  ];

  if (match.activity_log_id) {
    queries.push(
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("type", type)
        .eq("activity_log_id", match.activity_log_id),
    );
  }

  const results = await Promise.all(queries);
  const byId = new Map<string, Notification>();

  for (const result of results) {
    if (result.error) continue;
    for (const row of result.data ?? []) {
      const mapped = row as {
        id: string;
        workspace_id: string;
        user_id: string;
        type: string;
        title: string;
        message: string;
        link?: string | null;
        read_at?: string | null;
        created_at: string;
        metadata?: Record<string, unknown> | null;
        activity_log_id?: string | null;
      };
      byId.set(mapped.id, {
        id: mapped.id,
        workspaceId: mapped.workspace_id,
        userId: mapped.user_id,
        type: mapped.type as NotificationType,
        title: mapped.title,
        message: mapped.message,
        link: mapped.link ?? undefined,
        readAt: mapped.read_at ?? undefined,
        createdAt: mapped.created_at,
        metadata: mapped.metadata ?? {},
        activityLogId: mapped.activity_log_id ?? undefined,
      });
    }
  }

  return [...byId.values()];
}

export function expandToSiblingIds(
  seeds: Notification[],
  candidates: Notification[],
): string[] {
  const queries = seeds
    .map((seed) => siblingQueryForNotification(seed))
    .filter((query): query is SiblingQuery => query !== null);

  if (queries.length === 0) {
    return [...new Set(seeds.map((seed) => seed.id))];
  }

  const keys = new Set(seeds.map((seed) => notificationDedupeKey(seed)));
  const ids = new Set<string>();

  for (const candidate of candidates) {
    if (!keys.has(notificationDedupeKey(candidate))) continue;
    const matchesQuery = queries.some((query) =>
      notificationMatchesSiblingQuery(candidate, query),
    );
    if (matchesQuery) ids.add(candidate.id);
  }

  for (const seed of seeds) {
    ids.add(seed.id);
  }

  return [...ids];
}