"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArchiveX,
  Hash,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeFormatDistanceToNow } from "@/lib/datetime";
import type { ConversationListItem } from "../lib/conversations";
import type { ChatConversationId } from "@/types";
import { conversationIdsEqual } from "../lib/conversations";

interface ConversationListProps {
  items: ConversationListItem[];
  selected: ChatConversationId | null;
  onSelect: (id: ChatConversationId) => void;
  onCreateConversation?: () => void | Promise<void>;
  onRename?: (id: ChatConversationId, title: string) => void | Promise<void>;
  onArchive?: (id: ChatConversationId, archived: boolean) => void | Promise<void>;
  onDelete?: (id: ChatConversationId) => void | Promise<void>;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  showArchived: boolean;
  onShowArchivedChange: (show: boolean) => void;
  /** Auto-start rename for this conversation key (after New) */
  autoRenameKey?: string | null;
  onAutoRenameHandled?: () => void;
  isCreating?: boolean;
  /** True while channels/inbox meta is still loading — avoid flashing General-only list */
  isLoading?: boolean;
  className?: string;
}

export function ConversationList({
  items,
  selected,
  onSelect,
  onCreateConversation,
  onRename,
  onArchive,
  onDelete,
  searchQuery,
  onSearchQueryChange,
  showArchived,
  onShowArchivedChange,
  autoRenameKey,
  onAutoRenameHandled,
  isCreating = false,
  isLoading = false,
  className,
}: ConversationListProps) {
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const archivedCount = useMemo(
    () => items.filter((i) => i.archived).length,
    [items],
  );

  useEffect(() => {
    if (!menuKey) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuKey(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuKey]);

  // Auto-start rename when a new conversation is created (wait until the row exists)
  useEffect(() => {
    if (!autoRenameKey) return;
    const item = items.find((i) => i.key === autoRenameKey);
    if (!item) return; // list not updated yet — keep waiting
    if (item.isGeneral) {
      onAutoRenameHandled?.();
      return;
    }
    setMenuKey(null);
    setRenamingKey(item.key);
    setRenameValue(item.title);
    onAutoRenameHandled?.();
  }, [autoRenameKey, items, onAutoRenameHandled]);

  useEffect(() => {
    if (!renamingKey) return;
    const id = window.setTimeout(() => {
      const el = renameInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    }, 30);
    return () => window.clearTimeout(id);
  }, [renamingKey]);

  const beginRename = (item: ConversationListItem) => {
    if (item.isGeneral || !onRename) return;
    setMenuKey(null);
    setRenamingKey(item.key);
    setRenameValue(item.title);
  };

  const commitRename = async (item: ConversationListItem) => {
    if (renamingKey !== item.key) return;
    const next = renameValue.trim();
    setRenamingKey(null);
    if (!onRename) return;
    if (!next) return; // keep previous name
    if (next === item.title) return;
    await onRename(item.id, next);
  };

  return (
    <div className={cn("chat-conversation-list flex flex-col min-h-0 h-full", className)}>
      <div className="chat-conversation-list__header shrink-0 px-3 py-3 border-b border-border-glass space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neon-purple/12 text-neon-purple border border-neon-purple/25">
              <MessageCircle className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-text-primary">
                {showArchived ? "Archived" : "Chat"}
              </h2>
              {showArchived ? (
                <p className="text-[11px] text-text-muted truncate">
                  {archivedCount} archived
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onShowArchivedChange(!showArchived)}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
                showArchived
                  ? "border-neon-purple/40 bg-neon-purple/15 text-neon-purple"
                  : "border-border-glass text-text-muted hover:text-text-primary hover:border-neon-purple/30",
              )}
              title={showArchived ? "Back to inbox" : "View archived"}
              aria-pressed={showArchived}
              aria-label={showArchived ? "Back to inbox" : "View archived conversations"}
            >
              {showArchived ? (
                <ArchiveX className="h-3.5 w-3.5" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
            </button>
            {!showArchived && onCreateConversation ? (
              <button
                type="button"
                onClick={() => void onCreateConversation()}
                disabled={isCreating}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-glass px-2.5 text-[11px] font-semibold text-text-secondary transition hover:text-neon-purple hover:border-neon-purple/35 hover:bg-neon-purple/8 disabled:opacity-50"
                title="New conversation"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isCreating ? "Creating…" : "New"}</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={
              showArchived
                ? "Search archived…"
                : "Search conversations & messages…"
            }
            className="input w-full rounded-lg border border-border-glass bg-surface-hover/60 py-2 pl-8 pr-8 text-xs"
            aria-label="Search conversations and messages"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchQueryChange("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-muted hover:text-text-primary"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <ul
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-0.5"
        role="listbox"
        aria-label={showArchived ? "Archived conversations" : "Conversations"}
      >
        {isLoading ? (
          <li className="px-3 py-10 text-center text-xs text-text-muted" aria-busy="true">
            Loading conversations…
          </li>
        ) : items.length === 0 ? (
          <li className="px-3 py-10 text-center text-xs text-text-muted">
            {searchQuery.trim()
              ? "No conversations match your search"
              : showArchived
                ? "No archived conversations"
                : "No conversations yet — press New to create one"}
          </li>
        ) : (
          items.map((item) => {
            const active = !!selected && conversationIdsEqual(item.id, selected);
            const when = item.lastMessageAt
              ? safeFormatDistanceToNow(item.lastMessageAt, "")
              : "";
            const isRenaming = renamingKey === item.key;

            return (
              <li key={item.key} className="relative">
                <div
                  className={cn(
                    "chat-conversation-row group flex items-start gap-2 rounded-xl border px-2 py-2 transition",
                    active
                      ? "border-neon-purple/40 bg-neon-purple/12"
                      : "border-transparent hover:bg-surface-hover hover:border-border-glass",
                  )}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => onSelect(item.id)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      beginRename(item);
                    }}
                    className="flex min-w-0 flex-1 items-start gap-2.5 text-left px-1 py-0.5"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold border",
                        item.isGeneral
                          ? "bg-neon-purple/15 text-neon-purple border-neon-purple/30"
                          : "bg-surface-hover text-text-secondary border-border-glass",
                      )}
                      aria-hidden
                    >
                      {item.isGeneral ? (
                        <Hash className="h-4 w-4" />
                      ) : (
                        item.avatarLabel
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void commitRename(item);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => void commitRename(item)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setRenamingKey(null);
                              }
                            }}
                            maxLength={80}
                            className="input w-full rounded-md border border-neon-purple/50 bg-bg px-2 py-1 text-[12px] font-semibold ring-2 ring-neon-purple/25"
                            aria-label="Conversation name"
                          />
                          <p className="mt-0.5 text-[10px] text-text-muted">
                            Enter to save · Esc to cancel
                          </p>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-semibold text-text-primary">
                              {item.title}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {when ? (
                                <span className="text-[10px] text-text-muted tabular-nums">
                                  {when}
                                </span>
                              ) : null}
                              {item.unread ? (
                                <span
                                  className="h-2 w-2 rounded-full bg-neon-purple"
                                  title="Unread"
                                />
                              ) : null}
                            </div>
                          </div>
                          <p className="mt-0.5 text-[11px] text-text-muted truncate">
                            {item.lastPreview?.trim() ||
                              item.subtitle ||
                              "No messages yet"}
                          </p>
                        </>
                      )}
                    </div>
                  </button>

                  {!isRenaming ? (
                    <div
                      className="relative shrink-0 pt-1 flex items-center gap-0.5"
                      ref={menuKey === item.key ? menuRef : undefined}
                    >
                      {!item.isGeneral && onRename ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            beginRename(item);
                          }}
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:text-neon-purple hover:bg-neon-purple/10 transition",
                            "opacity-100 md:opacity-0 md:group-hover:opacity-100",
                            active && "md:opacity-100",
                          )}
                          title="Rename conversation"
                          aria-label={`Rename ${item.title}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      {onArchive ||
                      (!item.isGeneral && onRename) ||
                      onDelete ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuKey((k) => (k === item.key ? null : item.key));
                            }}
                            className={cn(
                              "inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition",
                              "opacity-100 md:opacity-0 md:group-hover:opacity-100",
                              (menuKey === item.key || active) && "md:opacity-100",
                              menuKey === item.key && "bg-surface-hover",
                            )}
                            aria-label="Conversation options"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {menuKey === item.key ? (
                            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-border-glass bg-bg-card py-1 shadow-xl">
                              {!item.isGeneral && onRename ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                                  onClick={() => beginRename(item)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Rename
                                </button>
                              ) : null}
                              {onArchive ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                                  onClick={() => {
                                    setMenuKey(null);
                                    void onArchive(item.id, !item.archived);
                                  }}
                                >
                                  {item.archived ? (
                                    <>
                                      <ArchiveRestore className="h-3.5 w-3.5" />
                                      Unarchive
                                    </>
                                  ) : (
                                    <>
                                      <Archive className="h-3.5 w-3.5" />
                                      Archive
                                    </>
                                  )}
                                </button>
                              ) : null}
                              {onDelete ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--priority-p0)] hover:bg-[var(--priority-p0)]/10"
                                  onClick={() => {
                                    setMenuKey(null);
                                    void onDelete(item.id);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
