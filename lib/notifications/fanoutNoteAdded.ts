import type { NotificationType } from "@/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { logError } from "@/lib/logger";
import {
  isMissingNotificationPrefsColumn,
  warnMissingNotificationPrefsColumnOnce,
} from "@/lib/notifications/schemaFallback";
import {
  DEFAULT_NOTIFICATION_PREFS,
  normalizeNotificationPrefs,
  shouldDeliverNotification,
} from "@/lib/notifications/notificationPrefs";
import { sendNotificationEmail } from "@/lib/notifications/sendNotificationEmail";

export type FanoutNoteAddedParams = {
  workspaceId: string;
  noteId: string;
  noteTitle: string;
  actorUserId?: string | null;
  source?: "manual" | "email";
  supabase?: any;
};

type MemberProfileRow = {
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string | null;
    notification_prefs: unknown;
  } | null;
};

const NOTIFICATION_TYPE: NotificationType = "activity";

function resolveActorName(
  actorUserId: string | null | undefined,
  members: MemberProfileRow[],
): string {
  if (!actorUserId) return "Someone";
  const row = members.find((m) => m.user_id === actorUserId);
  const name = row?.profiles?.full_name?.trim();
  if (name) return name;
  const email = row?.profiles?.email?.trim();
  if (email) return email.split("@")[0] || "Someone";
  return "Someone";
}

function buildNotificationCopy(params: {
  noteTitle: string;
  actorName: string;
  workspaceName: string;
  source?: "manual" | "email";
}): { title: string; message: string } {
  const title = params.noteTitle.trim() || "New note";
  if (params.source === "email") {
    return {
      title: "New note from email",
      message: `"${title}" was added to ${params.workspaceName} via email inbox.`,
    };
  }
  return {
    title: "New note added",
    message: `${params.actorName} added "${title}" to ${params.workspaceName}.`,
  };
}

async function insertInAppNotification(
  supabase: any,
  payload: {
    workspaceId: string;
    userId: string;
    title: string;
    message: string;
    link: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await (supabase.from("notifications") as any).insert({
    workspace_id: payload.workspaceId,
    user_id: payload.userId,
    type: NOTIFICATION_TYPE,
    title: payload.title,
    message: payload.message,
    link: payload.link,
    metadata: payload.metadata,
  });

  if (error) {
    logError("fanoutNoteAdded:createNotification", error);
  }
}

/**
 * Notify workspace members when a note is added, respecting each user's notification prefs.
 * Safe to call fire-and-forget (.catch(() => {})).
 */
export async function fanoutNoteAddedNotifications(params: FanoutNoteAddedParams): Promise<void> {
  const workspaceId = params.workspaceId?.trim();
  const noteId = params.noteId?.trim();
  if (!workspaceId || !noteId || ["w1", "w2"].includes(workspaceId)) return;

  const supabase = params.supabase ?? getSupabaseClient();
  if (!supabase) return;

  try {
    const workspacePromise = (supabase as any)
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .maybeSingle();

    let membersResult = await (supabase as any)
      .from("workspace_members")
      .select("user_id, profiles(full_name, email, notification_prefs)")
      .eq("workspace_id", workspaceId);

    if (
      membersResult.error &&
      isMissingNotificationPrefsColumn(membersResult.error)
    ) {
      warnMissingNotificationPrefsColumnOnce();
      membersResult = await (supabase as any)
        .from("workspace_members")
        .select("user_id, profiles(full_name, email)")
        .eq("workspace_id", workspaceId);
    }

    const [{ data: members, error: membersError }, { data: workspace, error: wsError }] =
      await Promise.all([Promise.resolve(membersResult), workspacePromise]);

    if (membersError) {
      if (isMissingNotificationPrefsColumn(membersError)) {
        warnMissingNotificationPrefsColumnOnce();
        return;
      }
      logError("fanoutNoteAdded:members", membersError);
      return;
    }
    if (wsError) {
      logError("fanoutNoteAdded:workspace", wsError);
    }

    const memberRows = (members ?? []) as MemberProfileRow[];
    if (memberRows.length === 0) return;

    const workspaceName = (workspace as { name?: string } | null)?.name?.trim() || "your workspace";
    const actorUserId = params.actorUserId ?? null;
    const actorName = resolveActorName(actorUserId, memberRows);
    const copy = buildNotificationCopy({
      noteTitle: params.noteTitle,
      actorName,
      workspaceName,
      source: params.source,
    });

    const link = "?view=notes";
    const metadata = {
      note_id: noteId,
      note_title: params.noteTitle,
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      actor_user_id: actorUserId,
      actor_name: actorName,
      source: params.source ?? "manual",
    };

    await Promise.all(
      memberRows.map(async (member) => {
        const recipientId = member.user_id;
        if (!recipientId) return;
        if (actorUserId && recipientId === actorUserId) return;

        const prefs = normalizeNotificationPrefs(
          member.profiles?.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS,
        );

        const deliverInApp = shouldDeliverNotification(prefs, workspaceId, NOTIFICATION_TYPE, "inApp");
        const deliverEmail = shouldDeliverNotification(prefs, workspaceId, NOTIFICATION_TYPE, "email");

        const tasks: Promise<unknown>[] = [];

        if (deliverInApp) {
          tasks.push(
            insertInAppNotification(supabase, {
              workspaceId,
              userId: recipientId,
              title: copy.title,
              message: copy.message,
              link,
              metadata,
            }),
          );
        }

        if (deliverEmail && member.profiles?.email) {
          tasks.push(
            sendNotificationEmail(member.profiles.email, NOTIFICATION_TYPE, {
              title: copy.title,
              message: copy.message,
              workspaceName,
              link,
              actor: actorName,
            }),
          );
        }

        await Promise.all(tasks);
      }),
    );
  } catch (err) {
    logError("fanoutNoteAdded", err);
  }
}