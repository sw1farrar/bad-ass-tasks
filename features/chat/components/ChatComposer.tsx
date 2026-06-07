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
  placeholder = "Message the team…",
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
      className="border-t border-white/10 bg-[#0a0a0f]/95 p-3 shrink-0"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex gap-2 items-end min-w-0">
        <EmojiPicker
          className="shrink-0"
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
            "flex-1 resize-none rounded-xl bg-white/5 border border-white/10",
            "px-3 py-2.5 text-sm outline-none focus:border-[#c084fc]/50",
            "placeholder:text-[#71717a] min-h-[42px] max-h-[120px]",
            "whitespace-pre-wrap"
          )}
          style={{ fontFamily: 'inherit, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' }}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={disabled || isSending || !value.trim()}
          className="btn btn-primary h-[42px] w-[42px] p-0 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50"
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