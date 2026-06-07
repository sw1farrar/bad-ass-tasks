import type { NotificationPrefs, NotificationType } from "@/types";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  email: true,
  inApp: true,
  types: {
    mention: true,
    comment: true,
    invite: true,
    task_assigned: true,
    deadline: true,
    activity: true,
  },
  perWorkspace: {},
  muteUntil: null,
};

/** Merge stored JSONB (schema may use legacy `assignment` key) into app NotificationPrefs. */
export function normalizeNotificationPrefs(raw: unknown): NotificationPrefs {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawTypes = (source.types && typeof source.types === "object" ? source.types : {}) as Record<
    string,
    boolean | undefined
  >;

  return {
    email: source.email !== false,
    inApp: source.inApp !== false,
    types: {
      mention: rawTypes.mention !== false,
      comment: rawTypes.comment !== false,
      invite: rawTypes.invite !== false,
      task_assigned: rawTypes.task_assigned !== false && rawTypes.assignment !== false,
      deadline: rawTypes.deadline !== false,
      activity: rawTypes.activity !== false,
    },
    perWorkspace:
      source.perWorkspace && typeof source.perWorkspace === "object"
        ? (source.perWorkspace as NotificationPrefs["perWorkspace"])
        : {},
    muteUntil: typeof source.muteUntil === "string" ? source.muteUntil : null,
  };
}

export function isNotificationMuted(prefs: NotificationPrefs, workspaceId: string): boolean {
  if (prefs.muteUntil) {
    const until = new Date(prefs.muteUntil).getTime();
    if (!Number.isNaN(until) && until > Date.now()) return true;
  }
  const perWs = prefs.perWorkspace?.[workspaceId];
  return perWs?.muted === true;
}

export function shouldDeliverNotification(
  prefs: NotificationPrefs,
  workspaceId: string,
  type: NotificationType,
  channel: "inApp" | "email",
): boolean {
  if (isNotificationMuted(prefs, workspaceId)) return false;

  const perWs = prefs.perWorkspace?.[workspaceId];
  if (channel === "email" && perWs?.email === false) return false;

  const globalChannel = channel === "inApp" ? prefs.inApp : prefs.email;
  if (globalChannel === false) return false;

  return prefs.types[type] !== false;
}