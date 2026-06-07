import type { Notification, Task } from "@/types";

export type HomeFocusItem = {
  task: Task;
  workspaceId: string;
  workspaceName: string;
};

export type HomeAttentionItem =
  | {
      id: string;
      kind: "task";
      title: string;
      subtitle: string;
      workspaceId: string;
      workspaceName: string;
      urgency: "high" | "normal";
      taskId: string;
      focusItem: HomeFocusItem;
    }
  | {
      id: string;
      kind: "invite";
      title: string;
      subtitle: string;
      workspaceName: string;
      urgency: "high";
      inviteId: string;
      notificationId: string;
    }
  | {
      id: string;
      kind: "notification";
      title: string;
      subtitle: string;
      workspaceId?: string;
      urgency: "normal";
      notificationId: string;
    };

/**
 * Non-task items that need a response: invites + unread notifications.
 * Due tasks live exclusively in the "Up next" section on Home.
 */
export function buildAttentionItems(
  _focusItems: HomeFocusItem[],
  notifications: Notification[]
): HomeAttentionItem[] {
  const items: HomeAttentionItem[] = [];

  const pendingInvites = notifications.filter((n) => n.type === "invite" && !n.readAt);
  for (const invite of pendingInvites.slice(0, 3)) {
    const meta = invite.metadata || {};
    const from =
      (meta.invited_by_full_name as string | undefined) ||
      (meta.invited_by_name as string | undefined) ||
      "Someone";
    const wsName = (meta.workspace_name as string | undefined) || "a workspace";
    const inviteId = (meta.invite_id as string | undefined) || invite.id;
    items.push({
      id: `invite-${invite.id}`,
      kind: "invite",
      title: `Invite to ${wsName}`,
      subtitle: `${from} invited you`,
      workspaceName: wsName,
      urgency: "high",
      inviteId,
      notificationId: invite.id,
    });
  }

  const unreadOther = notifications.filter(
    (n) => !n.readAt && n.type !== "invite"
  );
  for (const notif of unreadOther.slice(0, 4)) {
    items.push({
      id: `notif-${notif.id}`,
      kind: "notification",
      title: notif.title || notif.message,
      subtitle: notif.message !== notif.title ? notif.message : notif.type,
      workspaceId: notif.workspaceId,
      urgency: "normal",
      notificationId: notif.id,
    });
  }

  return items.slice(0, 10);
}