import type { NotificationType } from "@/types";
import { logError } from "@/lib/logger";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  DEFAULT_NOTIFICATION_PREFS,
  normalizeNotificationPrefs,
  shouldDeliverNotification,
} from "@/lib/notifications/notificationPrefs";
import {
  isMissingNotificationPrefsColumn,
  warnMissingNotificationPrefsColumnOnce,
} from "@/lib/notifications/schemaFallback";
import { sendNotificationEmail } from "@/lib/notifications/sendNotificationEmail";

export type DeliverNotificationParams = {
  workspaceId: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  actorUserId?: string | null;
  workspaceName?: string;
  supabase?: any;
  /** When false, skips email even if prefs allow it (e.g. invite uses a dedicated template). */
  deliverEmail?: boolean;
  /** Skip profiles lookup when caller already joined member/profile data. */
  recipientProfile?: {
    email?: string | null;
    notification_prefs?: unknown;
  };
};

type RecipientProfile = {
  email: string | null;
  full_name: string | null;
  notification_prefs: unknown;
};

async function fetchRecipientProfile(
  supabase: any,
  userId: string,
): Promise<RecipientProfile | null> {
  let result = await supabase
    .from("profiles")
    .select("email, full_name, notification_prefs")
    .eq("id", userId)
    .maybeSingle();

  if (result.error && isMissingNotificationPrefsColumn(result.error)) {
    warnMissingNotificationPrefsColumnOnce();
    result = await supabase.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
  }

  if (result.error) {
    logError("deliverNotification:profile", result.error);
    return null;
  }

  return (result.data as RecipientProfile | null) ?? null;
}

async function insertInAppNotification(
  supabase: any,
  payload: {
    workspaceId: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await (supabase.from("notifications") as any).insert({
    workspace_id: payload.workspaceId,
    user_id: payload.userId,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    link: payload.link,
    metadata: payload.metadata,
  });

  if (error) {
    logError("deliverNotification:inApp", error);
  }
}

/**
 * Deliver a notification to one user, respecting per-type in-app and email prefs.
 * Safe to fire-and-forget (.catch(() => {})).
 */
export async function deliverNotification(params: DeliverNotificationParams): Promise<void> {
  const workspaceId = params.workspaceId?.trim();
  const recipientUserId = params.recipientUserId?.trim();
  if (!workspaceId || !recipientUserId || ["w1", "w2"].includes(workspaceId)) return;
  if (params.actorUserId && recipientUserId === params.actorUserId) return;

  const supabase = params.supabase ?? getSupabaseClient();
  if (!supabase) return;

  try {
    const profile =
      params.recipientProfile !== undefined
        ? {
            email: params.recipientProfile.email ?? null,
            full_name: null,
            notification_prefs: params.recipientProfile.notification_prefs,
          }
        : await fetchRecipientProfile(supabase, recipientUserId);
    if (!profile) return;

    const prefs = normalizeNotificationPrefs(
      profile.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS,
    );

    const deliverInApp = shouldDeliverNotification(prefs, workspaceId, params.type, "inApp");
    const deliverEmail =
      params.deliverEmail !== false &&
      shouldDeliverNotification(prefs, workspaceId, params.type, "email");

    if (!deliverInApp && !deliverEmail) return;

    const link = params.link ?? "?view=home";
    const metadata = {
      workspace_id: workspaceId,
      workspace_name: params.workspaceName,
      actor_user_id: params.actorUserId ?? null,
      ...(params.metadata ?? {}),
    };

    const tasks: Promise<unknown>[] = [];

    if (deliverInApp) {
      tasks.push(
        insertInAppNotification(supabase, {
          workspaceId,
          userId: recipientUserId,
          type: params.type,
          title: params.title,
          message: params.message,
          link,
          metadata,
        }),
      );
    }

    if (deliverEmail && profile.email) {
      tasks.push(
        sendNotificationEmail(profile.email, params.type, {
          title: params.title,
          message: params.message,
          workspaceName: params.workspaceName,
          link,
          actor: params.metadata?.actor_name as string | undefined,
        }),
      );
    }

    await Promise.all(tasks);
  } catch (err) {
    logError("deliverNotification", err);
  }
}

/** Check whether a recipient has a notification channel enabled. */
export async function recipientAllowsNotificationChannel(params: {
  recipientUserId: string;
  workspaceId: string;
  type: NotificationType;
  channel: "inApp" | "email";
  supabase?: any;
}): Promise<boolean> {
  const supabase = params.supabase ?? getSupabaseClient();
  if (!supabase) return false;

  const profile = await fetchRecipientProfile(supabase, params.recipientUserId);
  if (!profile) return false;

  const prefs = normalizeNotificationPrefs(
    profile.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS,
  );
  return shouldDeliverNotification(prefs, params.workspaceId, params.type, params.channel);
}