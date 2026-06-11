"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { ReactionSummary } from "@/types";

interface MessageReactionsProps {
  summaries: ReactionSummary[];
  onToggle: (emoji: string) => void;
  disabled?: boolean;
  align?: "left" | "right";
  /** When true, omit outer margin (sits beside reaction picker). */
  inline?: boolean;
}

/** Committed reaction pills only (counts). Use ReactionPicker to add new ones. */
export function MessageReactions({
  summaries,
  onToggle,
  disabled,
  align = "left",
  inline = false,
}: MessageReactionsProps) {
  if (summaries.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 max-w-full",
        !inline && "mt-1",
        align === "right" && "justify-end"
      )}
      style={{ fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' }}
    >
      {summaries.map((s) => (
        <button
          key={s.emoji}
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(s.emoji);
          }}
          title={s.reactedByMe ? "Remove your reaction" : "Add this reaction"}
          className={cn(
            "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition",
            s.reactedByMe
              ? "bg-neon-purple/25 border-neon-purple/50 text-text-primary"
              : "bg-surface-hover border-border-glass text-text-secondary hover:border-border-glass hover:bg-surface-hover"
          )}
        >
          <span className="text-[15px] leading-none">{s.emoji}</span>
          <span className="text-[10px] tabular-nums font-medium">{s.count}</span>
        </button>
      ))}
    </div>
  );
}