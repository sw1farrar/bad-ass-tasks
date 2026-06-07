import { deliverNotification } from "@/lib/notifications/deliverNotification";
import { extractMentions } from "@/lib/data/hybridStore";
import type { WorkspaceMember } from "@/types";

export type FanoutCommentParams = {
  workspaceId: string;
  workspaceName: string;
  actorUserId: string;
  actorName: string;
  content: string;
  commentId: string;
  taskId?: string;
  noteId?: string;
  taskTitle?: string;
  noteTitle?: string;
  taskAssigneeIds?: string[];
  members: WorkspaceMember[];
  supabase?: any;
};

function resolveMentionedUserIds(handles: string[], members: WorkspaceMember[]): string[] {
  const normalized = new Set(handles.map((h) => h.toLowerCase()));
  const ids = new Set<string>();

  for (const member of members) {
    const username = member.username?.trim().toLowerCase();
    const fullName = member.fullName?.trim().toLowerCase();
    const firstName = fullName?.split(/\s+/)[0];

    if (username && normalized.has(username)) ids.add(member.userId);
    if (firstName && normalized.has(firstName)) ids.add(member.userId);
  }

  return Array.from(ids);
}

/**
 * Notify mentioned users and task assignees about a new comment.
 */
export async function fanoutCommentNotifications(params: FanoutCommentParams): Promise<void> {
  const targetLabel = params.taskId
    ? params.taskTitle?.trim() || "a task"
    : params.noteTitle?.trim() || "a note";
  const link = params.taskId ? `?view=tasks&task=${params.taskId}` : "?view=notes";
  const preview = params.content.trim().slice(0, 120);

  const mentionedHandles = extractMentions(params.content);
  const mentionedUserIds = resolveMentionedUserIds(mentionedHandles, params.members);

  const mentionTasks = mentionedUserIds.map((userId) =>
    deliverNotification({
      supabase: params.supabase,
      workspaceId: params.workspaceId,
      recipientUserId: userId,
      type: "mention",
      title: `@mention in ${params.taskId ? "task" : "note"} comment`,
      message: `${params.actorName} mentioned you on "${targetLabel}": ${preview}`,
      link,
      workspaceName: params.workspaceName,
      actorUserId: params.actorUserId,
      metadata: {
        comment_id: params.commentId,
        task_id: params.taskId,
        note_id: params.noteId,
        actor_name: params.actorName,
        handles: mentionedHandles,
      },
    }),
  );

  const commentRecipients = new Set<string>();
  if (params.taskId && params.taskAssigneeIds?.length) {
    for (const assigneeId of params.taskAssigneeIds) {
      if (
        assigneeId &&
        assigneeId !== params.actorUserId &&
        !mentionedUserIds.includes(assigneeId)
      ) {
        commentRecipients.add(assigneeId);
      }
    }
  }

  const commentTasks = Array.from(commentRecipients).map((userId) =>
    deliverNotification({
      supabase: params.supabase,
      workspaceId: params.workspaceId,
      recipientUserId: userId,
      type: "comment",
      title: `New comment on "${targetLabel}"`,
      message: `${params.actorName}: ${preview}`,
      link,
      workspaceName: params.workspaceName,
      actorUserId: params.actorUserId,
      metadata: {
        comment_id: params.commentId,
        task_id: params.taskId,
        note_id: params.noteId,
        actor_name: params.actorName,
      },
    }),
  );

  await Promise.all([...mentionTasks, ...commentTasks]);
}