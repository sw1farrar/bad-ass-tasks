import type { Task, WorkspaceMember } from "@/types";

export function getMemberDisplayName(
  member: WorkspaceMember,
  currentUserId?: string
): string {
  if (currentUserId && member.userId === currentUserId) return "You";
  return (
    member.fullName?.trim() ||
    member.username?.trim() ||
    member.userId?.slice(0, 8) ||
    "Member"
  );
}

export function isSharedWorkspace(members: WorkspaceMember[]): boolean {
  return (members || []).length > 1;
}

export function resolveAssigneeLabel(
  assigneeIds: string[] | undefined,
  members: WorkspaceMember[],
  currentUserId?: string
): string | undefined {
  const ids = assigneeIds?.filter(Boolean) ?? [];
  if (ids.length === 0) return undefined;

  const primaryId = ids[0];
  const member = members.find((m) => m.userId === primaryId);
  if (member) return getMemberDisplayName(member, currentUserId);

  if (currentUserId && primaryId === currentUserId) return "You";
  return "Team member";
}

export function enrichTaskWithAssignee(
  task: Task,
  members: WorkspaceMember[],
  currentUserId?: string
): Task {
  const ids = task.assigneeIds ?? [];
  if (ids.length > 0) {
    return {
      ...task,
      assignee: resolveAssigneeLabel(ids, members, currentUserId),
    };
  }
  return { ...task, assignee: undefined };
}

export function enrichTasksWithAssignees(
  tasks: Task[],
  members: WorkspaceMember[],
  currentUserId?: string
): Task[] {
  if (!members.length) return tasks;
  return tasks.map((t) => enrichTaskWithAssignee(t, members, currentUserId));
}

export interface AssigneeBreakdownItem {
  label: string;
  count: number;
}

export function buildAssigneeBreakdown(
  tasks: Task[],
  members: WorkspaceMember[],
  currentUserId?: string
): AssigneeBreakdownItem[] {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    if (task.status === "done") continue;
    const label = task.assignee || resolveAssigneeLabel(task.assigneeIds, members, currentUserId) || "Unassigned";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}