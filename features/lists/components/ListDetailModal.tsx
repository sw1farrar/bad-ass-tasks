"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, MoreHorizontal, X } from "lucide-react";
import { cn, triggerHaptic } from "@/lib/utils";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useMobileSheetDrag } from "@/lib/hooks/useMobileSheetDrag";
import { MOBILE_SHEET_HEIGHT_CLASS, SHEET_SPRING } from "@/lib/motion/sheet";
import {
  isListDetailSheetDragTarget,
  isListDetailTitleLabelTarget,
} from "@/lib/motion/sheetDragTarget";
import { SheetDragHandle } from "@/components/SheetDragHandle";
import type { OnAddListItem } from "@/lib/lists/addListItem";
import type { ListItem, WorkspaceList } from "@/types";
import {
  getListColorPresentation,
  getListColorsForTheme,
  listColorPresentationStyleVars,
} from "@/lib/lists/listColorStyles";
import type { ListColorId } from "@/store/listSlice";
import { useTaskStore } from "@/store/useTaskStore";
import { ListCardBody } from "./ListCard";
import { SharedListBadge } from "./SharedListBadge";

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
  onCompleteItemFamily: (id: string) => void;
  onUpdateItem: (id: string, text: string) => void;
  onDeleteItem: (id: string) => void;
  onIndentItem: (id: string) => void;
  onOutdentItem: (id: string) => void;
  onNudgeListItem: (
    listId: string,
    itemId: string,
    direction: "up" | "down",
    visibleItemIds: ReadonlySet<string>,
  ) => void;
  onMoveItemToList: (itemId: string, targetListId: string) => void;
  onClearCompleted: (listId: string) => void;
  onSetListItemPending: (id: string, pending: boolean) => void;
  onRestorePending: (listId: string) => void;
  onClearPending: (listId: string) => void;
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
  onCompleteItemFamily,
  onUpdateItem,
  onDeleteItem,
  onIndentItem,
  onOutdentItem,
  onNudgeListItem,
  onMoveItemToList,
  onClearCompleted,
  onSetListItemPending,
  onRestorePending,
  onClearPending,
}: ListDetailModalProps) {
  const [mounted, setMounted] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [titleEditMode, setTitleEditMode] = useState(false);
  const [localTitle, setLocalTitle] = useState(list?.title ?? "");
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const sheetSurfaceRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobileViewport();
  const theme = useTaskStore((s) => s.theme);
  const workspaceLists = useTaskStore((s) => s.workspaceLists);
  const listColors = getListColorsForTheme(theme);
  const moveTargetLists = useMemo(() => {
    if (!list) return [];
    return workspaceLists
      .filter(
        (candidate) =>
          candidate.workspaceId === list.workspaceId &&
          !candidate.archived &&
          candidate.id !== list.id,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        colorStyle: getListColorPresentation(candidate.color, theme, { opaque: true }),
      }));
  }, [list, theme, workspaceLists]);
  const activeColorRing = theme === "light" ? "#7c3aed" : "#f4f4f5";
  const colorStyle = list
    ? getListColorPresentation(list.color, theme, { opaque: true })
    : null;
  const openCount = useMemo(
    () => items.filter((item) => !item.completed && !item.pending).length,
    [items],
  );
  const displayTitle = list ? list.title.trim() || "Untitled list" : "";

  useEffect(() => {
    if (!titleEditMode && list) {
      setLocalTitle(list.title);
    }
  }, [list?.id, list?.title, titleEditMode]);

  const selectAllTitle = useCallback(() => {
    const input = titleInputRef.current;
    if (!input) return;
    input.focus();
    const apply = () => input.setSelectionRange(0, input.value.length);
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
    });
  }, []);

  const enterTitleEdit = useCallback(() => {
    if (!list) return;
    setLocalTitle(list.title);
    setTitleEditMode(true);
  }, [list]);

  const commitTitle = useCallback(() => {
    if (!list) return;
    setTitleEditMode(false);
    const next = localTitle.trim() || "Untitled list";
    setLocalTitle(next);
    const current = list.title.trim() || "Untitled list";
    if (next !== current) {
      onUpdateList(list.id, { title: next });
    }
  }, [list, localTitle, onUpdateList]);

  useLayoutEffect(() => {
    if (!titleEditMode) return;
    selectAllTitle();
  }, [titleEditMode, selectAllTitle]);

  const applyListColorToPanel = useCallback((el: HTMLElement | null) => {
    if (!el || !colorStyle) return;
    const vars = listColorPresentationStyleVars(colorStyle);
    for (const [key, value] of Object.entries(vars)) {
      el.style.setProperty(key, value);
    }
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
    if (isMobile) triggerHaptic("light");
    onClose();
  }, [isMobile, onClose]);

  const {
    dragY,
    isDragging,
    backdropOpacity,
    resetDrag,
    startDrag,
    attachCaptureDragSurface,
    attachScrollDismiss,
    handleDragEnd,
    handleDrag,
    drag,
    dragControlsProp,
    dragListener,
    dragMomentum,
    dragConstraints,
    dragElastic,
  } = useMobileSheetDrag({
    enabled: isMobile && isOpen,
    onDismiss: handleClose,
    dragMode: "handle",
    dragEngine: "manual",
  });

  const sheetDragConfig = useMemo(
    () => ({
      getScrollEl: () => listScrollRef.current,
      scrollGateSelector: ".list-detail-scroll",
      canStart: isListDetailSheetDragTarget,
      onTapFromTarget: (target: EventTarget) =>
        isListDetailTitleLabelTarget(target) ? enterTitleEdit : undefined,
    }),
    [enterTitleEdit],
  );

  useLayoutEffect(() => {
    if (!isMobile || !isOpen) return;
    const cleanupSurface = attachCaptureDragSurface(sheetSurfaceRef.current, {
      ...sheetDragConfig,
      scrollDismissSelector: ".list-detail-scroll",
    });
    const cleanupScroll = attachScrollDismiss(listScrollRef.current, sheetDragConfig);
    return () => {
      cleanupSurface?.();
      cleanupScroll?.();
    };
  }, [
    attachCaptureDragSurface,
    attachScrollDismiss,
    sheetDragConfig,
    isMobile,
    isOpen,
    list?.id,
  ]);

  const blurSheetInputs = useCallback(() => {
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      panelRef.current?.contains(active) &&
      active.matches("input,textarea,[contenteditable='true']")
    ) {
      active.blur();
    }
  }, []);

  useEffect(() => {
    if (isDragging) blurSheetInputs();
  }, [isDragging, blurSheetInputs]);

  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setColorOpen(false);
      setTitleEditMode(false);
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
            animate={{ opacity: isMobile ? backdropOpacity : 1 }}
            exit={{ opacity: 0 }}
            transition={isMobile && dragY > 0 ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
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
              ...listColorPresentationStyleVars(colorStyle),
              ...(isMobile ? { touchAction: "pan-y" as const } : {}),
            }}
            drag={isMobile ? drag : false}
            dragControls={isMobile ? dragControlsProp : undefined}
            dragListener={dragListener}
            dragMomentum={isMobile ? dragMomentum : undefined}
            dragConstraints={isMobile ? dragConstraints : undefined}
            dragElastic={isMobile ? dragElastic : undefined}
            onDrag={isMobile ? handleDrag : undefined}
            onDragEnd={isMobile ? handleDragEnd : undefined}
            initial={isMobile ? { y: "100%" } : { scale: 0.96, opacity: 0 }}
            animate={isMobile ? { y: dragY, opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={isMobile ? { y: "100%", opacity: 0.92 } : { scale: 0.96, opacity: 0 }}
            transition={isMobile && isDragging ? { duration: 0 } : SHEET_SPRING}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="list-detail-modal-bg pointer-events-none absolute inset-0 z-0"
              style={{ backgroundColor: colorStyle.bg }}
              aria-hidden
            />
            <div
              ref={sheetSurfaceRef}
              className={cn(
                "list-detail-modal-surface relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden",
                isMobile && "list-detail-sheet-drag-zone",
                isMobile && isDragging && "list-detail-sheet-dragging",
              )}
              style={{
                backgroundColor: colorStyle.bg,
                ...listColorPresentationStyleVars(colorStyle),
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

                <div className="min-w-0 flex-1 flex flex-col items-start">
                  {list.isShared ? (
                    <SharedListBadge
                      sourceWorkspaceName={list.sourceWorkspaceName}
                      sharedByName={list.sharedByName}
                      className="mb-1"
                    />
                  ) : null}
                  {list.pinned && !list.isShared ? (
                    <div className="list-header-badge list-card-pinned-badge mb-1">Pinned</div>
                  ) : null}
                  <div className="list-card-title-row list-detail-title-row inline-flex max-w-full items-baseline gap-2">
                    {titleEditMode ? (
                      <div className="list-header-title-field list-detail-title-field min-w-0 max-w-full w-fit">
                        <input
                          ref={titleInputRef}
                          id="list-detail-title"
                          value={localTitle}
                          onChange={(e) => setLocalTitle(e.target.value)}
                          onBlur={commitTitle}
                          onFocus={selectAllTitle}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitTitle();
                              e.currentTarget.blur();
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setLocalTitle(list.title);
                              setTitleEditMode(false);
                              e.currentTarget.blur();
                            }
                          }}
                          className="list-header-title list-card-title bg-transparent text-lg font-semibold outline-none"
                          style={{
                            width: `${Math.min(Math.max(localTitle.length + 1, 4), 48)}ch`,
                            maxWidth: "100%",
                          }}
                          placeholder="Title"
                          aria-label="List title"
                        />
                      </div>
                    ) : (
                      <span
                        id="list-detail-title"
                        role="button"
                        tabIndex={0}
                        className="list-header-title list-card-title list-detail-title-label text-lg font-semibold"
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          enterTitleEdit();
                        }}
                      >
                        {displayTitle}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="list-detail-header-actions relative flex shrink-0 items-center gap-1"
                  ref={menuRef}
                >
                  {openCount > 0 ? (
                    <span
                      className="list-detail-header-count shrink-0 tabular-nums"
                      aria-label={`${openCount} open item${openCount === 1 ? "" : "s"}`}
                    >
                      {openCount}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setColorOpen((v) => !v)}
                    className="list-header-btn list-detail-header-btn min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition"
                    aria-label="Change list color"
                    aria-expanded={colorOpen}
                  >
                    <MoreHorizontal className="h-5 w-5" strokeWidth={2.25} />
                  </button>
                  {!isMobile && (
                    <button
                      type="button"
                      onClick={handleClose}
                      className="list-header-btn list-detail-header-btn min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition"
                      aria-label="Close list"
                    >
                      <X className="h-5 w-5" strokeWidth={2.25} />
                    </button>
                  )}
                {colorOpen && (
                  <div
                    className="list-detail-color-picker absolute right-0 top-full z-30 mt-1 flex gap-2 rounded-xl p-2.5"
                    style={listColorPresentationStyleVars(colorStyle)}
                  >
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
              listScrollRef={listScrollRef}
              onUpdateList={onUpdateList}
              onDeleteList={onDeleteList}
              onTogglePinned={onTogglePinned}
              onAddItem={onAddItem}
              onToggleItem={onToggleItem}
              onCompleteItemFamily={onCompleteItemFamily}
              onUpdateItem={onUpdateItem}
              onDeleteItem={onDeleteItem}
              onIndentItem={onIndentItem}
              onOutdentItem={onOutdentItem}
              onNudgeListItem={onNudgeListItem}
              onMoveItemToList={onMoveItemToList}
              moveTargetLists={moveTargetLists}
              onClearCompleted={onClearCompleted}
              onSetListItemPending={onSetListItemPending}
              onRestorePending={onRestorePending}
              onClearPending={onClearPending}
            />
            </div>
          </motion.article>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}