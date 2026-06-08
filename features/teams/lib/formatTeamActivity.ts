import type { ActivityLog, WorkspaceMember } from "@/types";
import { getMemberDisplayName } from "@/lib/assignee";
import { safeFormatDistanceToNow } from "@/lib/datetime";

export interface TeamActivityItem {
  id: string;
  headline: string;
  detail?: string;
  timeLabel: string;
}

const HIDDEN_PREFIXES = ["admin.", "workspace.switched"];

function actorLabel(log: ActivityLog, members: WorkspaceMember[]): string {
  const member = members.find((m) => m.userId === log.userId);
  if (member) return getMemberDisplayName(member);
  return log.userId ? log.userId.slice(0, 8) : "Someone";
}

function metaTitle(log: ActivityLog): string | undefined {
  const meta = log.metadata ?? {};
  const title = meta.title;
  return typeof title === "string" && title.trim() ? title.trim() : undefined;
}

export function formatTeamActivityItem(
  log: ActivityLog,
  members: WorkspaceMember[]
): TeamActivityItem | null {
  const action = log.actionType || "";
  if (HIDDEN_PREFIXES.some((p) => action.startsWith(p))) return null;

  const who = actorLabel(log, members);
  const subject = metaTitle(log);
  let headline = `${who} updated the workspace`;
  let detail: string | undefined = subject;

  switch (action) {
    case "task.created":
      headline = `${who} created a task`;
      break;
    case "task.completed":
      headline = `${who} completed a task`;
      break;
    case "task.updated":
      headline = `${who} updated a task`;
      break;
    case "note.created":
      headline = `${who} created a note`;
      break;
    case "note.updated":
      headline = `${who} updated a note`;
      break;
    case "comment.added":
      headline = `${who} commented`;
      detail = subject || (typeof log.metadata?.preview === "string" ? log.metadata.preview : undefined);
      break;
    case "invite.sent":
      headline = `${who} sent an invite`;
      break;
    case "member.joined":
      headline = `${who} joined the team`;
      detail = undefined;
      break;
    case "member.removed":
      headline = `${who} removed a member`;
      detail = undefined;
      break;
    default:
      if (action.includes("task")) headline = `${who} — task activity`;
      else if (action.includes("note")) headline = `${who} — note activity`;
      else headline = `${who} — ${action.replace(/\./g, " ")}`;
  }

  const timeLabel = safeFormatDistanceToNow(log.createdAt);

  return {
    id: log.id,
    headline,
    detail,
    timeLabel,
  };
}

export function buildTeamActivityFeed(
  activity: ActivityLog[],
  members: WorkspaceMember[],
  limit = 10
): TeamActivityItem[] {
  return activity
    .map((log) => formatTeamActivityItem(log, members))
    .filter((item): item is TeamActivityItem => item !== null)
    .slice(0, limit);
}