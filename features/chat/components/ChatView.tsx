"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Hash, MessageCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import type {
  ChatConversationId,
  WorkspaceConversation,
  WorkspaceConversationPref,
  WorkspaceMember,
  WorkspaceMessage,
} from "@/types";
import {
  createWorkspaceConversation,
  deleteWorkspaceConversation,
  fetchConversationPrefs,
  fetchWorkspaceConversations,
  fetchWorkspaceMessagesForInbox,
  subscribeToWorkspaceChat,
  updateWorkspaceConversationName,
  upsertConversationPref,
} from "@/lib/data/hybridStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { CHAT_READ_EVENT, hasUnreadChatActivity, markChatInboxSeen } from "@/lib/chatReadState";
import {
  buildConversationList,
  channelConversation,
  conversationIdsEqual,
  conversationKey,
  filterConversationsBySearch,
  generalConversation,
  messageMatchesConversation,
} from "../lib/conversations";
import { useWorkspaceChat } from "../hooks/useWorkspaceChat";
import { ConversationList } from "./ConversationList";
import { WorkspaceChatPanel } from "./WorkspaceChatPanel";
import "../chat-workspace.css";

export interface ChatViewProps {
  workspaceId: string;
  workspaceName: string;
  userId: string | undefined;
  members: WorkspaceMember[];
  className?: string;
  onUnreadChange?: (hasUnread: boolean) => void;
}

