import { logger } from "@/lib/logger";

let notificationPrefsColumnWarned = false;

/** PostgREST 42703 when profiles.notification_prefs has not been migrated yet. */
export function isMissingNotificationPrefsColumn(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  return e?.code === "42703" && String(e.message || "").includes("notification_prefs");
}

/** Log once per session — avoids console spam on every prefs load/fanout. */
export function warnMissingNotificationPrefsColumnOnce(): void {
  if (notificationPrefsColumnWarned) return;
  notificationPrefsColumnWarned = true;
  logger.warn(
    "profiles.notification_prefs column missing (expected until migration is applied). Using default notification preferences.",
    { hint: "Run supabase/add-notification-prefs.sql in the Supabase SQL editor." },
  );
}