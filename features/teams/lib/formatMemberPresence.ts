import { formatDistanceToNow } from "date-fns";
import type { WorkspaceMember } from "@/types";

export function formatMemberLastActive(lastActiveAt?: string): string | null {
  if (!lastActiveAt) return null;
  const date = new Date(lastActiveAt);
  if (Number.isNaN(date.getTime())) return null;
  return `Active ${formatDistanceToNow(date, { addSuffix: true })}`;
}

export function formatMemberJoined(joinedAt?: string): string | null {
  if (!joinedAt) return null;
  const date = new Date(joinedAt);
  if (Number.isNaN(date.getTime())) return null;
  return `Joined ${formatDistanceToNow(date, { addSuffix: true })}`;
}

export function getMemberInitials(member: WorkspaceMember, currentUserId?: string): string {
  if (currentUserId && member.userId === currentUserId) return "Y";
  const name = member.fullName?.trim() || member.username?.trim() || "";
  if (!name) return "M";
  const parts = name.replace(/^@/, "").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.charAt(0).toUpperCase();
}