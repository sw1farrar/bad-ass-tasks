import type { Task, WorkspaceMember } from "@/types";
import { buildAssigneeBreakdown } from "@/lib/assignee";
import { startOfLocalToday, isDueDatePast, isDueDateToday } from "@/lib/datetime";

export interface TeamWorkspaceStats {
  openCount: number;
  dueTodayCount: number;
  overdueCount: number;
  assignedToMe: number;
  myOverdue: number;
  onlineCount: number;
}

export function computeTeamWorkspaceStats(
  tasks: Task[],
  userId?: string,
  onlineCount = 0
): TeamWorkspaceStats {
  const open = tasks.filter((t) => t.status !== "done");
  const today = startOfLocalToday();

  let dueTodayCount = 0;
  let overdueCount = 0;
  let assignedToMe = 0;
  let myOverdue = 0;

  for (const task of open) {
    const isMine = !!userId && (task.assigneeIds?.[0] === userId || task.assignee === "You");

    if (isMine) assignedToMe += 1;

    if (!task.dueDate) continue;

    if (isDueDatePast(task.dueDate, today)) {
      overdueCount += 1;
      if (isMine) myOverdue += 1;
    } else if (isDueDateToday(task.dueDate, today)) {
      dueTodayCount += 1;
    }
  }

  return {
    openCount: open.length,
    dueTodayCount,
    overdueCount,
    assignedToMe,
    myOverdue,
    onlineCount,
  };
}

export function computeMemberOpenTaskCounts(
  tasks: Task[],
  members: WorkspaceMember[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const member of members) {
    counts.set(member.userId, 0);
  }

  for (const task of tasks) {
    if (task.status === "done") continue;
    const assigneeId = task.assigneeIds?.[0];
    if (assigneeId && counts.has(assigneeId)) {
      counts.set(assigneeId, (counts.get(assigneeId) ?? 0) + 1);
    }
  }

  return counts;
}

export { buildAssigneeBreakdown };