"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchWorkspaceMessagesForInbox,
  subscribeToWorkspaceChat,
} from "@/lib/data/hybridStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { CHAT_READ_EVENT, hasUnreadChatInbox } from "@/lib/chatReadState";
import type { WorkspaceMember, WorkspaceMessage } from "@/types";

/**
 * Nav badge for chat unread. Works while Chat page is closed.
 * Lights only for messages from others after the user last opened Chat.
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
    (messages: WorkspaceMessage[]) => {
      if (!userId) return false;
      return hasUnreadChatInbox(userId, workspaceId, messages);
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

    const recompute = () => {
      if (cancelled) return;
      setHasUnread(recomputeFrom(messages));
    };

    const load = async () => {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setHasUnread(false);
        return;
      }
      const rows = await fetchWorkspaceMessagesForInbox(workspaceId, 200);
      if (cancelled) return;
      messages = rows;
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
        })
      : () => {};

    const onLocalRead = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as
        | { workspaceId?: string; userId?: string }
        | undefined;
      if (detail?.workspaceId && detail.workspaceId !== workspaceId) return;
      if (detail?.userId && detail.userId !== userId) return;
      recompute();
    };
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
