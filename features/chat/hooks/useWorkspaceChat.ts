"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  fetchWorkspaceMessages,
  fetchWorkspaceMessageReactions,
  sendWorkspaceMessage,
  subscribeToWorkspaceChat,
  toggleWorkspaceMessageReaction,
} from "@/lib/data/hybridStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { generateId } from "@/lib/utils";
import type { WorkspaceMember, WorkspaceMessage, MessageReaction } from "@/types";
import { hasUnreadChatActivity, setChatLastReadAt } from "@/lib/chatReadState";
import { groupMessageReactions } from "../lib/reactions";

const DEMO_CAP = 100;

export interface UseWorkspaceChatOptions {
  workspaceId: string;
  userId: string | undefined;
  members: WorkspaceMember[];
  /** When true, marks workspace chat as read (panel/drawer open). */
  isOpen?: boolean;
}

function resolveAuthor(
  userId: string,
  members: WorkspaceMember[],
  msg: WorkspaceMessage
): string {
  if (msg.authorUsername) return `@${msg.authorUsername}`;
  if (msg.authorName) return msg.authorName;
  const m = members.find((x) => x.userId === userId);
  if (m?.username) return `@${m.username}`;
  if (m?.fullName) return m.fullName;
  return userId.slice(0, 8);
}

export function useWorkspaceChat({
  workspaceId,
  userId,
  members,
  isOpen = false,
}: UseWorkspaceChatOptions) {
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const seenIds = useRef(new Set<string>());
  const reactionIds = useRef(new Set<string>());

  const enrich = useCallback(
    (msg: WorkspaceMessage): WorkspaceMessage => ({
      ...msg,
      authorName: msg.authorName ?? resolveAuthor(msg.userId, members, msg),
    }),
    [members]
  );

  const appendUnique = useCallback(
    (msg: WorkspaceMessage) => {
      if (seenIds.current.has(msg.id)) return;
      seenIds.current.add(msg.id);
      setMessages((prev) => [...prev, enrich(msg)]);
    },
    [enrich]
  );

  const appendReaction = useCallback((r: MessageReaction) => {
    setReactions((prev) => {
      if (
        prev.some(
          (x) => x.messageId === r.messageId && x.userId === r.userId && x.emoji === r.emoji
        )
      ) {
        return prev;
      }
      reactionIds.current.add(r.id);
      return [...prev, r];
    });
  }, []);

  const removeReaction = useCallback((r: MessageReaction) => {
    reactionIds.current.delete(r.id);
    setReactions((prev) =>
      prev.filter(
        (x) => !(x.messageId === r.messageId && x.userId === r.userId && x.emoji === r.emoji)
      )
    );
  }, []);

  const reactionSummariesByMessage = useMemo(() => {
    const map = new Map<string, ReturnType<typeof groupMessageReactions>>();
    const byMsg = new Map<string, MessageReaction[]>();
    for (const r of reactions) {
      const list = byMsg.get(r.messageId) ?? [];
      list.push(r);
      byMsg.set(r.messageId, list);
    }
    for (const [messageId, list] of byMsg) {
      map.set(messageId, groupMessageReactions(list, userId));
    }
    return map;
  }, [reactions, userId]);

  useEffect(() => {
    seenIds.current.clear();
    reactionIds.current.clear();
    setMessages([]);
    setReactions([]);
    setIsLoading(true);

    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      if (isSupabaseConfigured() && !["w1", "w2"].includes(workspaceId)) {
        const [rows, rxn] = await Promise.all([
          fetchWorkspaceMessages(workspaceId, 120),
          fetchWorkspaceMessageReactions(workspaceId),
        ]);
        if (cancelled) return;
        rows.forEach((m) => seenIds.current.add(m.id));
        rxn.forEach((r) => reactionIds.current.add(r.id));
        setMessages(rows.map(enrich));
        setReactions(rxn);
      }
      if (!cancelled) setIsLoading(false);
    })();

    const unsub =
      isSupabaseConfigured() && !["w1", "w2"].includes(workspaceId)
        ? subscribeToWorkspaceChat(workspaceId, {
            onMessageInsert: (msg) => {
              if (msg.userId !== userId || !seenIds.current.has(msg.id)) {
                appendUnique(msg);
              }
            },
            onReactionInsert: (r) => appendReaction(r),
            onReactionDelete: (r) => removeReaction(r),
          })
        : () => {};

    return () => {
      cancelled = true;
      unsub();
    };
  }, [workspaceId, userId, enrich, appendUnique, appendReaction, removeReaction]);

  const send = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed || !userId) return false;

      setIsSending(true);
      try {
        if (isSupabaseConfigured() && !["w1", "w2"].includes(workspaceId)) {
          const created = await sendWorkspaceMessage(workspaceId, trimmed, userId);
          if (!created) {
            toast.error("Could not send message");
            return false;
          }
          appendUnique(created);
          return true;
        }

        const demo: WorkspaceMessage = {
          id: generateId(),
          workspaceId,
          userId,
          body: trimmed,
          createdAt: new Date().toISOString(),
          authorName: resolveAuthor(userId, members, { userId } as WorkspaceMessage),
        };
        appendUnique(demo);
        setMessages((prev) => {
          const next = [...prev];
          if (next.length > DEMO_CAP) return next.slice(-DEMO_CAP);
          return next;
        });
        return true;
      } finally {
        setIsSending(false);
      }
    },
    [workspaceId, userId, members, appendUnique]
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!userId) return;

      const trimmed = emoji.trim();
      const existing = reactions.find(
        (r) => r.messageId === messageId && r.userId === userId && r.emoji === trimmed
      );

      if (isSupabaseConfigured() && !["w1", "w2"].includes(workspaceId)) {
        const result = await toggleWorkspaceMessageReaction(
          workspaceId,
          messageId,
          trimmed,
          userId
        );
        if (!result) {
          return;
        }
        if (result === "removed" && existing) {
          removeReaction(existing);
        }
        return;
      }

      if (existing) {
        removeReaction(existing);
      } else {
        appendReaction({
          id: generateId(),
          messageId,
          workspaceId,
          userId,
          emoji: trimmed,
          createdAt: new Date().toISOString(),
        });
      }
    },
    [workspaceId, userId, reactions, appendReaction, removeReaction]
  );

  const getReactionSummaries = useCallback(
    (messageId: string) => reactionSummariesByMessage.get(messageId) ?? [],
    [reactionSummariesByMessage]
  );

  const markRead = useCallback(() => {
    if (!userId || !workspaceId) return;
    setChatLastReadAt(userId, workspaceId, new Date().toISOString());
    setHasUnread(false);
  }, [userId, workspaceId]);

  useEffect(() => {
    if (!userId || !workspaceId) {
      setHasUnread(false);
      return;
    }
    if (isOpen) {
      markRead();
    } else {
      setHasUnread(hasUnreadChatActivity(userId, workspaceId, messages, reactions));
    }
  }, [isOpen, userId, workspaceId, messages, reactions, markRead]);

  return {
    messages,
    reactions,
    isLoading,
    isSending,
    hasUnread,
    send,
    resolveAuthor,
    toggleReaction,
    getReactionSummaries,
    markRead,
  };
}

export type WorkspaceChatController = ReturnType<typeof useWorkspaceChat>;