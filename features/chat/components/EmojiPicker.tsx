"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Smile, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMOJI_CATEGORIES, searchEmojis, type EmojiEntry } from "../lib/emojis";

interface EmojiPickerPopoverProps {
  onPick: (emoji: string) => void;
  onClose?: () => void;
  className?: string;
  placement?: "above" | "below";
}

export function EmojiPickerPopover({
  onPick,
  onClose,
  className,
  placement = "above",
}: EmojiPickerPopoverProps) {
  const [tab, setTab] = useState(EMOJI_CATEGORIES[0]?.id ?? "smileys");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, []);

  const category = EMOJI_CATEGORIES.find((c) => c.id === tab) ?? EMOJI_CATEGORIES[0];
  const isSearching = query.trim().length > 0;

  const visible: EmojiEntry[] = useMemo(() => {
    if (isSearching) return searchEmojis(query);
    return category?.emojis ?? [];
  }, [isSearching, query, category]);

  return (
    <div
      className={cn(
        "emoji-picker-popover w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-border-glass bg-bg-secondary shadow-2xl overflow-hidden",
        placement === "above" ? "mb-2" : "mt-2",
        className,
      )}
      role="dialog"
      aria-label="Emoji picker"
    >
      <div className="relative border-b border-border-glass p-2">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji, emotion, or word…"
          className="input w-full rounded-xl border border-border-glass bg-surface-hover py-2 pl-9 pr-8 text-xs"
          aria-label="Search emojis"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-muted hover:text-text-primary"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {!isSearching ? (
        <div className="flex gap-0.5 p-1.5 border-b border-border-glass overflow-x-auto">
          {EMOJI_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setTab(c.id)}
              className={cn(
                "px-2 py-1 text-[10px] rounded-lg shrink-0 transition",
                tab === c.id
                  ? "bg-neon-purple text-accent-on font-medium"
                  : "text-text-secondary hover:bg-surface-hover",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="px-3 py-1.5 border-b border-border-glass text-[10px] text-text-muted">
          {visible.length === 0
            ? "No matches"
            : `${visible.length} match${visible.length === 1 ? "" : "es"}`}
        </div>
      )}

      <div
        className="emoji-picker-grid p-2 max-h-[220px] overflow-y-auto overflow-x-hidden"
        style={{
          fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
        }}
      >
        {visible.length === 0 ? (
          <p className="col-span-full px-2 py-6 text-center text-xs text-text-muted">
            Try “happy”, “fire”, “thumbs”, or “love”
          </p>
        ) : (
          visible.map((entry) => (
            <button
              key={`${isSearching ? "search" : category?.id}-${entry.emoji}-${entry.keywords[0]}`}
              type="button"
              title={entry.keywords.slice(0, 4).join(", ")}
              className="emoji-picker-cell flex items-center justify-center rounded-lg text-xl hover:bg-surface-hover active:scale-95 transition"
              onClick={() => {
                onPick(entry.emoji);
                onClose?.();
              }}
            >
              {entry.emoji}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  disabled?: boolean;
  className?: string;
  /** Icon-only trigger (composer) vs compact */
  variant?: "icon" | "pill";
}

export function EmojiPicker({
  onPick,
  disabled,
  className,
  variant = "icon",
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const anchor = triggerRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const panelW = 360;
    const left = Math.min(
      Math.max(8, rect.right - panelW),
      window.innerWidth - panelW - 8,
    );
    setCoords({
      top: rect.top - 8,
      left,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("touchstart", onDoc, { passive: true });
      window.addEventListener("keydown", onKey);
    }, 200);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handlePick = (emoji: string) => {
    onPick(emoji);
    setOpen(false);
  };

  const popover =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[300] animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: coords.top,
              left: coords.left,
              transform: "translateY(-100%)",
              width: "min(360px, calc(100vw - 2rem))",
            }}
            role="presentation"
          >
            <EmojiPickerPopover onPick={handlePick} onClose={() => setOpen(false)} />
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "shrink-0 flex items-center justify-center transition text-text-secondary hover:text-text-primary disabled:opacity-40",
          variant === "icon"
            ? "h-[42px] w-[42px] rounded-xl border border-border-glass hover:border-neon-purple/40 hover:bg-surface-hover"
            : "h-7 px-2 rounded-lg text-xs border border-border-glass hover:bg-surface-hover",
          className,
        )}
        aria-label="Insert emoji"
        aria-expanded={open}
      >
        <Smile className="h-4 w-4" />
        {variant === "pill" && <span className="ml-1">Emoji</span>}
      </button>
      {popover}
    </>
  );
}
