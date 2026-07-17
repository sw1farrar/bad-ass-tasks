const PREFIX = "bat_chat_read_";

function storageKey(userId: string, workspaceId: string): string {
  return `${PREFIX}${userId}_${workspaceId}`;
}

export function getChatLastReadAt(userId: string, workspaceId: string): string | null {
  if (typeof window === "undefined" || !userId || !workspaceId) return null;
  try {
    return localStorage.getItem(storageKey(userId, workspaceId));
  } catch {
    return null;
  }
}

export function setChatLastReadAt(userId: string, workspaceId: string, iso: string): void {
  if (typeof window === "undefined" || !userId || !workspaceId) return;
  try {
    localStorage.setItem(storageKey(userId, workspaceId), iso);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Latest activity timestamp + 1ms so equal-second DB rows still count as read. */
export function computeChatReadWatermark(
  messages: Array<{ createdAt: string }>,
  reactions: Array<{ createdAt: string }>,
): string {
  let maxMs = Date.now();
  for (const item of [...messages, ...reactions]) {
    const ms = new Date(item.createdAt).getTime();
    if (!Number.isNaN(ms) && ms > maxMs) maxMs = ms;
  }
  return new Date(maxMs + 1).toISOString();
}

export function hasUnreadChatActivity(
  userId: string | undefined,
  workspaceId: string,
  messages: Array<{ userId: string; createdAt: string }>,
  reactions: Array<{ userId: string; createdAt: string }>
): boolean {
  if (!userId || !workspaceId) return false;
  const lastRead = getChatLastReadAt(userId, workspaceId);
  const cutoff = lastRead ? new Date(lastRead).getTime() : 0;

  const messageUnread = messages.some(
    (m) => m.userId !== userId && new Date(m.createdAt).getTime() > cutoff
  );
  const reactionUnread = reactions.some(
    (r) => r.userId !== userId && new Date(r.createdAt).getTime() > cutoff
  );
  return messageUnread || reactionUnread;
}