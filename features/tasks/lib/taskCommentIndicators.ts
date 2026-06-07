import type { Comment, TaskCommentSummary, WorkspaceMember } from "@/types";

export function getCommentAuthorLabel(
  comment: Comment,
  members?: WorkspaceMember[],
): string {
  if (comment.userName?.trim()) return comment.userName.trim();

  if (comment.userId && members?.length) {
    const member = members.find((m) => m.userId === comment.userId);
    if (member?.fullName?.trim()) return member.fullName.trim();
    if (member?.username?.trim()) return member.username.trim();
  }

  if (comment.userEmail) {
    const local = comment.userEmail.split("@")[0]?.trim();
    if (local) return local;
  }

  return comment.userId?.slice(0, 8) || "Someone";
}

export function taskCommentsReadKey(workspaceId: string, taskId: string) {
  return `${workspaceId}:${taskId}`;
}

export function buildTaskCommentSummaries(
  comments: Comment[],
  taskIds?: string[],
): Record<string, TaskCommentSummary> {
  const allowed = taskIds ? new Set(taskIds) : null;
  const map: Record<string, TaskCommentSummary> = {};

  for (const comment of comments) {
    if (!comment.taskId) continue;
    if (allowed && !allowed.has(comment.taskId)) continue;

    const existing = map[comment.taskId];
    if (!existing) {
      map[comment.taskId] = {
        count: 1,
        latestAt: comment.createdAt,
        latestUserId: comment.userId,
      };
      continue;
    }

    existing.count += 1;
    if (new Date(comment.createdAt).getTime() >= new Date(existing.latestAt).getTime()) {
      existing.latestAt = comment.updatedAt || comment.createdAt;
      existing.latestUserId = comment.userId;
    }
  }

  return map;
}

export function getTaskCommentIndicatorState(
  taskId: string,
  summaries: Record<string, TaskCommentSummary | undefined>,
  readAtMap: Record<string, string | undefined>,
  workspaceId: string,
  currentUserId?: string | null,
) {
  const summary = summaries[taskId];
  if (!summary?.count) {
    return { hasComments: false, unread: false, count: 0 };
  }

  const readAt = readAtMap[taskCommentsReadKey(workspaceId, taskId)];
  const ownerId = currentUserId || "me";

  const unread = !readAt
    ? summary.latestUserId !== ownerId
    : new Date(summary.latestAt).getTime() > new Date(readAt).getTime();

  return { hasComments: true, unread, count: summary.count };
}