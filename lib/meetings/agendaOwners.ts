import type { MeetingAgendaItem, WorkspaceMember } from "@/types";
import { getMemberDisplayName } from "@/lib/assignee";

export function getAgendaItemOwnerLabel(
  item: Pick<MeetingAgendaItem, "ownerId" | "ownerName">,
  members: WorkspaceMember[],
  currentUserId?: string,
): string {
  if (item.ownerName?.trim()) return item.ownerName.trim();
  if (item.ownerId) {
    const member = members.find((m) => m.userId === item.ownerId);
    return member ? getMemberDisplayName(member, currentUserId) : "Member";
  }
  return "";
}

export function hasAgendaItemOwner(
  item: Pick<MeetingAgendaItem, "ownerId" | "ownerName">,
): boolean {
  return !!(item.ownerName?.trim() || item.ownerId);
}