export function ChatView({
  workspaceId,
  workspaceName,
  userId,
  members,
  className,
  onUnreadChange,
}: ChatViewProps) {
  /** null until the user picks a conversation — do not auto-open General */
  const [selected, setSelected] = useState<ChatConversationId | null>(null);
  const [channels, setChannels] = useState<WorkspaceConversation[]>([]);
  const [inboxMessages, setInboxMessages] = useState<WorkspaceMessage[]>([]);
  const [prefs, setPrefs] = useState<WorkspaceConversationPref[]>([]);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [autoRenameKey, setAutoRenameKey] = useState<string | null>(null);
  /** Prevents flashing a General-only list before channels/inbox hydrate */
  const [metaReady, setMetaReady] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: ChatConversationId;
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const reloadMeta = useCallback(async () => {
    if (!isSupabaseConfigured() || ["w1", "w2"].includes(workspaceId)) return;
    const [chs, rows, prefRows] = await Promise.all([
      fetchWorkspaceConversations(workspaceId),
      fetchWorkspaceMessagesForInbox(workspaceId, 250),
      userId ? fetchConversationPrefs(workspaceId, userId) : Promise.resolve([]),
    ]);
    setChannels(chs);
    setInboxMessages(rows);
    setPrefs(prefRows);
    setMetaReady(true);
  }, [workspaceId, userId]);

  useEffect(() => {
    let cancelled = false;
    setChannels([]);
    setInboxMessages([]);
    setPrefs([]);
    setMetaReady(false);
    // Always clear selection when (re)entering a workspace chat context
    setSelected(null);
    setMobileShowThread(false);
    (async () => {
      if (!isSupabaseConfigured() || ["w1", "w2"].includes(workspaceId)) {
        if (!cancelled) setMetaReady(true);
        return;
      }
      const [chs, rows, prefRows] = await Promise.all([
        fetchWorkspaceConversations(workspaceId),
        fetchWorkspaceMessagesForInbox(workspaceId, 250),
        userId ? fetchConversationPrefs(workspaceId, userId) : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setChannels(chs);
      setInboxMessages(rows);
      setPrefs(prefRows);
      setMetaReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId]);

  // Live inbox: any new message (any channel) updates list previews + unread dots instantly
  useEffect(() => {
    if (!isSupabaseConfigured() || ["w1", "w2"].includes(workspaceId)) return;
    return subscribeToWorkspaceChat(workspaceId, {
      onMessageInsert: (msg) => {
        setInboxMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      },
    });
  }, [workspaceId]);

  // Same-tab watermark writes (open thread mark-read) re-evaluate list badges
  const [readEpoch, setReadEpoch] = useState(0);
  useEffect(() => {
    const onRead = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as
        | { workspaceId?: string; userId?: string }
        | undefined;
      if (detail?.workspaceId && detail.workspaceId !== workspaceId) return;
      if (detail?.userId && userId && detail.userId !== userId) return;
      setReadEpoch((n) => n + 1);
    };
    window.addEventListener(CHAT_READ_EVENT, onRead);
    return () => window.removeEventListener(CHAT_READ_EVENT, onRead);
  }, [workspaceId, userId]);

  useEffect(() => {
    setSelected(null);
    setMobileShowThread(false);
    setSearchQuery("");
    setShowArchived(false);
    setAutoRenameKey(null);
  }, [workspaceId]);

  const hasSelection = selected != null;

  useEffect(() => {
    if (!metaReady || !userId || !workspaceId) return;
    markChatInboxSeen(userId, workspaceId, inboxMessages);
  }, [metaReady, userId, workspaceId, inboxMessages]);

  const chat = useWorkspaceChat({
    workspaceId,
    userId,
    members,
    // Load thread only after the user picks a conversation (never auto-General)
    enabled: hasSelection,
    isOpen: hasSelection,
    conversation: selected ?? undefined,
  });

  const previewMessages = useMemo(() => {
    if (!metaReady) return [];
    const byId = new Map(inboxMessages.map((m) => [m.id, m]));
    // Only merge open-thread messages when a conversation is selected
    if (hasSelection) {
      for (const m of chat.messages) {
        byId.set(m.id, m);
      }
    }
    return [...byId.values()];
  }, [inboxMessages, chat.messages, hasSelection, metaReady]);

  const isConversationUnread = useCallback(
    (conversation: ChatConversationId) => {
      // Selected + loaded thread owns its unread via live mark-read
      if (
        selected &&
        conversationIdsEqual(conversation, selected) &&
        !chat.isLoading
      ) {
        return chat.hasUnread;
      }
      const scoped = previewMessages.filter((m) =>
        messageMatchesConversation(m, conversation),
      );
      return hasUnreadChatActivity(userId, workspaceId, scoped, [], conversation);
    },
    [selected, chat.hasUnread, chat.isLoading, previewMessages, userId, workspaceId, readEpoch],
  );

  const allConversations = useMemo(
    () =>
      buildConversationList({
        channels,
        messages: previewMessages,
        isUnread: isConversationUnread,
        prefs,
      }),
    [channels, previewMessages, isConversationUnread, prefs],
  );

  const visibleConversations = useMemo(() => {
    if (!metaReady) return [];
    const byArchive = allConversations.filter((c) =>
      showArchived ? c.archived : !c.archived,
    );
    return filterConversationsBySearch(byArchive, previewMessages, searchQuery);
  }, [allConversations, showArchived, previewMessages, searchQuery, metaReady]);

  const anyUnread = useMemo(
    () => allConversations.some((c) => !c.archived && c.unread),
    [allConversations],
  );

  const onUnreadChangeRef = React.useRef(onUnreadChange);
  onUnreadChangeRef.current = onUnreadChange;
  useEffect(() => {
    onUnreadChangeRef.current?.(anyUnread);
  }, [anyUnread]);

  useEffect(() => {
    if (!selected) return;
    const sel = allConversations.find((c) => conversationIdsEqual(c.id, selected));
    if (!sel) {
      // Channel removed / no longer in list
      setSelected(null);
      setMobileShowThread(false);
      return;
    }

    // Selection hidden by archive filter — clear rather than auto-picking another
    if (showArchived && !sel.archived) {
      setSelected(null);
      setMobileShowThread(false);
    } else if (!showArchived && sel.archived) {
      setSelected(null);
      setMobileShowThread(false);
    }
  }, [showArchived, selected, allConversations]);

  const selectedMeta = useMemo(
    () =>
      selected
        ? allConversations.find((c) => conversationIdsEqual(c.id, selected))
        : undefined,
    [allConversations, selected],
  );

  const headerTitle =
    selectedMeta?.title ??
    (selected?.kind === "general" ? "General" : selected ? "Conversation" : "Messages");
  const headerSubtitle = !selected
    ? "Choose a conversation to start chatting"
    : selected.kind === "general"
      ? `${members.length} member${members.length === 1 ? "" : "s"} · ${workspaceName}`
      : `Shared with everyone · ${workspaceName}`;

  const handleSelect = (id: ChatConversationId) => {
    setSelected(id);
    setMobileShowThread(true);
  };

  const handleCreateConversation = async () => {
    if (!userId) {
      toast.error("Sign in to create a conversation");
      return;
    }
    if (isCreating) return;
    setIsCreating(true);
    try {
      const created = await createWorkspaceConversation({
        workspaceId,
        userId,
        name: "New conversation",
      });
      if (!created) {
        toast.error(
          "Could not create conversation — ensure shared conversations migration is applied",
        );
        return;
      }
      // Put newest channel first; list sort also uses updatedAt/createdAt
      setChannels((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      const id = channelConversation(created.id);
      setShowArchived(false);
      setSearchQuery("");
      setSelected(id);
      setMobileShowThread(true);
      setAutoRenameKey(conversationKey(id));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async (id: ChatConversationId, title: string) => {
    if (id.kind !== "channel") {
      toast.info("The General channel name can’t be changed");
      return;
    }
    const name = title.trim();
    if (!name) {
      toast.error("Name can’t be empty");
      return;
    }

    // Optimistic
    setChannels((prev) =>
      prev.map((c) =>
        c.id === id.conversationId
          ? { ...c, name, updatedAt: new Date().toISOString() }
          : c,
      ),
    );

    const saved = await updateWorkspaceConversationName({
      conversationId: id.conversationId,
      workspaceId,
      name,
    });
    if (!saved) {
      toast.error("Could not rename conversation");
      void reloadMeta();
      return;
    }
    setChannels((prev) =>
      prev.map((c) => (c.id === saved.id ? saved : c)),
    );
  };

  const [headerRenaming, setHeaderRenaming] = useState(false);
  const [headerRenameValue, setHeaderRenameValue] = useState("");
  const headerRenameRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!headerRenaming) return;
    const t = window.setTimeout(() => {
      headerRenameRef.current?.focus();
      headerRenameRef.current?.select();
    }, 30);
    return () => window.clearTimeout(t);
  }, [headerRenaming]);

  const startHeaderRename = () => {
    if (!selected || selected.kind !== "channel") return;
    setHeaderRenameValue(headerTitle);
    setHeaderRenaming(true);
  };

  const commitHeaderRename = async () => {
    if (!headerRenaming || !selected || selected.kind !== "channel") return;
    setHeaderRenaming(false);
    const next = headerRenameValue.trim();
    if (!next || next === headerTitle) return;
    await handleRename(selected, next);
  };

  const handleArchive = async (id: ChatConversationId, archived: boolean) => {
    if (!userId) {
      toast.error("Sign in to archive conversations");
      return;
    }
    const key = conversationKey(id);
    const archivedAt = archived ? new Date().toISOString() : null;

    setPrefs((prev) => {
      const existing = prev.find((p) => p.conversationKey === key);
      if (existing) {
        return prev.map((p) =>
          p.conversationKey === key
            ? { ...p, archivedAt, updatedAt: new Date().toISOString() }
            : p,
        );
      }
      return [
        ...prev,
        {
          id: `local-${key}`,
          workspaceId,
          userId,
          conversationKey: key,
          title: null,
          archivedAt,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    });

    if (selected && archived && conversationIdsEqual(id, selected)) {
      setSelected(null);
      setMobileShowThread(false);
    }

    const saved = await upsertConversationPref({
      workspaceId,
      userId,
      conversationKey: key,
      archivedAt,
    });
    if (!saved) {
      toast.error("Could not update archive");
      void reloadMeta();
      return;
    }
    setPrefs((prev) => {
      const without = prev.filter((p) => p.conversationKey !== key);
      return [...without, saved];
    });
    toast.success(archived ? "Conversation archived" : "Conversation restored");
  };

  const requestDelete = (id: ChatConversationId) => {
    const meta = allConversations.find((c) => conversationIdsEqual(c.id, id));
    setPendingDelete({
      id,
      title: meta?.title ?? (id.kind === "general" ? "General" : "this conversation"),
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const isGeneral = pendingDelete.id.kind === "general";
    const conversationId =
      pendingDelete.id.kind === "channel" ? pendingDelete.id.conversationId : null;
    const key = conversationKey(pendingDelete.id);
    setIsDeleting(true);
    try {
      const ok = await deleteWorkspaceConversation({
        workspaceId,
        conversationId,
      });
      if (!ok) {
        toast.error("Could not delete conversation");
        throw new Error("delete failed");
      }

      if (isGeneral) {
        // Remove legacy General messages — list no longer injects empty General
        setInboxMessages((prev) => prev.filter((m) => !!m.conversationId));
        setPrefs((prev) =>
          prev.filter((p) => p.conversationKey !== "general" && p.conversationKey !== "team"),
        );
      } else if (conversationId) {
        setChannels((prev) => prev.filter((c) => c.id !== conversationId));
        setInboxMessages((prev) =>
          prev.filter((m) => m.conversationId !== conversationId),
        );
        setPrefs((prev) => prev.filter((p) => p.conversationKey !== key));
      }

      if (selected && conversationIdsEqual(pendingDelete.id, selected)) {
        setSelected(null);
        setMobileShowThread(false);
      }

      setPendingDelete(null);
      toast.success(
        isGeneral ? "General removed" : "Conversation deleted",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!selected || chat.messages.length === 0) return;
    const last = chat.messages[chat.messages.length - 1];
    setInboxMessages((prev) => {
      if (prev.some((m) => m.id === last.id)) return prev;
      return [...prev, last];
    });
  }, [chat.messages, selected]);

  return (
    <div className={cn("chat-root chat-view flex flex-col flex-1 min-h-0 w-full", className)}>
      <div className="chat-workspace flex flex-1 min-h-0 w-full overflow-hidden rounded-none md:rounded-2xl border-0 md:border border-border-glass bg-bg-card md:shadow-[var(--card-shadow)]">
        <aside
          className={cn(
            "chat-view__rail flex flex-col w-full md:w-[min(20rem,34%)] shrink-0 border-r border-border-glass bg-bg min-h-0",
            mobileShowThread && hasSelection && "hidden md:flex",
          )}
        >
          <ConversationList
            items={visibleConversations}
            selected={selected}
            onSelect={handleSelect}
            onCreateConversation={handleCreateConversation}
            onRename={handleRename}
            onArchive={handleArchive}
            onDelete={requestDelete}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            showArchived={showArchived}
            onShowArchivedChange={setShowArchived}
            autoRenameKey={autoRenameKey}
            onAutoRenameHandled={() => setAutoRenameKey(null)}
            isCreating={isCreating}
            isLoading={!metaReady}
          />
        </aside>

        <section
          className={cn(
            "chat-view__thread flex flex-col flex-1 min-w-0 min-h-0 bg-bg",
            // Mobile: list-only until a conversation is chosen
            (!hasSelection || !mobileShowThread) && "hidden md:flex",
          )}
        >
          {!hasSelection ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border-glass bg-surface-hover text-neon-purple">
                <MessageCircle className="h-7 w-7" aria-hidden />
              </div>
              <div className="space-y-1 max-w-xs">
                <p className="text-sm font-semibold text-text-primary">
                  Select a conversation
                </p>
                <p className="text-xs text-text-muted">
                  Choose a channel from the list, or press New to create one.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="chat-view__thread-header shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border-glass">
                <button
                  type="button"
                  className="md:hidden rounded-lg p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover"
                  onClick={() => setMobileShowThread(false)}
                  aria-label="Back to conversations"
                >
                  ←
                </button>
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    selected.kind === "general"
                      ? "bg-neon-purple/15 text-neon-purple border-neon-purple/30"
                      : "bg-surface-hover text-text-secondary border-border-glass",
                  )}
                  aria-hidden
                >
                  {selected.kind === "general" ? (
                    <Hash className="h-4 w-4" />
                  ) : (
                    selectedMeta?.avatarLabel ?? "#"
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {headerRenaming && selected.kind === "channel" ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void commitHeaderRename();
                      }}
                      className="min-w-0"
                    >
                      <input
                        ref={headerRenameRef}
                        value={headerRenameValue}
                        onChange={(e) => setHeaderRenameValue(e.target.value)}
                        onBlur={() => void commitHeaderRename()}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setHeaderRenaming(false);
                          }
                        }}
                        maxLength={80}
                        className="input w-full max-w-md rounded-lg border border-neon-purple/50 bg-bg px-2.5 py-1.5 text-sm font-semibold ring-2 ring-neon-purple/20"
                        aria-label="Conversation name"
                      />
                      <p className="mt-0.5 text-[10px] text-text-muted">
                        Enter to save · Esc to cancel
                      </p>
                    </form>
                  ) : (
                    <>
                      <div className="font-semibold text-sm text-text-primary flex items-center gap-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={
                            selected.kind === "channel" ? startHeaderRename : undefined
                          }
                          onDoubleClick={
                            selected.kind === "channel" ? startHeaderRename : undefined
                          }
                          className={cn(
                            "truncate text-left rounded-md px-0.5 -mx-0.5",
                            selected.kind === "channel" &&
                              "hover:bg-surface-hover cursor-text",
                          )}
                          title={
                            selected.kind === "channel"
                              ? "Click to rename"
                              : undefined
                          }
                        >
                          {headerTitle}
                        </button>
                        {selected.kind === "channel" ? (
                          <button
                            type="button"
                            onClick={startHeaderRename}
                            className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:text-neon-purple hover:bg-neon-purple/10 transition"
                            title="Rename conversation"
                            aria-label="Rename conversation"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        {selectedMeta?.archived ? (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted border border-border-glass rounded-full px-1.5 py-0.5">
                            Archived
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        {headerSubtitle}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0 px-3 md:px-5 py-3 flex flex-col">
                <WorkspaceChatPanel
                  key={conversationKey(selected)}
                  workspaceId={workspaceId}
                  workspaceName={workspaceName}
                  userId={userId}
                  members={members}
                  chat={chat}
                  showHeader={false}
                  className="flex-1 min-h-0"
                />
              </div>
            </>
          )}
        </section>
      </div>

      <ConfirmationModal
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDelete(null);
        }}
        title={
          pendingDelete?.id.kind === "general"
            ? "Delete General?"
            : "Delete conversation?"
        }
        highlight={pendingDelete?.title}
        description={
          pendingDelete?.id.kind === "general"
            ? "This permanently deletes every message in the legacy General channel for everyone in the workspace. General will not reappear unless old messages remain. Prefer named channels (New) going forward. This cannot be undone."
            : "This permanently deletes the channel and all of its messages for everyone in the workspace. This cannot be undone."
        }
        confirmText={
          pendingDelete?.id.kind === "general"
            ? "Delete General"
            : "Delete conversation"
        }
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
