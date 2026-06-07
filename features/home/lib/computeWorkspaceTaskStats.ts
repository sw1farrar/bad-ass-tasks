import { buildAssigneeBreakdown } from "@/lib/assignee";
import { isDueDatePast, isDueDateToday, startOfLocalToday } from "@/lib/datetime";
import type { Task, WorkspaceMember, WorkspaceTaskStats } from "@/types";

export function countOpenAndOverdueTasks(
  wsTasks: Task[],
  today: Date = startOfLocalToday(),
): { openCount: number; overdueCount: number } {
  const open = wsTasks.filter((t) => t.status !== "done");
  let overdueCount = 0;
  for (const t of open) {
    if (t.dueDate && isDueDatePast(t.dueDate, today)) overdueCount += 1;
  }
  return { openCount: open.length, overdueCount };
}

export function computeWorkspaceTaskStats(
  wsTasks: Task[],
  members: WorkspaceMember[],
  userId: string | undefined,
  today: Date = startOfLocalToday(),
): WorkspaceTaskStats {
  const totalTaskCount = wsTasks.length;
  const open = wsTasks.filter((t) => t.status !== "done");
  const { overdueCount } = countOpenAndOverdueTasks(wsTasks, today);
  let dueTodayCount = 0;
  for (const t of open) {
    if (!t.dueDate) continue;
    if (isDueDateToday(t.dueDate, today)) dueTodayCount += 1;
  }
  return {
    openCount: open.length,
    totalTaskCount,
    doneCount: totalTaskCount - open.length,
    overdueCount,
    dueTodayCount,
    assigneeBreakdown: buildAssigneeBreakdown(open, members, userId),
  };
}