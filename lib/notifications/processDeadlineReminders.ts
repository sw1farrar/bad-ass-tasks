import { deliverNotification } from "@/lib/notifications/deliverNotification";
import { isReminderDismissed, reminderKeyForTask } from "@/lib/notifications/dismissedReminders";
import { logError } from "@/lib/logger";
import { getSupabaseClient } from "@/lib/supabase/client";
import { isDueDatePast, isDueDateToday, formatLocalDateShort } from "@/lib/utils";

type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  recurring_rule: string | null;
  workspace_id: string;
  assignee_ids: string[] | null;
};

function isReminderCandidate(task: TaskRow): boolean {
  if (!task.due_date) return false;
  if (isDueDateToday(task.due_date)) return true;
  return !!task.recurring_rule && isDueDatePast(task.due_date);
}

async function hasReminderToday(supabase: any, userId: string, taskId: string): Promise<boolean> {
  const key = reminderKeyForTask(taskId);
  if (isReminderDismissed(userId, key)) return true;
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "deadline")
    .contains("metadata", { reminder_key: key })
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
}

/**
 * Create in-app + email deadline reminders for tasks due today.
 * Called when the user loads notifications (at most once per task per day).
 */
export async function processDeadlineReminders(userId: string, supabase?: any): Promise<void> {
  if (!userId) return;

  const client = supabase ?? getSupabaseClient();
  if (!client) return;

  try {
    const { data: tasks, error } = await client
      .from("tasks")
      .select("id, title, due_date, recurring_rule, workspace_id, assignee_ids")
      .contains("assignee_ids", [userId])
      .not("due_date", "is", null)
      .neq("status", "done");

    if (error) {
      logError("processDeadlineReminders:tasks", error);
      return;
    }

    const dueForReminder = ((tasks ?? []) as TaskRow[]).filter(isReminderCandidate);

    if (dueForReminder.length === 0) return;

    const workspaceIds = Array.from(new Set(dueForReminder.map((t) => t.workspace_id)));
    const { data: workspaces } = await client
      .from("workspaces")
      .select("id, name")
      .in("id", workspaceIds);

    const workspaceNames = new Map<string, string>();
    for (const ws of (workspaces ?? []) as Array<{ id: string; name?: string }>) {
      workspaceNames.set(ws.id, ws.name?.trim() || "your workspace");
    }

    // Sequential delivery avoids check-then-insert races between parallel reminders.
    for (const task of dueForReminder) {
      const key = reminderKeyForTask(task.id);
      if (isReminderDismissed(userId, key)) continue;
      if (await hasReminderToday(client, userId, task.id)) continue;

      const dueLabel = task.due_date ? formatLocalDateShort(task.due_date) : "today";
      const workspaceName = workspaceNames.get(task.workspace_id) || "your workspace";
      const isOverdueRecurring =
        !!task.recurring_rule && task.due_date && isDueDatePast(task.due_date) && !isDueDateToday(task.due_date);

      await deliverNotification({
        supabase: client,
        workspaceId: task.workspace_id,
        recipientUserId: userId,
        type: "deadline",
        title: isOverdueRecurring ? "Recurring task overdue" : "Task due today",
        message: isOverdueRecurring
          ? `"${task.title.trim() || "Task"}" is overdue (${dueLabel}) in ${workspaceName}.`
          : `"${task.title.trim() || "Task"}" is due ${dueLabel} in ${workspaceName}.`,
        link: `?view=tasks&task=${task.id}`,
        workspaceName,
        metadata: {
          task_id: task.id,
          task_title: task.title,
          due_date: task.due_date,
          reminder_key: key,
        },
      });
    }
  } catch (err) {
    logError("processDeadlineReminders", err);
  }
}