import type { NotificationType } from "@/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { logError } from "@/lib/logger";
import {
  isMissingNotificationPrefsColumn,
  warnMissingNotificationPrefsColumnOnce,
} from "@/lib/notifications/schemaFallback";
import { deliverNotification } from "@/lib/notifications/deliverNotification";

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

const MANUAL_NOTIFICATION_TYPE: NotificationType = "activity";
const INBOUND_FILE_NOTIFICATION_TYPE: NotificationType = "inbound_file";

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
      title: "New file from email",
      message: `"${title}" was emailed into ${params.workspaceName} and is ready for review.`,
    };
  }
  return {
    title: "New note added",
    message: `${params.actorName} added "${title}" to ${params.workspaceName}.`,
  };
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

    const isInboundFile = params.source === "email";
    const notificationType = isInboundFile
      ? INBOUND_FILE_NOTIFICATION_TYPE
      : MANUAL_NOTIFICATION_TYPE;
    const link = "?view=notes";
    const metadata = {
      note_id: noteId,
      note_title: params.noteTitle,
      actor_name: actorName,
      source: params.source ?? "manual",
    };

    await Promise.all(
      memberRows.map((member) => {
        const recipientId = member.user_id;
        if (!recipientId) return Promise.resolve();
        return deliverNotification({
          supabase,
          workspaceId,
          recipientUserId: recipientId,
          type: notificationType,
          title: copy.title,
          message: copy.message,
          link,
          workspaceName,
          // Inbound files notify every member, including the inbox creator.
          actorUserId: isInboundFile ? undefined : actorUserId,
          metadata,
          recipientProfile: {
            email: member.profiles?.email ?? null,
            notification_prefs: member.profiles?.notification_prefs,
          },
        });
      }),
    );
  } catch (err) {
    logError("fanoutNoteAdded", err);
  }
}