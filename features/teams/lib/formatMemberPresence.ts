import type { ActivityLog, Task, WorkspaceMember } from "@/types";
import { safeFormatDistanceToNow } from "@/lib/datetime";

export function formatMemberLastActive(lastActiveAt?: string): string | null {
  if (!lastActiveAt) return null;
  const label = safeFormatDistanceToNow(lastActiveAt, "");
  if (!label) return null;
  return `Active ${label}`;
}

export function formatMemberJoined(joinedAt?: string): string | null {
  if (!joinedAt) return null;
  const label = safeFormatDistanceToNow(joinedAt, "");
  if (!label) return null;
  return `Joined ${label}`;
}

/** Pick the latest ISO timestamp among candidates. */
export function latestTimestamp(...candidates: Array<string | null | undefined>): string | undefined {
  let best: string | undefined;
  let bestMs = -Infinity;
  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    const ms = new Date(raw).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = raw;
    }
  }
  return best;
}

/**
 * True when last-active is essentially the join time (legacy: last_active_at
 * was never bumped after account creation).
 */
export function isStaleLastActiveEchoingJoin(
  lastActiveAt?: string | null,
  joinedAt?: string | null,
  windowMs = 24 * 60 * 60 * 1000,
): boolean {
  if (!lastActiveAt?.trim() || !joinedAt?.trim()) return false;
  const a = new Date(lastActiveAt).getTime();
  const j = new Date(joinedAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(j)) return false;
  return Math.abs(a - j) <= windowMs;
}

/** Latest activity timestamp per user from workspace activity log. */
export function buildActivityLastSeenMap(
  activity: ActivityLog[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const log of activity) {
    if (!log.userId || !log.createdAt) continue;
    const prev = map.get(log.userId);
    if (!prev || new Date(log.createdAt).getTime() > new Date(prev).getTime()) {
      map.set(log.userId, log.createdAt);
    }
  }
  return map;
}

/**
 * Infer recent work from tasks (completed/updated) when profiles.last_active_at
 * was never maintained.
 */
export function buildTaskActivityLastSeenMap(
  tasks: Task[],
  members: WorkspaceMember[],
): Map<string, string> {
  const memberIds = new Set(members.map((m) => m.userId).filter(Boolean));
  const map = new Map<string, string>();

  const bump = (userId: string | undefined | null, iso?: string | null) => {
    if (!userId || !memberIds.has(userId) || !iso) return;
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) return;
    const prev = map.get(userId);
    if (!prev || ms > new Date(prev).getTime()) map.set(userId, iso);
  };

  for (const task of tasks) {
    const assigneeId = task.assigneeIds?.[0];
    bump(assigneeId, task.completedAt);
    bump(assigneeId, task.createdAt);
  }
  return map;
}

/**
 * Best-effort last-active for directory rows:
 * max(profile last_active_at, activity log, task work) — never purely join echo
 * when a fresher signal exists.
 */
export function resolveMemberLastActiveAt(
  member: WorkspaceMember,
  activityByUser?: Map<string, string>,
  taskActivityByUser?: Map<string, string>,
): string | undefined {
  const resolved = latestTimestamp(
    member.lastActiveAt,
    activityByUser?.get(member.userId),
    taskActivityByUser?.get(member.userId),
  );
  if (!resolved) return undefined;
  // If the only signal is join-time echo, omit "Active …" (misleading)
  if (
    isStaleLastActiveEchoingJoin(resolved, member.joinedAt) &&
    !activityByUser?.has(member.userId) &&
    !taskActivityByUser?.has(member.userId)
  ) {
    return undefined;
  }
  return resolved;
}

export function getMemberInitials(member: WorkspaceMember, currentUserId?: string): string {
  if (currentUserId && member.userId === currentUserId) return "Y";
  const name = member.fullName?.trim() || member.username?.trim() || "";
  if (!name) return "M";
  const parts = name.replace(/^@/, "").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.charAt(0).toUpperCase();
}