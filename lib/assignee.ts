import type { Task, WorkspaceMember } from "@/types";

export function getAssigneeFirstName(label: string): string {
  const trimmed = label.trim();
  if (!trimmed || trimmed === "You" || trimmed === "Team member") return trimmed;
  return trimmed.split(/\s+/)[0] || trimmed;
}

export function getSearchResultDisplayName(result: {
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
}): string {
  if (result.fullName?.trim()) return result.fullName.trim();
  if (result.username?.trim()) return result.username.trim();
  if (result.email?.includes("@")) return result.email.split("@")[0];
  return "User";
}

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

/** Handle inserted after @ in comments (matches fanout mention resolution). */
export function getMemberMentionHandle(member: WorkspaceMember): string {
  const username = member.username?.trim().toLowerCase();
  if (username) return username;

  const firstName = member.fullName?.trim().split(/\s+/)[0];
  if (firstName) {
    const normalized = firstName.toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    return normalized || firstName.toLowerCase();
  }

  return member.userId?.slice(0, 8) || "member";
}

export function memberMatchesMentionQuery(
  member: WorkspaceMember,
  query: string,
  currentUserId?: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;

  const display = getMemberDisplayName(member, currentUserId).toLowerCase();
  const handle = getMemberMentionHandle(member).toLowerCase();
  const fullName = member.fullName?.trim().toLowerCase() || "";

  return display.includes(q) || handle.includes(q) || fullName.includes(q);
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