import { deliverNotification } from "@/lib/notifications/deliverNotification";
import { logError } from "@/lib/logger";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatLocalDateShort } from "@/lib/utils";

type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  workspace_id: string;
  assignee_ids: string[] | null;
};

function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isDueToday(dueDate: string): boolean {
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = startOfLocalDay();
  const dueDay = startOfLocalDay(due);
  return dueDay.getTime() === today.getTime();
}

function reminderKey(taskId: string): string {
  const day = startOfLocalDay().toISOString().slice(0, 10);
  return `deadline:${taskId}:${day}`;
}

async function hasReminderToday(supabase: any, userId: string, taskId: string): Promise<boolean> {
  const key = reminderKey(taskId);
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
      .select("id, title, due_date, workspace_id, assignee_ids")
      .contains("assignee_ids", [userId])
      .not("due_date", "is", null)
      .neq("status", "done");

    if (error) {
      logError("processDeadlineReminders:tasks", error);
      return;
    }

    const dueToday = ((tasks ?? []) as TaskRow[]).filter(
      (task) => task.due_date && isDueToday(task.due_date),
    );

    if (dueToday.length === 0) return;

    const workspaceIds = Array.from(new Set(dueToday.map((t) => t.workspace_id)));
    const { data: workspaces } = await client
      .from("workspaces")
      .select("id, name")
      .in("id", workspaceIds);

    const workspaceNames = new Map<string, string>();
    for (const ws of (workspaces ?? []) as Array<{ id: string; name?: string }>) {
      workspaceNames.set(ws.id, ws.name?.trim() || "your workspace");
    }

    await Promise.all(
      dueToday.map(async (task) => {
        if (await hasReminderToday(client, userId, task.id)) return;

        const dueLabel = task.due_date ? formatLocalDateShort(task.due_date) : "today";
        const workspaceName = workspaceNames.get(task.workspace_id) || "your workspace";

        await deliverNotification({
          supabase: client,
          workspaceId: task.workspace_id,
          recipientUserId: userId,
          type: "deadline",
          title: "Task due today",
          message: `"${task.title.trim() || "Task"}" is due ${dueLabel} in ${workspaceName}.`,
          link: `?view=tasks&task=${task.id}`,
          workspaceName,
          metadata: {
            task_id: task.id,
            task_title: task.title,
            due_date: task.due_date,
            reminder_key: reminderKey(task.id),
          },
        });
      }),
    );
  } catch (err) {
    logError("processDeadlineReminders", err);
  }
}