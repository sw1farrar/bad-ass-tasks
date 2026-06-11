"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal, Pin, PinOff, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import type { OnAddListItem } from "@/lib/lists/addListItem";
import type { ListItem, WorkspaceList } from "@/types";
import {
  getListColorStyleForTheme,
  getListColorsForTheme,
} from "@/lib/lists/listColorStyles";
import type { ListColorId } from "@/store/listSlice";
import { useTaskStore } from "@/store/useTaskStore";
import { ListCardBody } from "./ListCard";

interface ListDetailModalProps {
  list: WorkspaceList | null;
  items: ListItem[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateList: (id: string, updates: Partial<WorkspaceList>) => void;
  onDeleteList: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onAddItem: OnAddListItem;
  onToggleItem: (id: string) => void;
  onUpdateItem: (id: string, text: string) => void;
  onDeleteItem: (id: string) => void;
  onReorderItems: (listId: string, activeId: string, overId: string) => void;
  onIndentItem: (id: string) => void;
  onOutdentItem: (id: string) => void;
  onClearCompleted: (listId: string) => void;
}

const PANEL_SPRING = { type: "spring" as const, damping: 32, stiffness: 380, mass: 0.85 };

export function ListDetailModal({
  list,
  items,
  isOpen,
  onClose,
  onUpdateList,
  onDeleteList,
  onTogglePinned,
  onAddItem,
  onToggleItem,
  onUpdateItem,
  onDeleteItem,
  onReorderItems,
  onIndentItem,
  onOutdentItem,
  onClearCompleted,
}: ListDetailModalProps) {
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const isMobile = useIsMobileViewport();
  const theme = useTaskStore((s) => s.theme);
  const listColors = getListColorsForTheme(theme);
  const activeColorRing = theme === "light" ? "#7c3aed" : "#f4f4f5";
  const colorStyle = list ? getListColorStyleForTheme(list.color, theme) : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setMenuOpen(false);
      setColorOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && list && colorStyle && (
        <div
          className={cn(
            "list-detail-modal-root fixed inset-0 z-[200]",
            "flex items-center justify-center p-4 sm:p-6",
          )}
        >
          <motion.div
            key="list-detail-backdrop"
            className={cn(
              "absolute inset-0",
              isMobile ? "sheet-backdrop" : "overlay-scrim backdrop-blur-sm",
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            aria-hidden="true"
          />

          <motion.article
            key="list-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="list-detail-title"
            className={cn(
              "list-detail-modal glass modal-panel relative flex w-full flex-col overflow-hidden border shadow-2xl",
              isMobile
                ? "list-detail-sheet list-detail-sheet--mobile max-h-[min(88dvh,720px)] rounded-2xl"
                : "list-detail-panel max-h-[min(85vh,720px)] max-w-2xl rounded-2xl",
            )}
            data-list-color={list.color}
            style={{
              background: colorStyle.bg,
              borderColor: colorStyle.border,
              ["--list-bg" as string]: colorStyle.bg,
              ["--list-border" as string]: colorStyle.border,
              ["--list-chip-bg" as string]: colorStyle.bg,
              ["--list-chip-border" as string]: colorStyle.border,
            }}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={PANEL_SPRING}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="list-detail-header flex shrink-0 items-start gap-2 border-b border-border-glass px-4 py-3.5">
              <div className="min-w-0 flex-1">
                {list.pinned && <div className="list-card-pinned-badge mb-1">Pinned</div>}
                <input
                  id="list-detail-title"
                  value={list.title}
                  onChange={(e) => onUpdateList(list.id, { title: e.target.value })}
                  onBlur={(e) => {
                    const trimmed = e.target.value.trim();
                    onUpdateList(list.id, { title: trimmed || "Untitled list" });
                  }}
                  className="w-full bg-transparent text-lg font-semibold text-text-primary outline-none placeholder:text-text-muted"
                  placeholder="Title"
                  aria-label="List title"
                />
                {items.length > 0 && (
                  <div className="mt-1 text-[11px] text-text-muted">
                    {items.filter((i) => !i.completed).length} open
                    {items.some((i) => i.completed)
                      ? ` · ${items.filter((i) => i.completed).length} done`
                      : ""}
                  </div>
                )}
              </div>
              <div className="relative flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen((v) => !v);
                    setColorOpen(false);
                  }}
                  className="rounded-lg p-2 text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
                  aria-label="List options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-2 text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
                  aria-label="Close list"
                >
                  <X className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full z-30 mt-1 min-w-[10rem] rounded-xl border border-border-glass bg-bg-card py-1 text-xs shadow-xl">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover"
                      onClick={() => {
                        onTogglePinned(list.id);
                        setMenuOpen(false);
                      }}
                    >
                      {list.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      {list.pinned ? "Unpin" : "Pin to top"}
                    </button>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-surface-hover"
                      onClick={() => setColorOpen((v) => !v)}
                    >
                      Change color
                    </button>
                    {items.some((i) => i.completed) && (
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-text-secondary hover:bg-surface-hover"
                        onClick={() => {
                          onClearCompleted(list.id);
                          setMenuOpen(false);
                        }}
                      >
                        Delete completed
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[var(--priority-p0)] hover:bg-surface-hover"
                      onClick={() => {
                        onDeleteList(list.id);
                        setMenuOpen(false);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete list
                    </button>
                  </div>
                )}
                {colorOpen && (
                  <div className="absolute right-0 top-full z-30 mt-1 flex gap-1.5 rounded-xl border border-border-glass bg-bg-card p-2 shadow-xl">
                    {listColors.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        title={c.label}
                        className={cn("list-color-dot", list.color === c.id && "is-active")}
                        style={{
                          background: c.bg,
                          borderColor: list.color === c.id ? activeColorRing : c.border,
                        }}
                        onClick={() => {
                          onUpdateList(list.id, { color: c.id as ListColorId });
                          setColorOpen(false);
                          setMenuOpen(false);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </header>

            <ListCardBody
              list={list}
              items={items}
              variant="detail"
              onUpdateList={onUpdateList}
              onDeleteList={onDeleteList}
              onTogglePinned={onTogglePinned}
              onAddItem={onAddItem}
              onToggleItem={onToggleItem}
              onUpdateItem={onUpdateItem}
              onDeleteItem={onDeleteItem}
              onReorderItems={onReorderItems}
              onIndentItem={onIndentItem}
              onOutdentItem={onOutdentItem}
              onClearCompleted={onClearCompleted}
            />
          </motion.article>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}