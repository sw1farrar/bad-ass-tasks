"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useMobileSheetDrag } from "@/lib/hooks/useMobileSheetDrag";
import { MOBILE_SHEET_HEIGHT_CLASS, SHEET_SPRING } from "@/lib/motion/sheet";
import { SheetDragHandle } from "@/components/SheetDragHandle";
import type { OnAddListItem } from "@/lib/lists/addListItem";
import type { ListItem, WorkspaceList } from "@/types";
import {
  getListColorPresentation,
  getListColorsForTheme,
} from "@/lib/lists/listColorStyles";
import type { ListColorId } from "@/store/listSlice";
import { useTaskStore } from "@/store/useTaskStore";
import { ListCardBody } from "./ListCard";

interface ListDetailModalProps {
  list: WorkspaceList | null;
  items: ListItem[];
  isOpen: boolean;
  /** Focus the new-item field when a list is freshly created. */
  focusAddItemOnOpen?: boolean;
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

const safeX =
  "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]";

export function ListDetailModal({
  list,
  items,
  isOpen,
  focusAddItemOnOpen = false,
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
  const [colorOpen, setColorOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobileViewport();
  const theme = useTaskStore((s) => s.theme);
  const listColors = getListColorsForTheme(theme);
  const activeColorRing = theme === "light" ? "#7c3aed" : "#f4f4f5";
  const colorStyle = list
    ? getListColorPresentation(list.color, theme, { opaque: isMobile })
    : null;

  const applyListColorToPanel = useCallback((el: HTMLElement | null) => {
    if (!el || !colorStyle) return;
    el.style.setProperty("--list-bg", colorStyle.bg);
    el.style.setProperty("--list-border", colorStyle.border);
    el.style.setProperty("--list-chip-bg", colorStyle.bg);
    el.style.setProperty("--list-chip-border", colorStyle.border);
    el.style.setProperty("--list-title-color", colorStyle.titleColor);
    el.style.setProperty("--list-meta-color", colorStyle.metaColor);
    el.style.setProperty("--list-item-text-color", colorStyle.itemTextColor);
    el.style.setProperty("--list-check-border", colorStyle.checkBorder);
    el.style.backgroundColor = colorStyle.bg;
    el.style.borderColor = colorStyle.border;
  }, [colorStyle]);

  const setPanelRef = useCallback(
    (el: HTMLElement | null) => {
      panelRef.current = el;
      applyListColorToPanel(el);
    },
    [applyListColorToPanel],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    applyListColorToPanel(panelRef.current);
  }, [isOpen, applyListColorToPanel, list?.color, list?.id, theme]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const {
    dragY,
    resetDrag,
    startDrag,
    handleDragEnd,
    handleDrag,
    drag,
    dragControlsProp,
    dragListener,
    dragConstraints,
    dragElastic,
  } = useMobileSheetDrag({
    enabled: isMobile && isOpen,
    onDismiss: handleClose,
    dragMode: "handle",
  });

  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setColorOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!colorOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setColorOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [colorOpen]);

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
    <AnimatePresence onExitComplete={resetDrag}>
      {isOpen && list && colorStyle && (
        <div
          className={cn(
            "list-detail-modal-root fixed inset-0 z-[200] flex p-0",
            isMobile ? "flex-col justify-end" : "items-center justify-center p-4 sm:p-6",
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
            ref={setPanelRef}
            key="list-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="list-detail-title"
            className={cn(
              "list-detail-modal modal-panel relative flex w-full flex-col overflow-hidden border shadow-2xl",
              isMobile
                ? cn("list-detail-sheet list-detail-sheet--mobile rounded-t-3xl max-w-none", MOBILE_SHEET_HEIGHT_CLASS)
                : "list-detail-panel max-h-[min(85vh,720px)] max-w-2xl rounded-2xl",
            )}
            data-list-color={list.color}
            style={{
              backgroundColor: colorStyle.bg,
              borderColor: colorStyle.border,
              ["--list-bg" as string]: colorStyle.bg,
              ["--list-border" as string]: colorStyle.border,
              ["--list-chip-bg" as string]: colorStyle.bg,
              ["--list-chip-border" as string]: colorStyle.border,
              ["--list-title-color" as string]: colorStyle.titleColor,
              ["--list-meta-color" as string]: colorStyle.metaColor,
              ["--list-item-text-color" as string]: colorStyle.itemTextColor,
              ["--list-check-border" as string]: colorStyle.checkBorder,
            }}
            drag={isMobile ? drag : false}
            dragControls={isMobile ? dragControlsProp : undefined}
            dragListener={dragListener}
            dragConstraints={isMobile ? dragConstraints : undefined}
            dragElastic={isMobile ? dragElastic : undefined}
            onDrag={isMobile ? handleDrag : undefined}
            onDragEnd={isMobile ? handleDragEnd : undefined}
            initial={isMobile ? { y: "100%" } : { scale: 0.96, opacity: 0 }}
            animate={isMobile ? { y: dragY, opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={isMobile ? { y: "100%" } : { scale: 0.96, opacity: 0 }}
            transition={SHEET_SPRING}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="list-detail-modal-bg pointer-events-none absolute inset-0 z-0"
              style={{ backgroundColor: colorStyle.bg }}
              aria-hidden
            />
            <div
              className="list-detail-modal-surface relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden"
              style={{
                backgroundColor: colorStyle.bg,
                ["--list-bg" as string]: colorStyle.bg,
                ["--list-border" as string]: colorStyle.border,
                ["--list-chip-bg" as string]: colorStyle.bg,
                ["--list-chip-border" as string]: colorStyle.border,
                ["--list-title-color" as string]: colorStyle.titleColor,
                ["--list-meta-color" as string]: colorStyle.metaColor,
                ["--list-item-text-color" as string]: colorStyle.itemTextColor,
                ["--list-check-border" as string]: colorStyle.checkBorder,
              }}
            >
            <div className="list-header-band shrink-0">
              {isMobile && (
                <SheetDragHandle
                  onPointerDown={startDrag}
                  showChevron
                  className="list-detail-sheet-handle"
                />
              )}

              <header
                className={cn(
                  "list-detail-header flex items-start gap-2 py-3",
                  safeX,
                  isMobile ? "px-3 pt-[max(0.5rem,env(safe-area-inset-top))]" : "px-4 py-3.5",
                )}
              >
                {isMobile && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="list-header-btn list-detail-back-btn shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition"
                    aria-label="Back to lists"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}

                <div className="min-w-0 flex-1">
                  {list.pinned && (
                    <div className="list-header-badge list-card-pinned-badge mb-1">Pinned</div>
                  )}
                  <div className="list-header-title-field">
                    <input
                      id="list-detail-title"
                      value={list.title}
                      onChange={(e) => onUpdateList(list.id, { title: e.target.value })}
                      onBlur={(e) => {
                        const trimmed = e.target.value.trim();
                        onUpdateList(list.id, { title: trimmed || "Untitled list" });
                      }}
                      className="list-header-title w-full bg-transparent text-lg font-semibold outline-none"
                      placeholder="Title"
                      aria-label="List title"
                    />
                  </div>
                  {(items.some((i) => !i.completed) || items.some((i) => i.completed)) && (
                    <div className="list-header-meta mt-1 text-[11px]">
                      {items.filter((i) => !i.completed).length > 0
                        ? `${items.filter((i) => !i.completed).length} open${
                            items.some((i) => i.completed)
                              ? ` · ${items.filter((i) => i.completed).length} done`
                              : ""
                          }`
                        : `${items.filter((i) => i.completed).length} done`}
                    </div>
                  )}
                </div>

                <div className="relative flex shrink-0 items-center gap-0.5" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setColorOpen((v) => !v)}
                    className="list-header-btn min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition"
                    aria-label="Change list color"
                    aria-expanded={colorOpen}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {!isMobile && (
                    <button
                      type="button"
                      onClick={handleClose}
                      className="list-header-btn min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition"
                      aria-label="Close list"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                {colorOpen && (
                  <div className="absolute right-0 top-full z-30 mt-1 flex gap-2 rounded-xl border border-border-glass bg-bg-card p-2.5 shadow-xl">
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
                        }}
                      />
                    ))}
                  </div>
                )}
                </div>
              </header>
            </div>

            <ListCardBody
              list={list}
              items={items}
              variant="detail"
              focusAddItemOnOpen={focusAddItemOnOpen}
              listColorStyle={colorStyle}
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
            </div>
          </motion.article>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}