"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUICK_REACTIONS } from "../lib/emojis";
import { EmojiPickerPopover } from "./EmojiPicker";

interface ReactionPickerProps {
  onPick: (emoji: string) => void;
  disabled?: boolean;
  className?: string;
  /** Controlled open (e.g. long-press on message) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element to anchor the popover (defaults to trigger button) */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function ReactionPicker({
  onPick,
  disabled,
  className,
  open: controlledOpen,
  onOpenChange,
  anchorRef: externalAnchor,
}: ReactionPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [showFullGrid, setShowFullGrid] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
      if (!next) setShowFullGrid(false);
    },
    [isControlled, onOpenChange]
  );

  const updatePosition = useCallback(() => {
    const anchor = externalAnchor?.current ?? triggerRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const panelW = 360;
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - panelW / 2),
      window.innerWidth - panelW - 8
    );
    setCoords({
      top: rect.top - 8,
      left,
    });
  }, [externalAnchor]);

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
      if (
        panelRef.current?.contains(t) ||
        triggerRef.current?.contains(t) ||
        externalAnchor?.current?.contains(t)
      ) {
        return;
      }
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
  }, [open, setOpen, externalAnchor]);

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
              width: 360,
            }}
            role="dialog"
            aria-label="Add reaction"
          >
            <div className="rounded-2xl border border-border-glass bg-bg-secondary shadow-2xl overflow-hidden">
              <div
                className="flex items-center gap-0.5 p-2 border-b border-border-glass overflow-x-auto"
                style={{
                  fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
                }}
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handlePick(emoji)}
                    className="h-9 w-9 flex items-center justify-center rounded-xl text-xl hover:bg-surface-hover active:scale-90 transition"
                    title={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {!showFullGrid ? (
                <button
                  type="button"
                  onClick={() => setShowFullGrid(true)}
                  className="w-full py-2 text-[11px] text-neon-purple hover:bg-surface-hover transition"
                >
                  More emojis…
                </button>
              ) : (
                <EmojiPickerPopover
                  onPick={handlePick}
                  placement="below"
                  className="border-0 rounded-none shadow-none w-full"
                />
              )}
            </div>
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
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={cn(
          "h-7 w-7 rounded-full border border-border-glass bg-bg-secondary/90 backdrop-blur-sm",
          "flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-neon-purple/40 hover:bg-surface-hover transition shadow-sm",
          className
        )}
        aria-label="Add reaction"
        aria-expanded={open}
      >
        <Smile className="h-3.5 w-3.5" />
      </button>
      {popover}
    </>
  );
}