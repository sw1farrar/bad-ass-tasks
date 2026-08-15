"use client";

import React, { useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { insertAtCursor } from "../lib/emojis";
import { EmojiPicker } from "./EmojiPicker";

interface ChatComposerProps {
  onSend: (body: string) => Promise<boolean>;
  isSending?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatComposer({
  onSend,
  isSending = false,
  disabled = false,
  placeholder = "Write a message…",
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    const text = value.trim();
    if (!text || isSending || disabled) return;
    const ok = await onSend(text);
    if (ok) {
      setValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const onEmojiPick = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setValue((v) => v + emoji);
      return;
    }
    insertAtCursor(el, emoji, value, setValue);
  };

  return (
    <div
      className="chat-composer border-t border-border-glass bg-bg/95 p-3 shrink-0"
      style={{
        paddingBottom:
          "max(0.75rem, env(safe-area-inset-bottom), var(--keyboard-inset, 0px))",
      }}
    >
      <div className="flex gap-2 items-end min-w-0">
        <EmojiPicker
          className="chat-composer__emoji-btn shrink-0"
          onPick={onEmojiPick}
          disabled={disabled || isSending}
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={1}
          disabled={disabled || isSending}
          placeholder={placeholder}
          className={cn(
            "chat-composer__input flex-1 resize-none rounded-xl bg-surface-hover border border-border-glass",
            "px-3 py-2.5 text-sm outline-none focus:border-neon-purple/50",
            "placeholder:text-text-muted min-h-[42px] max-h-[120px]",
            "whitespace-pre-wrap"
          )}
          style={{ fontFamily: 'inherit, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' }}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={disabled || isSending || !value.trim()}
          className="chat-composer__send btn btn-primary h-[42px] w-[42px] p-0 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50"
          aria-label="Send message"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}