"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  CornerLeftUp,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { readListThemeVarsFromElement } from "@/lib/lists/listColorStyles";
import {
  computeInlineMenuPosition,
  type InlineMenuPosition,
} from "@/lib/lists/computeInlineMenuPosition";
import type { ListItemMoveTarget } from "./ListItemMoveMenu";

const MENU_WIDTH_PX = 216;

interface ListItemActionsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMenuInteract?: () => void;
  showReorder?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canIndent?: boolean;
  canOutdent?: boolean;
  onIndent?: () => void;
  onOutdent?: () => void;
  moveTargetLists?: ListItemMoveTarget[];
  onMoveToList?: (targetListId: string) => void;
  showEdit?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ListItemActionsMenu({
  open,
  onOpenChange,
  onMenuInteract,
  showReorder = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  canIndent = false,
  canOutdent = false,
  onIndent,
  onOutdent,
  moveTargetLists = [],
  onMoveToList,
  showEdit = false,
  onEdit,
  onDelete,
}: ListItemActionsMenuProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [moveListExpanded, setMoveListExpanded] = useState(false);
  const [menuPosition, setMenuPosition] = useState<InlineMenuPosition | null>(null);
  const [menuThemeVars, setMenuThemeVars] = useState<Record<string, string>>({});

  const syncMenuTheme = useCallback(() => {
    setMenuThemeVars(readListThemeVarsFromElement(anchorRef.current));
  }, []);

  const updateMenuPosition = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    syncMenuTheme();
    setMenuPosition(
      computeInlineMenuPosition({
        anchorRect: anchor.getBoundingClientRect(),
        menuWidth: MENU_WIDTH_PX,
        menuHeight: menu.offsetHeight,
      }),
    );
  }, [syncMenuTheme]);

  const scheduleMenuPositionUpdate = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(updateMenuPosition);
    });
  }, [updateMenuPosition]);

  useEffect(() => {
    if (!open) {
      setMoveListExpanded(false);
      setMenuPosition(null);
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    updateMenuPosition();
    const frame = requestAnimationFrame(updateMenuPosition);

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [
    moveListExpanded,
    moveTargetLists.length,
    open,
    showEdit,
    showReorder,
    updateMenuPosition,
  ]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onOpenChange(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpenChange, open]);

  const keepMenuOpen = (action?: () => void) => {
    onMenuInteract?.();
    action?.();
    scheduleMenuPositionUpdate();
  };

  const showMoveSection = !!onMoveToList && moveTargetLists.length > 0;

  const menuContent = (
    <>
      {showReorder ? (
        <div className="list-item-actions-menu-section">
          <div className="list-item-actions-menu-grid">
            <button
              type="button"
              role="menuitem"
              className="list-item-actions-menu-btn"
              disabled={!canMoveUp}
              onClick={() => keepMenuOpen(onMoveUp)}
            >
              <ChevronUp className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              <span>Move up</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="list-item-actions-menu-btn"
              disabled={!canMoveDown}
              onClick={() => keepMenuOpen(onMoveDown)}
            >
              <ChevronDown className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              <span>Move down</span>
            </button>
          </div>
        </div>
      ) : null}

      <div className="list-item-actions-menu-section">
        <div className="list-item-actions-menu-grid">
          <button
            type="button"
            role="menuitem"
            className="list-item-actions-menu-btn"
            disabled={!canOutdent}
            onClick={() => keepMenuOpen(onOutdent)}
          >
            <CornerLeftUp className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            <span>Outdent</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="list-item-actions-menu-btn"
            disabled={!canIndent}
            onClick={() => keepMenuOpen(onIndent)}
          >
            <CornerDownRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            <span>Indent</span>
          </button>
        </div>
      </div>

      {showMoveSection ? (
        <div className="list-item-actions-menu-section">
          <button
            type="button"
            role="menuitem"
            className="list-item-actions-menu-row"
            aria-expanded={moveListExpanded}
            onClick={() => {
              onMenuInteract?.();
              setMoveListExpanded((value) => !value);
              scheduleMenuPositionUpdate();
            }}
          >
            <span className="list-item-actions-menu-row-leading">
              <ArrowRightLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              <span>Move to list</span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                moveListExpanded && "rotate-180",
              )}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
          {moveListExpanded ? (
            <ul className="list-item-actions-menu-move-list">
              {moveTargetLists.map((target) => (
                <li key={target.id}>
                  <button
                    type="button"
                    role="menuitem"
                    className="list-item-actions-menu-move-option"
                    onClick={() => {
                      onMoveToList?.(target.id);
                      onOpenChange(false);
                    }}
                  >
                    <span
                      className="list-item-actions-menu-move-dot"
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
                    <span
                      className={cn(
                        "list-item-actions-menu-move-label",
                        !target.title.trim() && "is-empty",
                      )}
                    >
                      {target.title.trim() || "Untitled list"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {showEdit ? (
        <div className="list-item-actions-menu-section">
          <button
            type="button"
            role="menuitem"
            className="list-item-actions-menu-row"
            onClick={() => {
              onOpenChange(false);
              onEdit?.();
            }}
          >
            <span className="list-item-actions-menu-row-leading">
              <Pencil className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              <span>Edit name</span>
            </span>
          </button>
        </div>
      ) : null}

      <div className="list-item-actions-menu-section list-item-actions-menu-section--footer">
        <button
          type="button"
          role="menuitem"
          className="list-item-actions-menu-row list-item-actions-menu-row--danger"
          onClick={() => {
            onOpenChange(false);
            onDelete?.();
          }}
        >
          <span className="list-item-actions-menu-row-leading">
            <Trash2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            <span>Remove item</span>
          </span>
        </button>
      </div>
    </>
  );

  return (
    <div
      ref={anchorRef}
      className={cn("list-item-menu shrink-0", open && "is-open")}
    >
      <button
        type="button"
        className="list-item-menu-trigger"
        aria-label="Item actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onMenuInteract?.();
          onOpenChange(!open);
        }}
      >
        <MoreHorizontal className="list-item-menu-trigger-icon" strokeWidth={2.25} aria-hidden />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              className={cn(
                "list-item-actions-menu",
                !menuPosition && "list-item-actions-menu--measuring",
                menuPosition?.placement === "above" && "list-item-actions-menu--above",
                menuPosition?.placement === "below" && "list-item-actions-menu--below",
              )}
              style={
                menuPosition
                  ? {
                      top: menuPosition.top,
                      left: menuPosition.left,
                      width: MENU_WIDTH_PX,
                      maxHeight: menuPosition.maxHeight,
                      ...menuThemeVars,
                    }
                  : {
                      top: 0,
                      left: 0,
                      width: MENU_WIDTH_PX,
                      ...menuThemeVars,
                    }
              }
              role="menu"
              aria-label="Item actions"
            >
              {menuContent}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}