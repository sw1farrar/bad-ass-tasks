import type { WorkspaceMember } from "@/types";
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

export function getMemberInitials(member: WorkspaceMember, currentUserId?: string): string {
  if (currentUserId && member.userId === currentUserId) return "Y";
  const name = member.fullName?.trim() || member.username?.trim() || "";
  if (!name) return "M";
  const parts = name.replace(/^@/, "").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.charAt(0).toUpperCase();
}