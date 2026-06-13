"use client";

import React from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

type FileBookmarkButtonProps = {
  bookmarked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
};

export function FileBookmarkButton({
  bookmarked,
  onToggle,
  disabled = false,
  className,
  size = "md",
}: FileBookmarkButtonProps) {
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      disabled={disabled}
      className={cn(
        "file-bookmark-btn inline-flex items-center justify-center rounded-lg transition",
        "text-text-muted hover:bg-surface-hover hover:text-neon-purple-tint",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple/40",
        "disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "min-h-[36px] min-w-[36px]" : "min-h-[44px] min-w-[44px]",
        bookmarked && "file-bookmark-btn--active text-neon-purple",
        className,
      )}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark file"}
      aria-pressed={bookmarked}
      title={bookmarked ? "Remove bookmark" : "Bookmark file"}
    >
      <Bookmark className={cn(iconClass, bookmarked && "fill-current")} aria-hidden />
    </button>
  );
}