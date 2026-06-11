"use client";

import React, { useRef, useState } from "react";
import { cn, formatLocalTime } from "@/lib/utils";
import type { ReactionSummary, WorkspaceMessage } from "@/types";
import { MessageReactions } from "./MessageReactions";
import { ReactionPicker } from "./ReactionPicker";

const LONG_PRESS_MS = 450;

interface ChatMessageItemProps {
  msg: WorkspaceMessage;
  mine: boolean;
  author: string;
  showAvatar: boolean;
  avatarInitials: string;
  summaries: ReactionSummary[];
  onToggleReaction: (emoji: string) => void;
  disabled?: boolean;
}

export function ChatMessageItem({
  msg,
  mine,
  author,
  showAvatar,
  avatarInitials,
  summaries,
  onToggleReaction,
  disabled,
}: ChatMessageItemProps) {
  const [reactionOpen, setReactionOpen] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onTouchStart = () => {
    if (disabled) return;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      setReactionOpen(true);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(10);
        } catch {
          /* ignore */
        }
      }
    }, LONG_PRESS_MS);
  };

  const onTouchEnd = () => {
    clearLongPress();
  };

  return (
    <div className={cn("flex gap-2", mine ? "flex-row-reverse" : "flex-row")}>
      {showAvatar && (
        <div
          className="chat-message-avatar h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-neon-purple/30 to-neon-purple-dark/20 border border-border-glass flex items-center justify-center text-[10px] font-semibold text-text-primary"
          title={author}
        >
          {avatarInitials}
        </div>
      )}
      {!showAvatar && !mine && <div className="w-7 shrink-0" />}

      <div className={cn("relative max-w-[85%] min-w-0", mine && "items-end flex flex-col")}>
        {!mine && (
          <div className="chat-message-author text-[10px] text-text-muted mb-0.5 ml-0.5 truncate">{author}</div>
        )}

        <div
          className={cn(
            "flex flex-col gap-1",
            mine ? "items-end" : "items-start"
          )}
        >
          <div
            ref={bubbleRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onTouchMove={clearLongPress}
            onTouchCancel={clearLongPress}
            onContextMenu={(e) => {
              if (disabled) return;
              e.preventDefault();
              setReactionOpen(true);
            }}
            className={cn(
              "chat-message-bubble rounded-2xl px-3 py-2 text-sm leading-snug break-words whitespace-pre-wrap select-none touch-manipulation",
              mine
                ? "chat-message-bubble--mine bg-neon-purple text-accent-on rounded-br-md"
                : "chat-message-bubble--theirs bg-surface-hover border border-border-glass text-text-primary rounded-bl-md"
            )}
            style={{
              fontFamily:
                'inherit, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
            }}
          >
            {msg.body}
          </div>

          <div
            className={cn(
              "flex flex-wrap items-center gap-1",
              mine ? "justify-end" : "justify-start"
            )}
          >
            <ReactionPicker
              disabled={disabled}
              open={reactionOpen}
              onOpenChange={setReactionOpen}
              onPick={onToggleReaction}
            />
            <MessageReactions
              summaries={summaries}
              onToggle={onToggleReaction}
              disabled={disabled}
              align={mine ? "right" : "left"}
              inline
            />
          </div>
        </div>

        <div
          className={cn(
            "chat-message-timestamp text-[9px] text-text-muted mt-0.5 tabular-nums",
            mine ? "text-right" : "ml-0.5"
          )}
        >
          {formatLocalTime(msg.createdAt)}
        </div>
      </div>
    </div>
  );
}