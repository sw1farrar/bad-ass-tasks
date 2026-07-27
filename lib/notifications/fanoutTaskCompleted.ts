import type { NotificationType } from "@/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { logError } from "@/lib/logger";
import {
  isMissingNotificationPrefsColumn,
  warnMissingNotificationPrefsColumnOnce,
} from "@/lib/notifications/schemaFallback";
import { deliverNotification } from "@/lib/notifications/deliverNotification";

export type FanoutTaskCompletedParams = {
  workspaceId: string;
  taskId: string;
  taskTitle: string;
  completedAt?: string | null;
  actorUserId?: string | null;
  workspaceName?: string;
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

function truncateLabel(value: string, max = 80): string {
  const trimmed = value.trim() || "Untitled";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/**
 * Notify workspace members when a teammate completes a task.
 * Excludes the actor. Safe to call fire-and-forget.
 */
export async function fanoutTaskCompletedNotifications(
  params: FanoutTaskCompletedParams,
): Promise<void> {
  const workspaceId = params.workspaceId?.trim();
  const taskId = params.taskId?.trim();
  if (!workspaceId || !taskId || ["w1", "w2"].includes(workspaceId)) return;

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

    if (membersResult.error && isMissingNotificationPrefsColumn(membersResult.error)) {
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
      logError("fanoutTaskCompleted:members", membersError);
      return;
    }
    if (wsError) {
      logError("fanoutTaskCompleted:workspace", wsError);
    }

    const memberRows = (members ?? []) as MemberProfileRow[];
    if (memberRows.length === 0) return;

    const workspaceName =
      params.workspaceName?.trim() ||
      (workspace as { name?: string } | null)?.name?.trim() ||
      "your workspace";
    const actorUserId = params.actorUserId ?? null;
    const actorName = resolveActorName(actorUserId, memberRows);
    const taskLabel = truncateLabel(params.taskTitle || "a task");
    const completedAt = params.completedAt?.trim() || new Date().toISOString();

    const title = "Task completed";
    const message = `${actorName} completed "${taskLabel}" in ${workspaceName}.`;
    const link = `?view=tasks&workspace=${workspaceId}&task=${taskId}`;

    await Promise.all(
      memberRows.map((member) => {
        const recipientId = member.user_id;
        if (!recipientId) return Promise.resolve();
        return deliverNotification({
          supabase,
          workspaceId,
          recipientUserId: recipientId,
          type: NOTIFICATION_TYPE,
          title,
          message,
          link,
          workspaceName,
          actorUserId,
          metadata: {
            event: "task_completed",
            task_id: taskId,
            task_title: params.taskTitle,
            completed_at: completedAt,
            actor_name: actorName,
          },
          recipientProfile: {
            email: member.profiles?.email ?? null,
            notification_prefs: member.profiles?.notification_prefs,
          },
        });
      }),
    );
  } catch (err) {
    logError("fanoutTaskCompleted", err);
  }
}

/** Load task title, then fan out completion notifications. */
export async function fanoutTaskCompletedById(params: {
  taskId: string;
  workspaceId: string;
  actorUserId?: string | null;
  completedAt?: string | null;
  taskTitle?: string | null;
  supabase?: any;
}): Promise<void> {
  const taskId = params.taskId?.trim();
  const workspaceId = params.workspaceId?.trim();
  if (!taskId || !workspaceId || ["w1", "w2"].includes(workspaceId)) return;

  const supabase = params.supabase ?? getSupabaseClient();
  if (!supabase) return;

  try {
    let taskTitle = params.taskTitle?.trim() || "";
    let completedAt = params.completedAt ?? null;

    if (!taskTitle || !completedAt) {
      const { data: task, error } = await supabase
        .from("tasks")
        .select("title, status, completed_at, workspace_id")
        .eq("id", taskId)
        .maybeSingle();

      if (error) {
        logError("fanoutTaskCompletedById:task", error);
        return;
      }
      if (!task || (task as { status?: string }).status !== "done") return;

      taskTitle = taskTitle || String((task as { title?: string }).title || "");
      completedAt =
        completedAt ?? (task as { completed_at?: string | null }).completed_at ?? null;
    }

    await fanoutTaskCompletedNotifications({
      supabase,
      workspaceId,
      taskId,
      taskTitle,
      completedAt,
      actorUserId: params.actorUserId,
    });
  } catch (err) {
    logError("fanoutTaskCompletedById", err);
  }
}
