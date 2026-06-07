"use client";

import React, { useEffect, useRef } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Loader2, PanelRightClose } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceMember } from "@/types";
import { useWorkspaceChat, type WorkspaceChatController } from "../hooks/useWorkspaceChat";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageItem } from "./ChatMessageItem";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d, yyyy");
}

function initials(name: string): string {
  const parts = name.replace(/^@/, "").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
}

export interface WorkspaceChatPanelProps {
  workspaceId: string;
  workspaceName?: string;
  userId: string | undefined;
  members: WorkspaceMember[];
  className?: string;
  showHeader?: boolean;
  /** Shared chat controller from parent (avoids duplicate subscriptions). */
  chat?: WorkspaceChatController;
  onCollapse?: () => void;
}

function WorkspaceChatPanelInner({
  workspaceName,
  userId,
  members,
  className,
  showHeader = true,
  chat,
  onCollapse,
}: WorkspaceChatPanelProps & { chat: WorkspaceChatController }) {
  const { messages, isLoading, isSending, send, resolveAuthor, toggleReaction, getReactionSummaries } =
    chat;
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);

  useEffect(() => {
    if (!stickBottom.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    stickBottom.current = nearBottom;
  };

  let lastDay = "";

  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      {showHeader && (
        <div className="shrink-0 pb-3 border-b border-white/10 mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-sm tracking-tight">Messages</div>
            {workspaceName && (
              <div className="text-[11px] text-[#71717a] truncate">{workspaceName}</div>
            )}
          </div>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="shrink-0 p-1.5 rounded-lg border border-white/10 text-[#71717a] hover:text-white hover:border-[#c084fc]/40 hover:bg-white/5 transition"
              aria-label="Collapse messages"
              title="Collapse"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 space-y-3"
      >
        {isLoading ? (
          <div className="flex justify-center py-8 text-[#71717a]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-[#71717a] text-center py-8 px-2">
            Say hello to your team.
          </p>
        ) : (
          messages.map((msg) => {
            const day = dayLabel(msg.createdAt);
            const showDay = day !== lastDay;
            if (showDay) lastDay = day;
            const mine = msg.userId === userId;
            const author = resolveAuthor(msg.userId, members, msg);

            return (
              <React.Fragment key={msg.id}>
                {showDay && (
                  <div className="flex justify-center">
                    <span className="text-[10px] text-[#71717a] px-2 py-0.5 rounded-full bg-white/5">
                      {day}
                    </span>
                  </div>
                )}
                <ChatMessageItem
                  msg={msg}
                  mine={mine}
                  author={author}
                  showAvatar={!mine}
                  avatarInitials={initials(author)}
                  summaries={getReactionSummaries(msg.id)}
                  onToggleReaction={(emoji) => void toggleReaction(msg.id, emoji)}
                  disabled={!userId}
                />
              </React.Fragment>
            );
          })
        )}
      </div>

      <ChatComposer onSend={send} isSending={isSending} disabled={!userId} />
    </div>
  );
}

function WorkspaceChatPanelWithHook(
  props: WorkspaceChatPanelProps & { isOpen?: boolean }
) {
  const { workspaceId, userId, members, isOpen = true, chat: _chat, ...rest } = props;
  const chat = useWorkspaceChat({ workspaceId, userId, members, isOpen });
  return <WorkspaceChatPanelInner {...rest} workspaceId={workspaceId} userId={userId} members={members} chat={chat} />;
}

export function WorkspaceChatPanel(props: WorkspaceChatPanelProps & { isOpen?: boolean }) {
  if (props.chat) {
    return <WorkspaceChatPanelInner {...props} chat={props.chat} />;
  }
  return <WorkspaceChatPanelWithHook {...props} />;
}