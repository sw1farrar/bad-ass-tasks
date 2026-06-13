"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import type { ListColorPresentation } from "@/lib/lists/listColorStyles";

export type ListItemMoveTarget = {
  id: string;
  title: string;
  colorStyle?: ListColorPresentation;
};

interface ListItemMoveMenuProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  lists: ListItemMoveTarget[];
  onSelect: (listId: string) => void;
  onClose: () => void;
}

export function ListItemMoveMenu({
  open,
  anchorRef,
  lists,
  onSelect,
  onClose,
}: ListItemMoveMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const menuWidth = 220;
      const menuHeight = Math.min(280, lists.length * 44 + 16);

      let top = rect.bottom + 6;
      let left = rect.right - menuWidth;
      left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin));

      if (top + menuHeight > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - menuHeight - 6);
      }

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, lists.length, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onClose, open]);

  if (!open || !position || lists.length === 0) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="list-item-move-menu"
      style={{ top: position.top, left: position.left }}
      role="menu"
      aria-label="Move to list"
    >
      <div className="list-item-move-menu-title">Move to list</div>
      <ul className="list-item-move-menu-list">
        {lists.map((target) => (
          <li key={target.id}>
            <button
              type="button"
              role="menuitem"
              className="list-item-move-menu-option"
              onClick={() => {
                onSelect(target.id);
                onClose();
              }}
            >
              <span
                className="list-item-move-menu-dot"
                style={
                  target.colorStyle
                    ? {
                        background: target.colorStyle.bg,
                        borderColor: target.colorStyle.border,
                      }
                    : undefined
                }
                aria-hidden="true"
              />
              <span className={cn("list-item-move-menu-label", !target.title.trim() && "is-empty")}>
                {target.title.trim() || "Untitled list"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}