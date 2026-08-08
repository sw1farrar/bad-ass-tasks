"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Share2,
  PenLine,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListItem, WorkspaceList } from "@/types";
import type { FlatListItem } from "@/lib/lists/listItemTree";
import { triggerHaptic } from "@/lib/utils";
import {
  LIST_ITEM_PREVIEW_LIMIT,
  canIndentListItem,
  canOutdentListItem,
  flattenListItems,
  getFlatListNudgeTargets,
  getIncompleteSubtreeItems,
  groupFlatListItemsIntoFamilies,
  hasIncompleteDescendants,
} from "@/lib/lists/listItemTree";
import type { ListItemFamilyChrome } from "@/lib/lists/listDragPreview";
import { getFamilyChromeByItemId } from "@/lib/lists/listDragPreview";
import {
  getListColorPresentation,
  getListColorsForTheme,
  listColorPresentationStyleVars,
  readListThemeVarsFromElement,
  type ListColorPresentation,
} from "@/lib/lists/listColorStyles";
import type { ListColorId } from "@/store/listSlice";
import { useTaskStore } from "@/store/useTaskStore";
import { getPendingEntityTargetIds } from "@/lib/data/hybridStore";
import type { OnAddListItem } from "@/lib/lists/addListItem";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { ListFamilyCompleteConfirmModal } from "./ListFamilyCompleteConfirmModal";
import { ListItemFamilyGroup } from "./ListItemFamilyGroup";
import type { ListItemMoveTarget } from "./ListItemMoveMenu";
import { ListItemRow } from "./ListItemRow";
import { ListShowCompletedToggle } from "./ListShowCompletedToggle";
import { ListShowPendingToggle } from "./ListShowPendingToggle";
import { SharedListBadge } from "./SharedListBadge";

type ListCardVariant = "preview" | "detail";

interface ListCardBodyProps {
  list: WorkspaceList;
  items: ListItem[];
  variant: ListCardVariant;
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
  onNudgeListItem?: (
    listId: string,
    itemId: string,
    direction: "up" | "down",
    visibleItemIds: ReadonlySet<string>,
  ) => void;
  onMoveItemToList?: (itemId: string, targetListId: string) => void;
  moveTargetLists?: ListItemMoveTarget[];
  onClearCompleted: (listId: string) => void;
  onSetListItemPending: (id: string, pending: boolean) => void;
  onRestorePending: (listId: string) => void;
  onClearPending: (listId: string) => void;
  onArchiveList?: (id: string) => void;
  onUnarchiveList?: (id: string) => void;
  onNudgeList?: (listId: string, direction: "up" | "down") => void;
  canNudgeListUp?: boolean;
  canNudgeListDown?: boolean;
  onOpenDetail?: () => void;
  listColorStyle?: ListColorPresentation;
  focusAddItemOnOpen?: boolean;
  listScrollRef?: React.Ref<HTMLDivElement>;
  canShareList?: boolean;
  onShareList?: () => void;
}

