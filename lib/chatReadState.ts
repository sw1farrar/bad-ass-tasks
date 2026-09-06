import type { ChatConversationId } from "@/types";
import { conversationKey } from "@/features/chat/lib/conversations";

const PREFIX = "bat_chat_read_";

/**
 * General channel uses the legacy key (pre multi-channel) so existing watermarks apply.
 * Named channels: bat_chat_read_{user}_{ws}_channel:{id}
 */
function storageKey(
  userId: string,
  workspaceId: string,
  conversation: ChatConversationId = { kind: "general" },
): string {
  const cKey = conversationKey(conversation);
  if (cKey === "general" || cKey === "team") {
    return `${PREFIX}${userId}_${workspaceId}`;
  }
  return `${PREFIX}${userId}_${workspaceId}_${cKey}`;
}

/** Workspace-level "I opened Chat" watermark for the nav badge (not per-thread dots). */
function inboxSeenKey(userId: string, workspaceId: string): string {
  return `${PREFIX}inbox_${userId}_${workspaceId}`;
}

export function getChatLastReadAt(
  userId: string,
  workspaceId: string,
  conversation: ChatConversationId = { kind: "general" },
): string | null {
  if (typeof window === "undefined" || !userId || !workspaceId) return null;
  try {
    return localStorage.getItem(storageKey(userId, workspaceId, conversation));
  } catch {
    return null;
  }
}

/** Fired when any conversation watermark is written (same-tab badge refresh). */
export const CHAT_READ_EVENT = "bat:chat-read";

export function setChatLastReadAt(
  userId: string,
  workspaceId: string,
  iso: string,
  conversation: ChatConversationId = { kind: "general" },
): void {
  if (typeof window === "undefined" || !userId || !workspaceId) return;
  try {
    localStorage.setItem(storageKey(userId, workspaceId, conversation), iso);
    // Same-tab listeners (nav badge) + cross-tab via storage
    window.dispatchEvent(
      new CustomEvent(CHAT_READ_EVENT, {
        detail: { userId, workspaceId, conversation, iso },
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Latest activity timestamp + 1ms so equal-second rows still count as read.
 * Returns null when there is no activity — callers must not write a watermark
 * (avoids marking an empty/wrong conversation as fully read).
 */
export function computeChatReadWatermark(
  messages: Array<{ createdAt: string }>,
  reactions: Array<{ createdAt: string }>,
): string | null {
  let maxMs = -Infinity;
  for (const item of [...messages, ...reactions]) {
    const ms = new Date(item.createdAt).getTime();
    if (!Number.isNaN(ms) && ms > maxMs) maxMs = ms;
  }
  if (!Number.isFinite(maxMs) || maxMs < 0) return null;
  return new Date(maxMs + 1).toISOString();
}

export function getChatInboxSeenAt(userId: string, workspaceId: string): string | null {
  if (typeof window === "undefined" || !userId || !workspaceId) return null;
  try {
    return localStorage.getItem(inboxSeenKey(userId, workspaceId));
  } catch {
    return null;
  }
}

export function setChatInboxSeenAt(userId: string, workspaceId: string, iso: string): void {
  if (typeof window === "undefined" || !userId || !workspaceId) return;
  try {
    const key = inboxSeenKey(userId, workspaceId);
    const prev = localStorage.getItem(key);
    if (prev && new Date(prev).getTime() >= new Date(iso).getTime()) return;
    localStorage.setItem(key, iso);
    window.dispatchEvent(
      new CustomEvent(CHAT_READ_EVENT, {
        detail: { userId, workspaceId, iso, inbox: true },
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/** Mark the Chat nav badge current through the latest loaded inbox activity. */
export function markChatInboxSeen(
  userId: string | undefined,
  workspaceId: string,
  messages: Array<{ createdAt: string }>,
): void {
  if (!userId || !workspaceId) return;
  const watermark = computeChatReadWatermark(messages, []);
  if (watermark) {
    setChatInboxSeenAt(userId, workspaceId, watermark);
    return;
  }
  if (!getChatInboxSeenAt(userId, workspaceId)) {
    setChatInboxSeenAt(userId, workspaceId, new Date().toISOString());
  }
}

/** Nav / home pulse: activity from others after the last time the user opened Chat. */
export function hasUnreadChatInbox(
  userId: string | undefined,
  workspaceId: string,
  messages: Array<{ userId: string; createdAt: string }>,
): boolean {
  if (!userId || !workspaceId) return false;
  const lastSeen = getChatInboxSeenAt(userId, workspaceId);
  const cutoff = lastSeen ? new Date(lastSeen).getTime() : 0;
  return messages.some(
    (m) => m.userId !== userId && new Date(m.createdAt).getTime() > cutoff,
  );
}

export function hasUnreadChatActivity(
  userId: string | undefined,
  workspaceId: string,
  messages: Array<{ userId: string; createdAt: string }>,
  reactions: Array<{ userId: string; createdAt: string }>,
  conversation: ChatConversationId = { kind: "general" },
): boolean {
  if (!userId || !workspaceId) return false;
  const lastRead = getChatLastReadAt(userId, workspaceId, conversation);
  const cutoff = lastRead ? new Date(lastRead).getTime() : 0;

  const messageUnread = messages.some(
    (m) => m.userId !== userId && new Date(m.createdAt).getTime() > cutoff,
  );
  const reactionUnread = reactions.some(
    (r) => r.userId !== userId && new Date(r.createdAt).getTime() > cutoff,
  );
  return messageUnread || reactionUnread;
}
