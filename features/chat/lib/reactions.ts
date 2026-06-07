import type { MessageReaction, ReactionSummary } from "@/types";

export function groupMessageReactions(
  reactions: MessageReaction[],
  currentUserId?: string
): ReactionSummary[] {
  const map = new Map<string, ReactionSummary>();

  for (const r of reactions) {
    let entry = map.get(r.emoji);
    if (!entry) {
      entry = { emoji: r.emoji, count: 0, userIds: [], reactedByMe: false };
      map.set(r.emoji, entry);
    }
    if (!entry.userIds.includes(r.userId)) {
      entry.userIds.push(r.userId);
      entry.count += 1;
    }
    if (currentUserId && r.userId === currentUserId) {
      entry.reactedByMe = true;
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}