export function ListCardBody({
  list,
  items,
  variant,
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
  moveTargetLists = [],
  onClearCompleted,
  onSetListItemPending,
  onRestorePending,
  onClearPending,
  onArchiveList,
  onUnarchiveList,
  onNudgeList,
  canNudgeListUp = false,
  canNudgeListDown = false,
  onOpenDetail,
  listColorStyle,
  focusAddItemOnOpen = false,
  listScrollRef,
  canShareList = false,
  onShareList,
}: ListCardBodyProps) {
  const theme = useTaskStore((s) => s.theme);
  const pendingSyncCount = useTaskStore((s) => s.pendingSyncCount);
  const pendingListItemIds = useMemo(
    () => getPendingEntityTargetIds("list_item"),
    [pendingSyncCount],
  );
  const listColors = getListColorsForTheme(theme);
  const activeColorRing = theme === "light" ? "#7c3aed" : "#f4f4f5";
  const [newItemText, setNewItemText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [titleEditMode, setTitleEditMode] = useState(false);
  const [localTitle, setLocalTitle] = useState(list.title);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [familyCompleteConfirm, setFamilyCompleteConfirm] = useState<{
    parentItem: ListItem;
    itemsToComplete: ListItem[];
  } | null>(null);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [openActionsMenuItemId, setOpenActionsMenuItemId] = useState<string | null>(null);
  const [clearCompletedConfirmOpen, setClearCompletedConfirmOpen] = useState(false);
  const [clearPendingConfirmOpen, setClearPendingConfirmOpen] = useState(false);
  const itemsStackRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const pendingTitleSelectAllRef = useRef(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [menuThemeVars, setMenuThemeVars] = useState<Record<string, string>>({});
  const addItemInputRef = useRef<HTMLInputElement>(null);
  const itemInputRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const isMobile = useIsMobileViewport();
  const isPreview = variant === "preview";
  const isDetail = variant === "detail";
  const mobileDetail = isDetail && isMobile;

  useEffect(() => {
    if (!isPreview || titleEditMode) return;
    setLocalTitle(list.title);
  }, [isPreview, list.id, list.title, titleEditMode]);

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
    setLocalTitle(list.title);
    pendingTitleSelectAllRef.current = true;
    setTitleEditMode(true);
  }, [list.title]);

  const commitTitle = useCallback(() => {
    setTitleEditMode(false);
    const next = localTitle.trim() || "Untitled list";
    setLocalTitle(next);
    const current = list.title.trim() || "Untitled list";
    if (next !== current) {
      onUpdateList(list.id, { title: next });
    }
  }, [list.id, list.title, localTitle, onUpdateList]);

  useLayoutEffect(() => {
    if (!isPreview || !titleEditMode || !pendingTitleSelectAllRef.current) return;
    pendingTitleSelectAllRef.current = false;
    selectAllTitle();
  }, [isPreview, titleEditMode, selectAllTitle]);

  const flatItems = useMemo(() => {
    const withDepth = items as FlatListItem[];
    if (withDepth.length > 0 && "depth" in withDepth[0]) {
      return withDepth;
    }
    return flattenListItems(items);
  }, [items]);

  const openItems = useMemo(
    () => flatItems.filter((i) => !i.completed && !i.pending),
    [flatItems],
  );
  const completedItems = useMemo(
    () => flatItems.filter((i) => i.completed && !i.pending),
    [flatItems],
  );
  const pendingItems = useMemo(
    () => flatItems.filter((i) => i.pending && !i.completed),
    [flatItems],
  );
  const openCount = openItems.length;
  const completedCount = completedItems.length;
  const pendingCount = pendingItems.length;

  const updateMenuPosition = useCallback(() => {
    const anchor = menuRef.current?.getBoundingClientRect();
    const menuEl = menuPanelRef.current;
    if (!anchor || !menuEl) return;

    setMenuThemeVars(readListThemeVarsFromElement(menuRef.current));

    const menuHeight = menuEl.offsetHeight;
    const menuWidth = menuEl.offsetWidth;
    const gap = 4;
    const margin = 8;
    const maxTop = window.innerHeight - menuHeight - margin;

    let top = anchor.bottom + gap;
    if (top > maxTop) {
      top = anchor.top - menuHeight - gap;
    }
    top = Math.max(margin, Math.min(top, maxTop));

    let left = anchor.right - menuWidth;
    left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin));

    setMenuPosition({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPosition(null);
      return;
    }

    updateMenuPosition();
    const frame = requestAnimationFrame(updateMenuPosition);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuOpen, updateMenuPosition, openCount, completedCount]);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      const portal = document.getElementById(`list-card-menu-portal-${list.id}`);
      if (portal?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen, list.id]);

  const previewLimit = isMobile && isPreview ? 5 : LIST_ITEM_PREVIEW_LIMIT;
  const previewItems = useMemo(
    () => (isPreview ? openItems.slice(0, previewLimit) : openItems),
    [isPreview, openItems, previewLimit],
  );
  const hiddenCount = isPreview ? Math.max(0, openItems.length - previewLimit) : 0;
  const detailVisibleItems = useMemo(() => {
    if (showPending) return pendingItems;
    if (!showCompleted) return openItems;
    return flatItems.filter((i) => !i.pending);
  }, [showPending, showCompleted, openItems, pendingItems, flatItems]);
  const detailVisibleItemIds = useMemo(
    () => new Set(detailVisibleItems.map((row) => row.id)),
    [detailVisibleItems],
  );
  const rawItems = useMemo(() => items.map((i) => ({ ...i, parentItemId: i.parentItemId })), [items]);

  const handleItemToggle = useCallback(
    (id: string) => {
      const item = rawItems.find((i) => i.id === id);
      if (!item) return;

      if (item.completed) {
        onToggleItem(id);
        return;
      }

      if (hasIncompleteDescendants(id, rawItems)) {
        setFamilyCompleteConfirm({
          parentItem: item,
          itemsToComplete: getIncompleteSubtreeItems(id, rawItems),
        });
        return;
      }

      onToggleItem(id);
    },
    [onToggleItem, rawItems],
  );

  useEffect(() => {
    setShowCompleted(false);
    setShowPending(false);
    setActiveRowId(null);
  }, [list.id]);

  const didAutoShowBucketsRef = useRef(false);
  useEffect(() => {
    didAutoShowBucketsRef.current = false;
  }, [list.id]);

  // If a list has no open items, auto-show pending or completed so opening
  // doesn't look empty when the board still showed counts/hints.
  useEffect(() => {
    if (!isDetail || didAutoShowBucketsRef.current) return;
    if (openCount > 0) {
      didAutoShowBucketsRef.current = true;
      return;
    }
    if (pendingCount === 0 && completedCount === 0) return;
    didAutoShowBucketsRef.current = true;
    if (pendingCount > 0) {
      setShowPending(true);
      setShowCompleted(false);
    } else {
      setShowCompleted(true);
      setShowPending(false);
    }
  }, [isDetail, list.id, openCount, pendingCount, completedCount]);

  useEffect(() => {
    if (!focusAddItemOnOpen || !isDetail) return;
    const frame = requestAnimationFrame(() => {
      addItemInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusAddItemOnOpen, isDetail, list.id]);

  useEffect(() => {
    if (completedCount === 0 && showCompleted) setShowCompleted(false);
  }, [completedCount, showCompleted]);

  useEffect(() => {
    if (pendingCount === 0 && showPending) setShowPending(false);
  }, [pendingCount, showPending]);

  const handleToggleCompleted = useCallback(() => {
    setShowPending(false);
    setShowCompleted((value) => !value);
  }, []);

  const handleTogglePending = useCallback(() => {
    setShowCompleted(false);
    setShowPending((value) => !value);
  }, []);

  const handleParkItemPending = useCallback(
    (id: string) => {
      onSetListItemPending(id, true);
    },
    [onSetListItemPending],
  );

  useEffect(() => {
    if (!isDetail || !activeRowId) return;
    const frame = requestAnimationFrame(() => {
      const row = itemsStackRef.current?.querySelector<HTMLElement>(
        `[data-list-item-id="${activeRowId}"]`,
      );
      row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeRowId, detailVisibleItems, isDetail, rawItems]);

  useEffect(() => {
    if (!isDetail) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (itemsStackRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".list-item-actions-menu, .list-item-move-menu")) {
        return;
      }
      setActiveRowId(null);
      setOpenActionsMenuItemId(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isDetail]);

  const handleAddItem = async ({ refocusComposer = false }: { refocusComposer?: boolean } = {}) => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    await onAddItem(list.id, trimmed);
    setNewItemText("");
    if (refocusComposer) {
      requestAnimationFrame(() => {
        addItemInputRef.current?.focus();
      });
    }
  };

  const insertBelowInFlightRef = useRef(false);

  const handleInsertBelow = async (afterItemId: string) => {
    if (insertBelowInFlightRef.current) return;
    insertBelowInFlightRef.current = true;
    try {
      const result = await onAddItem(list.id, "", { afterItemId });
      const newId =
        typeof result === "string"
          ? result
          : result && typeof result === "object" && "id" in result
            ? String((result as { id: string }).id)
            : null;
      if (newId) {
        setActiveRowId(newId);
        setFocusItemId(newId);
      }
    } finally {
      // Keep the lock through the focus handoff so rapid Enter can't stack blanks.
      requestAnimationFrame(() => {
        insertBelowInFlightRef.current = false;
      });
    }
  };

  useEffect(() => {
    if (!focusItemId) return;
    const id = focusItemId;
    setFocusItemId(null);
    let attempts = 0;
    const tryFocus = () => {
      const el = itemInputRefs.current.get(id);
      if (el) {
        el.focus();
        return;
      }
      if (attempts++ < 8) {
        requestAnimationFrame(tryFocus);
      }
    };
    requestAnimationFrame(tryFocus);
  }, [focusItemId, items]);

  const familyChromeByItemId = useMemo(
    () => getFamilyChromeByItemId(detailVisibleItems),
    [detailVisibleItems],
  );

  const addItemInput = (
    <input
      ref={addItemInputRef}
      value={newItemText}
      onChange={(e) => setNewItemText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void handleAddItem({ refocusComposer: true });
        }
      }}
      onBlur={() => {
        if (newItemText.trim()) void handleAddItem();
      }}
      placeholder="New item"
      enterKeyHint="next"
      className={cn(
        "list-add-item-input min-w-0 flex-1 border-0 bg-transparent outline-none",
        isDetail ? "text-base" : "text-sm",
      )}
      aria-label="New item"
    />
  );

  const addItemRow = isDetail ? (
    <div
      className={cn(
        "list-add-item-row shrink-0",
        isDetail ? "list-add-item-row--mobile-top pb-2.5 pt-1" : "list-add-item-row--top pb-2 pt-1",
      )}
    >
      <div className="list-add-item-composer">
        <span className="list-add-item-icon" aria-hidden="true">
          <Plus className="h-4 w-4 stroke-[2.5]" />
        </span>
        {addItemInput}
      </div>
    </div>
  ) : null;

  const handleNudgeItem = useCallback(
    (itemId: string, direction: "up" | "down") => {
      setActiveRowId(itemId);
      onNudgeListItem?.(list.id, itemId, direction, detailVisibleItemIds);
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
        triggerHaptic("light");
      }
    },
    [detailVisibleItemIds, list.id, onNudgeListItem],
  );

  const handleMoveItemToList = useCallback(
    (itemId: string, targetListId: string) => {
      onMoveItemToList?.(itemId, targetListId);
      setActiveRowId(null);
      setOpenActionsMenuItemId(null);
    },
    [onMoveItemToList],
  );

  const renderEditableItem = (
    item: FlatListItem,
    completedSection = false,
    pendingSection = false,
    options?: {
      familyChrome?: ListItemFamilyChrome;
    },
  ) => {
    const chrome = options?.familyChrome ?? familyChromeByItemId.get(item.id);
    const nudgeTargets = isDetail
      ? getFlatListNudgeTargets(rawItems, item.id, detailVisibleItemIds)
      : null;

    return (
      <ListItemRow
        key={item.id}
        item={item}
        depth={item.depth}
        onToggle={handleItemToggle}
        onDelete={onDeleteItem}
        onTextChange={onUpdateItem}
        onIndent={onIndentItem}
        onOutdent={onOutdentItem}
        canIndent={canIndentListItem(item.id, rawItems)}
        canOutdent={canOutdentListItem(item.id, rawItems)}
        showReorderNudges={isDetail && !!onNudgeListItem}
        canMoveUp={nudgeTargets?.canMoveUp ?? false}
        canMoveDown={nudgeTargets?.canMoveDown ?? false}
        onMoveUp={(id) => handleNudgeItem(id, "up")}
        onMoveDown={(id) => handleNudgeItem(id, "down")}
        insertBelowOnEnter={isDetail && !completedSection && !pendingSection}
        onInsertBelow={(id) => {
          void handleInsertBelow(id);
        }}
        registerInputRef={(el) => {
          if (el) itemInputRefs.current.set(item.id, el);
          else itemInputRefs.current.delete(item.id);
        }}
        completedSection={completedSection}
        pendingSection={pendingSection}
        onSetPending={handleParkItemPending}
        showEditPencil={mobileDetail}
        clickTitleToEdit={isDetail && !isMobile}
        rowSelectionMode={isDetail}
        isRowActive={isDetail && activeRowId === item.id}
        onRowActivate={isDetail ? setActiveRowId : undefined}
        moveTargetLists={isDetail ? moveTargetLists : undefined}
        onMoveToList={isDetail ? handleMoveItemToList : undefined}
        actionsMenuOpen={isDetail && openActionsMenuItemId === item.id}
        onActionsMenuOpenChange={
          isDetail
            ? (open) => {
                setOpenActionsMenuItemId(open ? item.id : null);
                if (open) setActiveRowId(item.id);
              }
            : undefined
        }
        familyChrome={chrome}
        syncPending={
          pendingListItemIds.has(item.id) ||
          pendingListItemIds.has(item.id.replace(/^li-/, ""))
        }
      />
    );
  };

  const renderItemFamilies = (
    items: FlatListItem[],
    renderRow: (item: FlatListItem, familyRootId: string) => React.ReactNode,
    hoverFamilyRootId?: string,
  ) =>
    groupFlatListItemsIntoFamilies(items).map((family) => {
      const isMultiFamily = family.items.length > 1;
      const isDropTarget = !!hoverFamilyRootId && family.rootId === hoverFamilyRootId;

      return (
        <ListItemFamilyGroup
          key={family.rootId}
          familyId={family.rootId}
          solo={!isMultiFamily}
          isDropTarget={isDropTarget}
        >
          {family.items.map((item) => renderRow(item, family.rootId))}
        </ListItemFamilyGroup>
      );
    });

  const editableItemsList = (
    <div ref={itemsStackRef} className="list-items-stack">
      {detailVisibleItems.map((item) => {
        const chrome = familyChromeByItemId.get(item.id);

        return renderEditableItem(
          item,
          showCompleted && item.completed,
          showPending && item.pending,
          { familyChrome: chrome },
        );
      })}
    </div>
  );

  const previewItemsList = (
    <div className="list-items-stack">
      {renderItemFamilies(previewItems, (item) => (
        <ListItemRow
          key={item.id}
          item={item}
          depth={item.depth}
          readOnly
          onToggle={handleItemToggle}
          onDelete={onDeleteItem}
          onTextChange={onUpdateItem}
          onSetPending={handleParkItemPending}
          inFamily
          nestedInFamily={item.depth > 0}
          syncPending={
            pendingListItemIds.has(item.id) ||
            pendingListItemIds.has(item.id.replace(/^li-/, ""))
          }
        />
      ))}
      {hiddenCount > 0 && (
        <div className="list-card-more-hint px-1 pt-1.5">
          +{hiddenCount} more — open list
        </div>
      )}
      {completedCount > 0 && openCount === 0 && pendingCount === 0 && (
        <div className="list-card-more-hint px-1 pt-1 text-[11px]">
          {completedCount} completed — open list to review
        </div>
      )}
      {pendingCount > 0 && openCount === 0 && (
        <div className="list-card-more-hint px-1 pt-1 text-[11px]">
          {pendingCount} pending — open list to review
        </div>
      )}
    </div>
  );

  const detailColorVars = listColorStyle
    ? ({
        background: listColorStyle.bg,
        ...listColorPresentationStyleVars(listColorStyle),
      } satisfies React.CSSProperties)
    : undefined;

  if (isDetail) {
    return (
      <>
        <div
          className={cn(
            "list-detail-body flex min-h-0 flex-1 flex-col overflow-hidden",
            "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]",
            isDetail ? "pb-0 px-3 pt-1" : "px-4 pb-4 pt-2",
          )}
          style={detailColorVars}
        >
          {(completedCount > 0 || pendingCount > 0) && (
            <div
              className={cn(
                "list-detail-toolbar shrink-0 flex pb-2",
                mobileDetail
                  ? "list-detail-toolbar--mobile flex-col gap-1.5"
                  : "flex-wrap items-center gap-2",
                isDetail ? "pt-0.5" : "pt-0",
              )}
            >
              {(!showPending && completedCount > 0) ||
              (!showCompleted && pendingCount > 0) ? (
                <div
                  className={cn(
                    "list-detail-toolbar-filters flex min-w-0 items-stretch",
                    mobileDetail
                      ? "list-detail-toolbar-filters--compact w-full flex-nowrap gap-0.5"
                      : "flex-wrap gap-2",
                  )}
                >
                  {!showPending && completedCount > 0 ? (
                    <ListShowCompletedToggle
                      completedCount={completedCount}
                      showCompleted={showCompleted}
                      onToggle={handleToggleCompleted}
                      compact={mobileDetail}
                    />
                  ) : null}
                  {!showCompleted && pendingCount > 0 ? (
                    <ListShowPendingToggle
                      pendingCount={pendingCount}
                      showPending={showPending}
                      onToggle={handleTogglePending}
                      compact={mobileDetail}
                    />
                  ) : null}
                </div>
              ) : null}
              {showCompleted || showPending ? (
                <div
                  className={cn(
                    "list-detail-toolbar-actions flex flex-wrap items-center gap-2",
                    mobileDetail && "w-full",
                  )}
                >
                  {showCompleted ? (
                    <button
                      type="button"
                      className="list-clear-completed-btn"
                      onClick={() => setClearCompletedConfirmOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>
                        {mobileDetail ? "Delete completed" : "Delete all completed"}
                      </span>
                    </button>
                  ) : null}
                  {showPending ? (
                    <>
                      <button
                        type="button"
                        className="list-restore-pending-btn"
                        onClick={() => {
                          void onRestorePending(list.id);
                          setShowPending(false);
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>Restore pending</span>
                      </button>
                      <button
                        type="button"
                        className="list-clear-pending-btn"
                        onClick={() => setClearPendingConfirmOpen(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>
                          {mobileDetail ? "Delete pending" : "Delete all pending"}
                        </span>
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
          {addItemRow}
          <div
            ref={listScrollRef}
            className={cn(
              "list-detail-scroll min-h-0 flex-1 overflow-y-auto",
              mobileDetail ? "list-detail-scroll--mobile-sheet" : "overscroll-contain",
            )}
          >
            {editableItemsList}
          </div>
        </div>

        {familyCompleteConfirm ? (
          <ListFamilyCompleteConfirmModal
            open
            onOpenChange={(open) => {
              if (!open) setFamilyCompleteConfirm(null);
            }}
            parentItem={familyCompleteConfirm.parentItem}
            itemsToComplete={familyCompleteConfirm.itemsToComplete}
            onConfirm={() => onCompleteItemFamily(familyCompleteConfirm.parentItem.id)}
          />
        ) : null}

        <ConfirmationModal
          open={clearCompletedConfirmOpen}
          onOpenChange={setClearCompletedConfirmOpen}
          title="Delete all completed items?"
          description={`This will permanently remove ${completedCount} completed item${completedCount === 1 ? "" : "s"} from this list. This action cannot be undone.`}
          highlight={list.title.trim() || "Untitled list"}
          confirmText="Delete all completed"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={() => {
            onClearCompleted(list.id);
            setShowCompleted(false);
            setClearCompletedConfirmOpen(false);
          }}
        />

        <ConfirmationModal
          open={clearPendingConfirmOpen}
          onOpenChange={setClearPendingConfirmOpen}
          title="Delete all pending items?"
          description={`This will permanently remove ${pendingCount} pending item${pendingCount === 1 ? "" : "s"} from this list. This action cannot be undone.`}
          highlight={list.title.trim() || "Untitled list"}
          confirmText="Delete all pending"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={() => {
            onClearPending(list.id);
            setShowPending(false);
            setClearPendingConfirmOpen(false);
          }}
        />
      </>
    );
  }

  const itemsPanel = previewItemsList;
  const displayTitle = list.title.trim() || "Untitled list";

  const tryOpenDetail = (e: React.MouseEvent) => {
    if (!onOpenDetail) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, [data-no-open]")) return;
    onOpenDetail();
  };

  const titlePanel = (
    <>
      {list.isShared ? (
        <SharedListBadge
          sourceWorkspaceName={list.sourceWorkspaceName}
          sharedByName={list.sharedByName}
        />
      ) : null}
      {list.pinned && !list.isShared ? (
        <div className="list-header-badge list-card-pinned-badge mb-1">Pinned</div>
      ) : null}
      <span className="list-card-title-row flex min-w-0 w-full items-start gap-2">
        {titleEditMode ? (
          <span
            className="list-header-title-field min-w-0 flex-1"
            data-no-open
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={titleInputRef}
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
              className="list-header-title list-card-title w-full min-w-0 bg-transparent font-semibold outline-none tracking-tight"
              placeholder="Title"
              aria-label="List title"
            />
          </span>
        ) : (
          <span className="list-header-title list-card-title min-w-0 flex-1 tracking-tight">
            {displayTitle}
          </span>
        )}
        {openCount > 0 ? (
          <span
            className="list-card-title-count shrink-0 tabular-nums"
            aria-label={`${openCount} open item${openCount === 1 ? "" : "s"}`}
          >
            {openCount}
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <>
      <div className="list-header-band list-card-header-band shrink-0">
        <header className="list-card-header flex items-stretch gap-2 px-4 pt-4 pb-2.5">
          {onOpenDetail && !titleEditMode ? (
            <button
              type="button"
              className="list-card-header-open-target -my-1 min-w-0 flex-1 cursor-pointer rounded-lg border-0 bg-transparent px-1 py-1 text-left transition"
              onClick={onOpenDetail}
              aria-label={`Open ${displayTitle}`}
            >
              {titlePanel}
            </button>
          ) : (
            <div className="min-w-0 flex-1">{titlePanel}</div>
          )}
          <div
            className={cn("list-card-menu-anchor shrink-0 self-center", menuOpen && "is-open")}
            data-no-open
            onClick={(e) => e.stopPropagation()}
            ref={menuRef}
          >
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="list-item-menu-trigger list-card-menu-trigger"
              aria-label="List options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="list-item-menu-trigger-icon" strokeWidth={2.25} aria-hidden />
            </button>
            {menuOpen &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  id={`list-card-menu-portal-${list.id}`}
                  ref={menuPanelRef}
                  className="list-card-menu list-item-actions-menu fixed z-[320]"
                  style={
                    menuPosition
                      ? { top: menuPosition.top, left: menuPosition.left, width: 216, ...menuThemeVars }
                      : { top: -9999, left: -9999, visibility: "hidden", width: 216, ...menuThemeVars }
                  }
                  role="menu"
                  aria-label="List options"
                >
                  {onNudgeList ? (
                    <div className="list-item-actions-menu-section">
                      <div className="list-item-actions-menu-grid">
                        <button
                          type="button"
                          role="menuitem"
                          className="list-item-actions-menu-btn"
                          disabled={!canNudgeListUp}
                          onClick={() => {
                            onNudgeList(list.id, "up");
                            setMenuOpen(false);
                          }}
                        >
                          <ChevronUp className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                          <span>Move up</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="list-item-actions-menu-btn"
                          disabled={!canNudgeListDown}
                          onClick={() => {
                            onNudgeList(list.id, "down");
                            setMenuOpen(false);
                          }}
                        >
                          <ChevronDown className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                          <span>Move down</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="list-item-actions-menu-section">
                    {!list.isShared ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="list-item-actions-menu-row"
                      onClick={() => {
                        setMenuOpen(false);
                        enterTitleEdit();
                      }}
                    >
                      <span className="list-item-actions-menu-row-leading">
                        <PenLine className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                        <span>Edit name</span>
                      </span>
                    </button>
                    ) : null}
                    {canShareList && onShareList && !list.isShared && !list.archived ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="list-item-actions-menu-row"
                        onClick={() => {
                          setMenuOpen(false);
                          onShareList();
                        }}
                      >
                        <span className="list-item-actions-menu-row-leading">
                          <Share2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                          <span>Share list</span>
                        </span>
                      </button>
                    ) : null}
                    {!list.archived && !list.isShared ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="list-item-actions-menu-row"
                        onClick={() => {
                          onTogglePinned(list.id);
                          setMenuOpen(false);
                        }}
                      >
                        <span className="list-item-actions-menu-row-leading">
                          {list.pinned ? (
                            <PinOff className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                          ) : (
                            <Pin className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                          )}
                          <span>{list.pinned ? "Unpin" : "Pin to top"}</span>
                        </span>
                      </button>
                    ) : null}
                    {onArchiveList && !list.archived && !list.isShared ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="list-item-actions-menu-row"
                        onClick={() => {
                          onArchiveList(list.id);
                          setMenuOpen(false);
                        }}
                      >
                        <span className="list-item-actions-menu-row-leading">
                          <Archive className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                          <span>Archive list</span>
                        </span>
                      </button>
                    ) : null}
                    {onUnarchiveList && list.archived ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="list-item-actions-menu-row"
                        onClick={() => {
                          onUnarchiveList(list.id);
                          setMenuOpen(false);
                        }}
                      >
                        <span className="list-item-actions-menu-row-leading">
                          <ArchiveRestore className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                          <span>Restore list</span>
                        </span>
                      </button>
                    ) : null}
                  </div>
                  <div className="list-item-actions-menu-section">
                    <div
                      className="list-card-menu-colors"
                      role="group"
                      aria-label="List color"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {listColors.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          title={c.label}
                          aria-label={c.label}
                          aria-pressed={list.color === c.id}
                          className={cn("list-color-dot", list.color === c.id && "is-active")}
                          style={{
                            background: c.bg,
                            borderColor: list.color === c.id ? activeColorRing : c.border,
                          }}
                          onClick={() => {
                            onUpdateList(list.id, { color: c.id as ListColorId });
                            setMenuOpen(false);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {completedCount > 0 ? (
                    <div className="list-item-actions-menu-section">
                      <button
                        type="button"
                        role="menuitem"
                        className="list-item-actions-menu-row"
                        onClick={() => {
                          onClearCompleted(list.id);
                          setMenuOpen(false);
                        }}
                      >
                        <span className="list-item-actions-menu-row-leading">
                          <Trash2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                          <span>Delete completed</span>
                        </span>
                      </button>
                    </div>
                  ) : null}
                  {!list.isShared ? (
                  <div className="list-item-actions-menu-section list-item-actions-menu-section--footer">
                    <button
                      type="button"
                      role="menuitem"
                      className="list-item-actions-menu-row list-item-actions-menu-row--danger"
                      onClick={() => {
                        setMenuOpen(false);
                        setDeleteConfirmOpen(true);
                      }}
                    >
                      <span className="list-item-actions-menu-row-leading">
                        <Trash2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                        <span>Delete list</span>
                      </span>
                    </button>
                  </div>
                  ) : null}
                </div>,
                document.body,
              )}
          </div>
        </header>
      </div>

      <div
        className={cn(
          "list-card-body px-4 pb-3.5 flex-1 min-h-0",
          onOpenDetail && "list-card-open-target cursor-pointer",
        )}
        onClick={tryOpenDetail}
      >
        {itemsPanel}
      </div>

      <ConfirmationModal
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete list?"
        description="This list and all its items will be permanently removed."
        highlight={displayTitle}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={() => onDeleteList(list.id)}
      />

      {familyCompleteConfirm ? (
        <ListFamilyCompleteConfirmModal
          open
          onOpenChange={(open) => {
            if (!open) setFamilyCompleteConfirm(null);
          }}
          parentItem={familyCompleteConfirm.parentItem}
          itemsToComplete={familyCompleteConfirm.itemsToComplete}
          onConfirm={() => onCompleteItemFamily(familyCompleteConfirm.parentItem.id)}
        />
      ) : null}
    </>
  );
}

interface ListCardProps {
  list: WorkspaceList;
  items: ListItem[];
  onOpenDetail?: () => void;
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
  onNudgeListItem?: (
    listId: string,
    itemId: string,
    direction: "up" | "down",
    visibleItemIds: ReadonlySet<string>,
  ) => void;
  onMoveItemToList?: (itemId: string, targetListId: string) => void;
  moveTargetLists?: ListItemMoveTarget[];
  onClearCompleted: (listId: string) => void;
  onSetListItemPending: (id: string, pending: boolean) => void;
  onRestorePending: (listId: string) => void;
  onClearPending: (listId: string) => void;
  onArchiveList?: (id: string) => void;
  onUnarchiveList?: (id: string) => void;
  onNudgeList?: (listId: string, direction: "up" | "down") => void;
  canNudgeListUp?: boolean;
  canNudgeListDown?: boolean;
  isHighlighted?: boolean;
  canShareList?: boolean;
  onShareList?: () => void;
}

export function ListCard({
  list,
  items,
  onOpenDetail,
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
  moveTargetLists,
  onClearCompleted,
  onSetListItemPending,
  onRestorePending,
  onClearPending,
  onArchiveList,
  onUnarchiveList,
  onNudgeList,
  canNudgeListUp = false,
  canNudgeListDown = false,
  isHighlighted = false,
  canShareList = false,
  onShareList,
}: ListCardProps) {
  const theme = useTaskStore((s) => s.theme);
  const presentation = getListColorPresentation(list.color, theme, { opaque: true });

  return (
    <article
      data-list-id={list.id}
      data-list-color={list.color}
      className={cn("list-card list-card--premium flex flex-col", isHighlighted && "is-highlighted")}
      style={{
        background: presentation.bg,
        borderColor: presentation.border,
        ...listColorPresentationStyleVars(presentation),
      }}
    >
      <ListCardBody
        list={list}
        items={items}
        variant="preview"
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
        onArchiveList={onArchiveList}
        onUnarchiveList={onUnarchiveList}
        onNudgeList={onNudgeList}
        canNudgeListUp={canNudgeListUp}
        canNudgeListDown={canNudgeListDown}
        onOpenDetail={onOpenDetail}
        canShareList={canShareList}
        onShareList={onShareList}
      />
    </article>
  );
}

