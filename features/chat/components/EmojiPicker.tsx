"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMOJI_CATEGORIES } from "../lib/emojis";

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
  const category = EMOJI_CATEGORIES.find((c) => c.id === tab) ?? EMOJI_CATEGORIES[0];

  return (
    <div
      className={cn(
        "w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#111114] shadow-2xl overflow-hidden",
        placement === "above" ? "mb-2" : "mt-2",
        className
      )}
      role="dialog"
      aria-label="Emoji picker"
    >
      <div className="flex gap-0.5 p-1.5 border-b border-white/10 overflow-x-auto">
        {EMOJI_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setTab(c.id)}
            className={cn(
              "px-2 py-1 text-[10px] rounded-lg shrink-0 transition",
              tab === c.id
                ? "bg-[#c084fc] text-black font-medium"
                : "text-[#a1a1aa] hover:bg-white/5"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div
        className="emoji-picker-grid p-2 max-h-[200px] overflow-y-auto overflow-x-hidden"
        style={{
          fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
        }}
      >
        {category.emojis.map((emoji) => (
          <button
            key={`${category.id}-${emoji}`}
            type="button"
            className="emoji-picker-cell flex items-center justify-center rounded-lg text-xl hover:bg-white/10 active:scale-95 transition"
            onClick={() => {
              onPick(emoji);
              onClose?.();
            }}
          >
            {emoji}
          </button>
        ))}
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
      window.innerWidth - panelW - 8
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
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("touchstart", onDoc, { passive: true });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
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
          document.body
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
          "shrink-0 flex items-center justify-center transition text-[#a1a1aa] hover:text-white disabled:opacity-40",
          variant === "icon"
            ? "h-[42px] w-[42px] rounded-xl border border-white/10 hover:border-[#c084fc]/40 hover:bg-white/5"
            : "h-7 px-2 rounded-lg text-xs border border-white/10 hover:bg-white/5",
          className
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