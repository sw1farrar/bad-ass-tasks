"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchConversationPrefs,
  fetchWorkspaceConversations,
  fetchWorkspaceMessagesForInbox,
  subscribeToWorkspaceChat,
} from "@/lib/data/hybridStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { CHAT_READ_EVENT, hasUnreadChatActivity } from "@/lib/chatReadState";
import type {
  ChatConversationId,
  WorkspaceConversation,
  WorkspaceConversationPref,
  WorkspaceMember,
  WorkspaceMessage,
} from "@/types";
import {
  buildConversationList,
  messageMatchesConversation,
} from "../lib/conversations";

/**
 * Nav badge for chat unread. Works while Chat page is closed.
 * Recomputes on: load, realtime message/reaction, and local/cross-tab read watermarks.
 */
export function useChatUnreadBadge(params: {
  workspaceId: string;
  userId: string | undefined;
  members: WorkspaceMember[];
  enabled: boolean;
  suppress?: boolean;
}): boolean {
  const { workspaceId, userId, enabled, suppress } = params;
  const [hasUnread, setHasUnread] = useState(false);

  const recomputeFrom = useCallback(
    (
      messages: WorkspaceMessage[],
      channels: WorkspaceConversation[],
      prefs: WorkspaceConversationPref[],
    ) => {
      if (!userId) return false;
      const isUnread = (conversation: ChatConversationId) => {
        const scoped = messages.filter((m) => messageMatchesConversation(m, conversation));
        return hasUnreadChatActivity(userId, workspaceId, scoped, [], conversation);
      };
      const list = buildConversationList({
        channels,
        messages,
        isUnread,
        prefs,
      });
      return list.some((c) => !c.archived && c.unread);
    },
    [userId, workspaceId],
  );

  useEffect(() => {
    if (!enabled || !userId || !workspaceId || ["w1", "w2"].includes(workspaceId)) {
      setHasUnread(false);
      return;
    }
    if (suppress) {
      setHasUnread(false);
      return;
    }

    let cancelled = false;
    let messages: WorkspaceMessage[] = [];
    let channels: WorkspaceConversation[] = [];
    let prefs: WorkspaceConversationPref[] = [];

    const recompute = () => {
      if (cancelled) return;
      setHasUnread(recomputeFrom(messages, channels, prefs));
    };

    const load = async () => {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setHasUnread(false);
        return;
      }
      const [chs, rows, prefRows] = await Promise.all([
        fetchWorkspaceConversations(workspaceId),
        fetchWorkspaceMessagesForInbox(workspaceId, 200),
        fetchConversationPrefs(workspaceId, userId),
      ]);
      if (cancelled) return;
      channels = chs;
      messages = rows;
      prefs = prefRows;
      recompute();
    };

    void load();

    const unsub = isSupabaseConfigured()
      ? subscribeToWorkspaceChat(workspaceId, {
          onMessageInsert: (msg) => {
            if (msg.userId === userId) return;
            messages = [...messages.filter((m) => m.id !== msg.id), msg];
            recompute();
          },
          onReactionInsert: (r) => {
            if (r.userId === userId) return;
            // Full reload is safer for reaction-scoped unread; light path: treat as activity
            void load();
          },
          onReactionDelete: () => {
            void load();
          },
        })
      : () => {};

    // Same-tab: ChatView wrote a watermark
    const onLocalRead = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as
        | { workspaceId?: string; userId?: string }
        | undefined;
      if (detail?.workspaceId && detail.workspaceId !== workspaceId) return;
      if (detail?.userId && detail.userId !== userId) return;
      recompute();
    };
    // Cross-tab
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key?.startsWith("bat_chat_read_")) return;
      recompute();
    };

    window.addEventListener(CHAT_READ_EVENT, onLocalRead);
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      unsub();
      window.removeEventListener(CHAT_READ_EVENT, onLocalRead);
      window.removeEventListener("storage", onStorage);
    };
  }, [workspaceId, userId, enabled, suppress, recomputeFrom]);

  return suppress ? false : hasUnread;
}
