import { dedupeNotifications } from "@/lib/notifications/dedupeNotifications";
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
  focusItems: HomeFocusItem[],
  notifications: Notification[]
): HomeAttentionItem[] {
  const items: HomeAttentionItem[] = [];
  const deduped = dedupeNotifications(notifications);
  const visibleTaskIds = new Set(focusItems.map((f) => f.task.id));

  // Invites are surfaced by the global banner — avoid triple-display on Home.
  const unreadOther = deduped.filter((n) => {
    if (n.readAt || n.type === "invite") return false;
    if (
      n.type === "deadline" &&
      n.metadata?.task_id &&
      visibleTaskIds.has(String(n.metadata.task_id))
    ) {
      return false;
    }
    return true;
  });
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