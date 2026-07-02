import type {
  NotificationPrefs,
  NotificationType,
  NotificationTypeChannelPrefs,
} from "@/types";

export const NOTIFICATION_TYPES: NotificationType[] = [
  "mention",
  "comment",
  "invite",
  "list_share",
  "task_assigned",
  "deadline",
  "activity",
  "inbound_file",
];

const DEFAULT_TYPE_CHANNELS: NotificationTypeChannelPrefs = {
  inApp: true,
  email: true,
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  types: {
    mention: { ...DEFAULT_TYPE_CHANNELS },
    comment: { ...DEFAULT_TYPE_CHANNELS },
    invite: { ...DEFAULT_TYPE_CHANNELS },
    list_share: { ...DEFAULT_TYPE_CHANNELS },
    task_assigned: { ...DEFAULT_TYPE_CHANNELS },
    deadline: { ...DEFAULT_TYPE_CHANNELS },
    activity: { ...DEFAULT_TYPE_CHANNELS },
    inbound_file: { ...DEFAULT_TYPE_CHANNELS },
  },
  perWorkspace: {},
  muteUntil: null,
};

function normalizeTypeEntry(
  raw: unknown,
  globalInApp: boolean,
  globalEmail: boolean,
): NotificationTypeChannelPrefs {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const entry = raw as Record<string, unknown>;
    return {
      inApp: entry.inApp !== false,
      email: entry.email !== false,
    };
  }

  const legacyEnabled = raw !== false;
  return {
    inApp: legacyEnabled && globalInApp !== false,
    email: legacyEnabled && globalEmail !== false,
  };
}

/** Merge stored JSONB (legacy global + boolean per-type) into channel matrix. */
export function normalizeNotificationPrefs(raw: unknown): NotificationPrefs {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawTypes = (source.types && typeof source.types === "object" ? source.types : {}) as Record<
    string,
    unknown
  >;

  const globalInApp = source.inApp !== false;
  const globalEmail = source.email !== false;

  const assignmentLegacy = rawTypes.assignment;
  const taskAssignedRaw =
    rawTypes.task_assigned !== undefined ? rawTypes.task_assigned : assignmentLegacy;

  return {
    types: {
      mention: normalizeTypeEntry(rawTypes.mention, globalInApp, globalEmail),
      comment: normalizeTypeEntry(rawTypes.comment, globalInApp, globalEmail),
      invite: normalizeTypeEntry(rawTypes.invite, globalInApp, globalEmail),
      list_share: normalizeTypeEntry(rawTypes.list_share, globalInApp, globalEmail),
      task_assigned: normalizeTypeEntry(taskAssignedRaw, globalInApp, globalEmail),
      deadline: normalizeTypeEntry(rawTypes.deadline, globalInApp, globalEmail),
      activity: normalizeTypeEntry(rawTypes.activity, globalInApp, globalEmail),
      inbound_file: normalizeTypeEntry(rawTypes.inbound_file, globalInApp, globalEmail),
    },
    perWorkspace:
      source.perWorkspace && typeof source.perWorkspace === "object"
        ? (source.perWorkspace as NotificationPrefs["perWorkspace"])
        : {},
    muteUntil: typeof source.muteUntil === "string" ? source.muteUntil : null,
  };
}

export function getNotificationTypePref(
  prefs: NotificationPrefs,
  type: NotificationType,
): NotificationTypeChannelPrefs {
  return prefs.types[type] ?? { ...DEFAULT_TYPE_CHANNELS };
}

export function mergeNotificationTypePrefs(
  current: NotificationPrefs["types"],
  updates?: Partial<Record<NotificationType, Partial<NotificationTypeChannelPrefs>>>,
): NotificationPrefs["types"] {
  if (!updates) return current;

  const next = { ...current };
  for (const type of NOTIFICATION_TYPES) {
    const patch = updates[type];
    if (!patch) continue;
    next[type] = { ...current[type], ...patch };
  }
  return next;
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

  const typePref = getNotificationTypePref(prefs, type);
  return channel === "inApp" ? typePref.inApp !== false : typePref.email !== false;
}