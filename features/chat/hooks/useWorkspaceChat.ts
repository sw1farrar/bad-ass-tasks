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
import type {
  ChatConversationId,
  WorkspaceMember,
  WorkspaceMessage,
  MessageReaction,
} from "@/types";
import {
  computeChatReadWatermark,
  hasUnreadChatActivity,
  setChatLastReadAt,
} from "@/lib/chatReadState";
import {
  conversationKey,
  generalConversation,
  messageMatchesConversation,
} from "../lib/conversations";
import { groupMessageReactions } from "../lib/reactions";

const DEMO_CAP = 100;

export interface UseWorkspaceChatOptions {
  workspaceId: string;
  userId: string | undefined;
  members: WorkspaceMember[];
  isOpen?: boolean;
  /** Required when enabled; omitted while Chat has no selection. */
  conversation?: ChatConversationId | null;
  /** When false, skip loading/subscribing (e.g. no conversation selected yet). */
  enabled?: boolean;
}

function resolveAuthor(
  userId: string,
  members: WorkspaceMember[],
  msg: WorkspaceMessage,
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
  conversation: conversationProp,
  enabled = true,
}: UseWorkspaceChatOptions) {
  // Resolve active conversation only while enabled (callers with no selection set enabled=false)
  const conversation = !enabled
    ? generalConversation() // placeholder; load/subscribe are gated by enabled
    : conversationProp ?? generalConversation();
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  // Start idle so we never paint a loading/general thread on first Chat open
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const seenIds = useRef(new Set<string>());
  const reactionIds = useRef(new Set<string>());
  const wasOpenRef = useRef(false);
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const messagesRef = useRef(messages);
  const reactionsRef = useRef(reactions);
  messagesRef.current = messages;
  reactionsRef.current = reactions;

  const enrich = useCallback(
    (msg: WorkspaceMessage): WorkspaceMessage => ({
      ...msg,
      authorName: msg.authorName ?? resolveAuthor(msg.userId, members, msg),
    }),
    [members],
  );

  const appendUnique = useCallback(
    (msg: WorkspaceMessage) => {
      if (seenIds.current.has(msg.id)) return false;
      if (!messageMatchesConversation(msg, conversationRef.current)) return false;
      seenIds.current.add(msg.id);
      setMessages((prev) => [...prev, enrich(msg)]);
      return true;
    },
    [enrich],
  );

  const appendReaction = useCallback((r: MessageReaction) => {
    setReactions((prev) => {
      if (
        prev.some(
          (x) =>
            (x.id && r.id && x.id === r.id) ||
            (x.messageId === r.messageId && x.userId === r.userId && x.emoji === r.emoji),
        )
      ) {
        return prev;
      }
      if (r.id) reactionIds.current.add(r.id);
      return [...prev, r];
    });
  }, []);

  const removeReaction = useCallback((r: MessageReaction) => {
    if (r.id) reactionIds.current.delete(r.id);
    setReactions((prev) =>
      prev.filter(
        (x) =>
          !(
            (r.id && x.id === r.id) ||
            (x.messageId === r.messageId && x.userId === r.userId && x.emoji === r.emoji)
          ),
      ),
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
    wasOpenRef.current = false;
  }, [workspaceId]);

  const conversationStableKey = !enabled
    ? "__none__"
    : conversationKey(conversationProp ?? generalConversation());

  useEffect(() => {
    seenIds.current.clear();
    reactionIds.current.clear();
    setMessages([]);
    setReactions([]);
    setHasUnread(false);

    if (!enabled || !workspaceId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let cancelled = false;
    const active = conversationProp ?? generalConversation();
    conversationRef.current = active;

    (async () => {
      if (isSupabaseConfigured() && !["w1", "w2"].includes(workspaceId)) {
        const fetchConv =
          active.kind === "channel"
            ? { kind: "channel" as const, conversationId: active.conversationId }
            : { kind: "general" as const };
        const [rows, rxn] = await Promise.all([
          fetchWorkspaceMessages(workspaceId, {
            limit: 120,
            conversation: fetchConv,
            currentUserId: userId,
          }),
          fetchWorkspaceMessageReactions(workspaceId),
        ]);
        if (cancelled) return;
        if (conversationKey(active) !== conversationKey(conversationRef.current)) return;
        rows.forEach((m) => seenIds.current.add(m.id));
        const msgIds = new Set(rows.map((m) => m.id));
        const scopedRxn = rxn.filter((r) => msgIds.has(r.messageId));
        scopedRxn.forEach((r) => {
          if (r.id) reactionIds.current.add(r.id);
        });
        setMessages(rows.map(enrich));
        setReactions(scopedRxn);
      }
      if (!cancelled) setIsLoading(false);
    })();

    const unsub =
      isSupabaseConfigured() && !["w1", "w2"].includes(workspaceId)
        ? subscribeToWorkspaceChat(workspaceId, {
            onMessageInsert: (msg) => {
              // Instant peer (and self-echo) delivery for the open conversation
              appendUnique(msg);
            },
            onReactionInsert: (r) => {
              // Only attach reactions for messages currently loaded in this thread
              if (seenIds.current.has(r.messageId)) {
                appendReaction(r);
              }
            },
            onReactionDelete: (r) => {
              removeReaction(r);
            },
          })
        : () => {};

    return () => {
      cancelled = true;
      unsub();
    };
  }, [
    enabled,
    workspaceId,
    userId,
    conversationStableKey,
    enrich,
    appendUnique,
    appendReaction,
    removeReaction,
  ]);

  const setHasUnreadSafe = useCallback((next: boolean) => {
    setHasUnread((prev) => (prev === next ? prev : next));
  }, []);

  /**
   * Persist read watermark only from messages that belong to the active conversation.
   * Prevents a race when switching channels (stale previous-thread rows still in state).
   */
  const markRead = useCallback(() => {
    if (!userId || !workspaceId) return;
    const conv = conversationRef.current;
    const scopedMsgs = messagesRef.current.filter((m) =>
      messageMatchesConversation(m, conv),
    );
    // Stale state from another conversation — wait for load
    if (messagesRef.current.length > 0 && scopedMsgs.length === 0) {
      return;
    }
    const msgIds = new Set(scopedMsgs.map((m) => m.id));
    const scopedRxn = reactionsRef.current.filter((r) => msgIds.has(r.messageId));

    if (scopedMsgs.length === 0 && scopedRxn.length === 0) {
      setHasUnreadSafe(false);
      return;
    }
    const watermark = computeChatReadWatermark(scopedMsgs, scopedRxn);
    if (!watermark) {
      setHasUnreadSafe(false);
      return;
    }
    setChatLastReadAt(userId, workspaceId, watermark, conv);
    setHasUnreadSafe(false);
  }, [userId, workspaceId, setHasUnreadSafe]);

  const send = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed || !userId) return false;

      setIsSending(true);
      const conversationId =
        conversation.kind === "channel" ? conversation.conversationId : null;
      const authorLabel = resolveAuthor(userId, members, { userId } as WorkspaceMessage);

      // Optimistic append so sender sees the post instantly
      const tempId = `temp-${generateId()}`;
      const optimistic: WorkspaceMessage = {
        id: tempId,
        workspaceId,
        userId,
        conversationId,
        body: trimmed,
        createdAt: new Date().toISOString(),
        authorName: authorLabel,
      };
      appendUnique(optimistic);

      const finalizeRead = (extra: WorkspaceMessage) => {
        if (!isOpenRef.current) return;
        const scoped = [
          ...messagesRef.current.filter((m) =>
            messageMatchesConversation(m, conversationRef.current),
          ),
          extra,
        ];
        const msgIds = new Set(scoped.map((m) => m.id));
        const scopedRxn = reactionsRef.current.filter((r) => msgIds.has(r.messageId));
        const wm = computeChatReadWatermark(scoped, scopedRxn);
        if (wm) setChatLastReadAt(userId, workspaceId, wm, conversationRef.current);
        setHasUnreadSafe(false);
      };

      try {
        if (isSupabaseConfigured() && !["w1", "w2"].includes(workspaceId)) {
          const created = await sendWorkspaceMessage(workspaceId, trimmed, userId, {
            conversationId,
          });
          if (!created) {
            seenIds.current.delete(tempId);
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            toast.error("Could not send message");
            return false;
          }
          // Swap temp → server row (realtime may already have inserted the real id)
          seenIds.current.delete(tempId);
          seenIds.current.add(created.id);
          setMessages((prev) => {
            const withoutTemp = prev.filter((m) => m.id !== tempId);
            if (withoutTemp.some((m) => m.id === created.id)) return withoutTemp;
            return [...withoutTemp, enrich(created)];
          });
          finalizeRead(created);
          return true;
        }

        // Demo / offline path — keep optimistic as permanent
        setMessages((prev) => {
          const next = prev.length > DEMO_CAP ? prev.slice(-DEMO_CAP) : prev;
          return next;
        });
        finalizeRead(optimistic);
        return true;
      } finally {
        setIsSending(false);
      }
    },
    [workspaceId, userId, members, appendUnique, conversation, enrich, setHasUnreadSafe],
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!userId) return;
      const trimmed = emoji.trim();
      const existing = reactionsRef.current.find(
        (r) => r.messageId === messageId && r.userId === userId && r.emoji === trimmed,
      );

      // Optimistic local update for instant UI on the actor's device
      if (existing) {
        removeReaction(existing);
      } else {
        appendReaction({
          id: `opt-${messageId}-${userId}-${trimmed}`,
          messageId,
          workspaceId,
          userId,
          emoji: trimmed,
          createdAt: new Date().toISOString(),
        });
      }

      if (isSupabaseConfigured() && !["w1", "w2"].includes(workspaceId)) {
        const result = await toggleWorkspaceMessageReaction(
          workspaceId,
          messageId,
          trimmed,
          userId,
        );
        if (!result) {
          // Rollback optimistic
          if (existing) {
            appendReaction(existing);
          } else {
            removeReaction({
              id: `opt-${messageId}-${userId}-${trimmed}`,
              messageId,
              workspaceId,
              userId,
              emoji: trimmed,
              createdAt: new Date().toISOString(),
            });
          }
          toast.error("Could not update reaction");
          return;
        }
        // Realtime INSERT/DELETE fans out to other clients; local already optimistic.
        // While thread is open, keep watermark current so badges stay clear.
        if (isOpenRef.current) {
          markRead();
        }
      }
    },
    [workspaceId, userId, appendReaction, removeReaction, markRead],
  );

  const getReactionSummaries = useCallback(
    (messageId: string) => reactionSummariesByMessage.get(messageId) ?? [],
    [reactionSummariesByMessage],
  );

  useEffect(() => {
    if (!enabled || !userId || !workspaceId) {
      setHasUnreadSafe(false);
      wasOpenRef.current = false;
      return;
    }
    if (isLoading) return;

    // Guard against stale rows from the previous conversation still in state
    const scopedMsgs = messages.filter((m) =>
      messageMatchesConversation(m, conversationRef.current),
    );
    if (messages.length > 0 && scopedMsgs.length === 0) return;

    const justClosed = wasOpenRef.current && !isOpen;
    wasOpenRef.current = isOpen;

    if (isOpen || justClosed) {
      // Viewing this thread: clear unread and persist watermark
      markRead();
      return;
    }

    setHasUnreadSafe(
      hasUnreadChatActivity(
        userId,
        workspaceId,
        scopedMsgs,
        reactions.filter((r) => scopedMsgs.some((m) => m.id === r.messageId)),
        conversationRef.current,
      ),
    );
  }, [
    enabled,
    isOpen,
    userId,
    workspaceId,
    messages,
    reactions,
    markRead,
    isLoading,
    conversationStableKey,
    setHasUnreadSafe,
  ]);

  return {
    messages,
    reactions,
    isLoading,
    isSending,
    hasUnread,
    conversation,
    send,
    resolveAuthor,
    toggleReaction,
    getReactionSummaries,
    markRead,
  };
}

export type WorkspaceChatController = ReturnType<typeof useWorkspaceChat>;
