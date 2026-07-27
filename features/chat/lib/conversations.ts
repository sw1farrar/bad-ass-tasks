import type {
  ChatConversationId,
  WorkspaceConversation,
  WorkspaceConversationPref,
  WorkspaceMessage,
} from "@/types";

export function generalConversation(): ChatConversationId {
  return { kind: "general" };
}

/** @deprecated use generalConversation */
export function teamConversation(): ChatConversationId {
  return generalConversation();
}

export function channelConversation(conversationId: string): ChatConversationId {
  return { kind: "channel", conversationId };
}

export function conversationKey(conversation: ChatConversationId): string {
  if (conversation.kind === "general") return "general";
  return `channel:${conversation.conversationId}`;
}

export function conversationIdsEqual(
  a: ChatConversationId,
  b: ChatConversationId,
): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "general") return true;
  return a.conversationId === (b as { conversationId: string }).conversationId;
}

export function messageMatchesConversation(
  msg: WorkspaceMessage,
  conversation: ChatConversationId,
): boolean {
  const cid = msg.conversationId ?? null;
  if (conversation.kind === "general") {
    // General = no channel id (legacy team messages + posts without conversation_id)
    return !cid;
  }
  return cid === conversation.conversationId;
}

export type ConversationListItem = {
  id: ChatConversationId;
  key: string;
  title: string;
  defaultTitle: string;
  subtitle?: string;
  avatarLabel: string;
  isGeneral: boolean;
  conversationId?: string;
  lastMessageAt?: string;
  lastPreview?: string;
  unread: boolean;
  archived: boolean;
};

function prefsByKey(
  prefs: WorkspaceConversationPref[],
): Map<string, WorkspaceConversationPref> {
  const map = new Map<string, WorkspaceConversationPref>();
  for (const p of prefs) {
    // Treat legacy "team" key as "general"
    const k = p.conversationKey === "team" ? "general" : p.conversationKey;
    map.set(k, p);
  }
  return map;
}

function initialsFromName(name: string): string {
  const parts = name.replace(/^#/, "").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
}

export function buildConversationList(params: {
  channels: WorkspaceConversation[];
  messages: WorkspaceMessage[];
  isUnread: (conversation: ChatConversationId) => boolean;
  prefs?: WorkspaceConversationPref[];
}): ConversationListItem[] {
  const { channels, messages, isUnread, prefs = [] } = params;
  const prefMap = prefsByKey(prefs);

  const latestFor = (match: (m: WorkspaceMessage) => boolean) => {
    let best: WorkspaceMessage | undefined;
    for (const m of messages) {
      if (!match(m)) continue;
      if (!best || m.createdAt > best.createdAt) best = m;
    }
    return best;
  };

  const generalKey = "general";
  const generalPref = prefMap.get(generalKey);
  const generalLatest = latestFor((m) => !m.conversationId);
  const generalDefault = "General";
  const general: ConversationListItem = {
    id: generalConversation(),
    key: generalKey,
    defaultTitle: generalDefault,
    title: generalDefault,
    subtitle: "Everyone in this workspace",
    avatarLabel: "#",
    isGeneral: true,
    lastMessageAt: generalLatest?.createdAt,
    lastPreview: generalLatest?.body,
    unread: isUnread(generalConversation()),
    archived: !!generalPref?.archivedAt,
  };

  const channelItems: ConversationListItem[] = channels.map((ch) => {
    const id = channelConversation(ch.id);
    const key = conversationKey(id);
    const pref = prefMap.get(key);
    const latest = latestFor((m) => m.conversationId === ch.id);
    // Shared name from table (all members see the same name)
    const title = ch.name.trim() || "Conversation";
    // Activity time: latest message, else channel updated/created (new empty chats rise to top)
    const activityAt = latest?.createdAt || ch.updatedAt || ch.createdAt;
    return {
      id,
      key,
      defaultTitle: title,
      title,
      subtitle: "Workspace channel",
      avatarLabel: initialsFromName(title),
      isGeneral: false,
      conversationId: ch.id,
      lastMessageAt: activityAt,
      lastPreview: latest?.body,
      unread: isUnread(id),
      archived: !!pref?.archivedAt,
    };
  });

  // Most recently active conversation always first (General is not pinned)
  const all = [general, ...channelItems];
  all.sort((a, b) => {
    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    if (at !== bt) return bt - at;
    // Unread as a mild tiebreaker when activity times match
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return all;
}

export function filterConversationsBySearch(
  items: ConversationListItem[],
  messages: WorkspaceMessage[],
  query: string,
): ConversationListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  return items.filter((item) => {
    if (item.title.toLowerCase().includes(q)) return true;
    if (item.defaultTitle.toLowerCase().includes(q)) return true;
    if (item.subtitle?.toLowerCase().includes(q)) return true;
    if (item.lastPreview?.toLowerCase().includes(q)) return true;

    return messages.some((m) => {
      if (!messageMatchesConversation(m, item.id)) return false;
      return m.body.toLowerCase().includes(q);
    });
  });
}
