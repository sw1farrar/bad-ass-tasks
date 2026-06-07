import { deliverNotification } from "@/lib/notifications/deliverNotification";

export type FanoutTaskAssignedParams = {
  workspaceId: string;
  workspaceName: string;
  taskId: string;
  taskTitle: string;
  assigneeIds: string[];
  actorUserId?: string | null;
  actorName: string;
  supabase?: any;
};

/** Notify newly assigned users when task assignees change. */
export async function fanoutTaskAssignedNotifications(params: FanoutTaskAssignedParams): Promise<void> {
  const title = params.taskTitle.trim() || "Task";
  const link = `?view=tasks&task=${params.taskId}`;

  await Promise.all(
    params.assigneeIds.map((assigneeId) =>
      deliverNotification({
        supabase: params.supabase,
        workspaceId: params.workspaceId,
        recipientUserId: assigneeId,
        type: "task_assigned",
        title: "Task assigned to you",
        message: `${params.actorName} assigned "${title}" to you in ${params.workspaceName}.`,
        link,
        workspaceName: params.workspaceName,
        actorUserId: params.actorUserId,
        metadata: {
          task_id: params.taskId,
          task_title: title,
          actor_name: params.actorName,
        },
      }),
    ),
  );
}