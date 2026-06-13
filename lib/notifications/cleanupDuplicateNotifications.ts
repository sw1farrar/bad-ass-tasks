import {
  dedupeNotifications,
  notificationDedupeKey,
} from "@/lib/notifications/dedupeNotifications";
import { logError } from "@/lib/logger";
import type { Notification } from "@/types";

function preferKeepId(current: Notification, candidate: Notification): Notification {
  if (!current.readAt && candidate.readAt) return current;
  if (current.readAt && !candidate.readAt) return candidate;
  return new Date(current.createdAt).getTime() >= new Date(candidate.createdAt).getTime()
    ? current
    : candidate;
}

/**
 * Delete duplicate notification rows for a user, keeping the preferred copy per dedupe key.
 * Returns number of rows removed.
 */
export async function cleanupDuplicateNotifications(params: {
  supabase: any;
  userId: string;
  rows: Notification[];
}): Promise<number> {
  const { supabase, userId, rows } = params;
  if (!supabase || !userId || rows.length < 2) return 0;

  const byKey = new Map<string, Notification>();
  for (const row of rows) {
    const key = notificationDedupeKey(row);
    const existing = byKey.get(key);
    byKey.set(key, existing ? preferKeepId(existing, row) : row);
  }

  const keepIds = new Set(Array.from(byKey.values()).map((row) => row.id));
  const deleteIds = rows
    .map((row) => row.id)
    .filter((id) => !keepIds.has(id));

  if (deleteIds.length === 0) return 0;

  try {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", userId)
      .in("id", deleteIds);

    if (error) {
      logError("cleanupDuplicateNotifications", error);
      return 0;
    }

    return deleteIds.length;
  } catch (err) {
    logError("cleanupDuplicateNotifications", err);
    return 0;
  }
}

/** Group rows by dedupe key and return ids that should be deleted. */
export function duplicateIdsToDelete(rows: Notification[]): string[] {
  const deduped = dedupeNotifications(rows);
  const keepIds = new Set(deduped.map((row) => row.id));
  return rows.map((row) => row.id).filter((id) => !keepIds.has(id));
}