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
import { CHAT_READ_EVENT, hasUnreadChatActivity } from "@/lib/chatReadState";
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
  const [selected, setSelected] = useState<ChatConversationId>(generalConversation());
  const [channels, setChannels] = useState<WorkspaceConversation[]>([]);
  const [inboxMessages, setInboxMessages] = useState<WorkspaceMessage[]>([]);
  const [prefs, setPrefs] = useState<WorkspaceConversationPref[]>([]);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [autoRenameKey, setAutoRenameKey] = useState<string | null>(null);
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
  }, [workspaceId, userId]);

  useEffect(() => {
    let cancelled = false;
    setChannels([]);
    setInboxMessages([]);
    setPrefs([]);
    (async () => {
      if (!isSupabaseConfigured() || ["w1", "w2"].includes(workspaceId)) return;
      const [chs, rows, prefRows] = await Promise.all([
        fetchWorkspaceConversations(workspaceId),
        fetchWorkspaceMessagesForInbox(workspaceId, 250),
        userId ? fetchConversationPrefs(workspaceId, userId) : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setChannels(chs);
      setInboxMessages(rows);
      setPrefs(prefRows);
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
    setSelected(generalConversation());
    setMobileShowThread(false);
    setSearchQuery("");
    setShowArchived(false);
    setAutoRenameKey(null);
  }, [workspaceId]);

  const chat = useWorkspaceChat({
    workspaceId,
    userId,
    members,
    isOpen: true,
    conversation: selected,
  });

  const previewMessages = useMemo(() => {
    const byId = new Map(inboxMessages.map((m) => [m.id, m]));
    for (const m of chat.messages) {
      byId.set(m.id, m);
    }
    return [...byId.values()];
  }, [inboxMessages, chat.messages]);

  const isConversationUnread = useCallback(
    (conversation: ChatConversationId) => {
      // Selected + loaded thread owns its unread via live mark-read
      if (conversationIdsEqual(conversation, selected) && !chat.isLoading) {
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
    const byArchive = allConversations.filter((c) =>
      showArchived ? c.archived : !c.archived,
    );
    return filterConversationsBySearch(byArchive, previewMessages, searchQuery);
  }, [allConversations, showArchived, previewMessages, searchQuery]);

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
    const sel = allConversations.find((c) => conversationIdsEqual(c.id, selected));
    if (!sel) return;

    let next: ChatConversationId | null = null;
    if (showArchived && !sel.archived) {
      next = visibleConversations[0]?.id ?? null;
    } else if (!showArchived && sel.archived) {
      next = generalConversation();
    }

    if (next && !conversationIdsEqual(next, selected)) {
      setSelected(next);
    }
  }, [showArchived, selected, allConversations, visibleConversations]);

  const selectedMeta = useMemo(
    () => allConversations.find((c) => conversationIdsEqual(c.id, selected)),
    [allConversations, selected],
  );

  const headerTitle = selectedMeta?.title ?? (selected.kind === "general" ? "General" : "Conversation");
  const headerSubtitle =
    selected.kind === "general"
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
    if (selected.kind !== "channel") return;
    setHeaderRenameValue(headerTitle);
    setHeaderRenaming(true);
  };

  const commitHeaderRename = async () => {
    if (!headerRenaming) return;
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

    if (archived && conversationIdsEqual(id, selected)) {
      setSelected(generalConversation());
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
    if (id.kind !== "channel") {
      toast.error("General cannot be deleted");
      return;
    }
    const meta = allConversations.find((c) => conversationIdsEqual(c.id, id));
    setPendingDelete({
      id,
      title: meta?.title ?? "this conversation",
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete || pendingDelete.id.kind !== "channel") return;
    const conversationId = pendingDelete.id.conversationId;
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

      setChannels((prev) => prev.filter((c) => c.id !== conversationId));
      setInboxMessages((prev) =>
        prev.filter((m) => m.conversationId !== conversationId),
      );
      setPrefs((prev) => prev.filter((p) => p.conversationKey !== key));

      if (conversationIdsEqual(pendingDelete.id, selected)) {
        setSelected(generalConversation());
        setMobileShowThread(false);
      }

      setPendingDelete(null);
      toast.success("Conversation deleted");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (chat.messages.length === 0) return;
    const last = chat.messages[chat.messages.length - 1];
    setInboxMessages((prev) => {
      if (prev.some((m) => m.id === last.id)) return prev;
      return [...prev, last];
    });
  }, [chat.messages]);

  return (
    <div className={cn("chat-root chat-view flex flex-col flex-1 min-h-0 w-full", className)}>
      <div className="chat-workspace flex flex-1 min-h-0 w-full overflow-hidden rounded-none md:rounded-2xl border-0 md:border border-border-glass bg-bg-card md:shadow-[var(--card-shadow)]">
        <aside
          className={cn(
            "chat-view__rail flex flex-col w-full md:w-[min(20rem,34%)] shrink-0 border-r border-border-glass bg-bg min-h-0",
            mobileShowThread && "hidden md:flex",
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
          />
        </aside>

        <section
          className={cn(
            "chat-view__thread flex flex-col flex-1 min-w-0 min-h-0 bg-bg",
            !mobileShowThread && "hidden md:flex",
          )}
        >
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
        </section>

        {!selected && (
          <div className="hidden md:flex flex-1 items-center justify-center text-text-muted text-sm gap-2">
            <MessageCircle className="h-5 w-5" />
            Select a conversation
          </div>
        )}
      </div>

      <ConfirmationModal
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDelete(null);
        }}
        title="Delete conversation?"
        highlight={pendingDelete?.title}
        description="This permanently deletes the channel and all of its messages for everyone in the workspace. This cannot be undone."
        confirmText="Delete conversation"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
