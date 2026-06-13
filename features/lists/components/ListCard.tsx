"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { sortableTranslateOnly } from "../lib/sortableTransform";
import { GripVertical, MoreHorizontal, PenLine, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListItem, WorkspaceList } from "@/types";
import type { FlatListItem } from "@/lib/lists/listItemTree";
import { triggerHaptic } from "@/lib/utils";
import {
  LIST_ITEM_PREVIEW_LIMIT,
  canIndentListItem,
  canOutdentListItem,
  flattenListItems,
} from "@/lib/lists/listItemTree";
import {
  getListColorPresentation,
  getListColorsForTheme,
  type ListColorPresentation,
} from "@/lib/lists/listColorStyles";
import type { ListColorId } from "@/store/listSlice";
import { useTaskStore } from "@/store/useTaskStore";
import type { OnAddListItem } from "@/lib/lists/addListItem";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useListDndSensors } from "../dndConfig";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { ListItemRow } from "./ListItemRow";
import { ListShowCompletedToggle } from "./ListShowCompletedToggle";

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
  onUpdateItem: (id: string, text: string) => void;
  onDeleteItem: (id: string) => void;
  onReorderItems: (listId: string, activeId: string, overId: string) => void;
  onIndentItem: (id: string) => void;
  onOutdentItem: (id: string) => void;
  onClearCompleted: (listId: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  dragHandleRef?: React.Ref<HTMLButtonElement>;
  onOpenDetail?: () => void;
  listColorStyle?: ListColorPresentation;
  focusAddItemOnOpen?: boolean;
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
  onUpdateItem,
  onDeleteItem,
  onReorderItems,
  onIndentItem,
  onOutdentItem,
  onClearCompleted,
  dragHandleProps,
  dragHandleRef,
  onOpenDetail,
  listColorStyle,
  focusAddItemOnOpen = false,
}: ListCardBodyProps) {
  const theme = useTaskStore((s) => s.theme);
  const listColors = getListColorsForTheme(theme);
  const activeColorRing = theme === "light" ? "#7c3aed" : "#f4f4f5";
  const [newItemText, setNewItemText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const addItemInputRef = useRef<HTMLInputElement>(null);
  const itemInputRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const isMobile = useIsMobileViewport();
  const isPreview = variant === "preview";
  const isDetail = variant === "detail";
  const mobileDetail = isDetail && isMobile;

  const flatItems = useMemo(() => {
    const withDepth = items as FlatListItem[];
    if (withDepth.length > 0 && "depth" in withDepth[0]) {
      return withDepth;
    }
    return flattenListItems(items);
  }, [items]);

  const openItems = useMemo(() => flatItems.filter((i) => !i.completed), [flatItems]);
  const completedItems = useMemo(() => flatItems.filter((i) => i.completed), [flatItems]);
  const openCount = openItems.length;
  const completedCount = completedItems.length;

  const updateMenuPosition = useCallback(() => {
    const anchor = menuRef.current?.getBoundingClientRect();
    const menuEl = menuPanelRef.current;
    if (!anchor || !menuEl) return;

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
    if (!showCompleted) return openItems;
    return flatItems;
  }, [showCompleted, openItems, flatItems]);
  const visibleItems = isPreview ? previewItems : detailVisibleItems;
  const itemIds = useMemo(() => visibleItems.map((i) => i.id), [visibleItems]);
  const rawItems = useMemo(() => items.map((i) => ({ ...i, parentItemId: i.parentItemId })), [items]);

  useEffect(() => {
    setShowCompleted(false);
    setActiveRowId(null);
  }, [list.id]);

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

  const sensors = useListDndSensors();
  const activeItem = useMemo(
    () => (activeItemId ? visibleItems.find((i) => i.id === activeItemId) : undefined),
    [activeItemId, visibleItems],
  );

  const handleAddItem = async () => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    const result = await onAddItem(list.id, trimmed);
    setNewItemText("");
    const newId = typeof result === "string" ? result : null;
    if (newId) setFocusItemId(newId);
  };

  const handleInsertBelow = async (afterItemId: string) => {
    const result = await onAddItem(list.id, "", { afterItemId });
    const newId = typeof result === "string" ? result : null;
    if (newId) setFocusItemId(newId);
  };

  useEffect(() => {
    if (!focusItemId) return;
    const id = focusItemId;
    setFocusItemId(null);
    requestAnimationFrame(() => {
      itemInputRefs.current.get(id)?.focus();
    });
  }, [focusItemId, items]);

  const handleItemDragStart = (event: DragStartEvent) => {
    setActiveItemId(String(event.active.id));
  };

  const handleItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItemId(null);
    if (!over || active.id === over.id) return;
    onReorderItems(list.id, String(active.id), String(over.id));
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      triggerHaptic("light");
    }
  };

  const handleItemDragCancel = (_event: DragCancelEvent) => {
    setActiveItemId(null);
  };

  const addItemInput = (
    <input
      ref={addItemInputRef}
      value={newItemText}
      onChange={(e) => setNewItemText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void handleAddItem();
        }
      }}
      onBlur={() => {
        if (!mobileDetail && newItemText.trim()) void handleAddItem();
      }}
      placeholder="New item"
      enterKeyHint="done"
      className={cn(
        "list-add-item-input min-w-0 flex-1 border-0 bg-transparent text-text-primary placeholder:text-text-muted outline-none",
        mobileDetail ? "text-base" : "text-sm",
      )}
      aria-label="New item"
    />
  );

  const addItemRow = isDetail ? (
    <div
      className={cn(
        "list-add-item-row shrink-0",
        mobileDetail ? "list-add-item-row--mobile-top pb-2.5 pt-1" : "list-add-item-row--top pb-2 pt-1",
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

  const itemCollisionDetection: CollisionDetection = (args) => {
    const within = pointerWithin(args);
    if (within.length > 0) return within;
    return closestCenter(args);
  };

  const renderEditableItem = (item: FlatListItem, completedSection = false) => (
    <ListItemRow
      key={item.id}
      item={item}
      depth={item.depth}
      onToggle={onToggleItem}
      onDelete={onDeleteItem}
      onTextChange={onUpdateItem}
      onIndent={onIndentItem}
      onOutdent={onOutdentItem}
      canIndent={canIndentListItem(item.id, rawItems)}
      canOutdent={canOutdentListItem(item.id, rawItems)}
      insertBelowOnEnter={mobileDetail}
      onInsertBelow={(id) => {
        void handleInsertBelow(id);
      }}
      registerInputRef={(el) => {
        if (el) itemInputRefs.current.set(item.id, el);
        else itemInputRefs.current.delete(item.id);
      }}
      completedSection={completedSection}
      showEditPencil={mobileDetail}
      isRowActive={mobileDetail && activeRowId === item.id}
      onRowActivate={mobileDetail ? setActiveRowId : undefined}
    />
  );

  const editableItemsList = (
    <DndContext
      sensors={sensors}
      collisionDetection={isDetail ? itemCollisionDetection : closestCenter}
      onDragStart={handleItemDragStart}
      onDragEnd={handleItemDragEnd}
      onDragCancel={handleItemDragCancel}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="list-items-stack space-y-0.5">
          {detailVisibleItems.map((item) =>
            renderEditableItem(item, showCompleted && item.completed),
          )}
        </div>
      </SortableContext>
      <DragOverlay adjustScale={false} dropAnimation={null}>
        {activeItem ? (
          <div className="list-item-drag-overlay">
            <ListItemRow
              item={activeItem}
              depth={activeItem.depth}
              onToggle={onToggleItem}
              onDelete={onDeleteItem}
              onTextChange={onUpdateItem}
              sortable={false}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );

  const previewItemsList = (
    <div className="list-items-stack space-y-0.5">
      {previewItems.map((item) => (
        <ListItemRow
          key={item.id}
          item={item}
          depth={item.depth}
          readOnly
          onToggle={onToggleItem}
          onDelete={onDeleteItem}
          onTextChange={onUpdateItem}
        />
      ))}
      {hiddenCount > 0 && (
        <div className="list-card-more-hint px-1 pt-1.5">
          +{hiddenCount} more — open list
        </div>
      )}
      {completedCount > 0 && openCount === 0 && (
        <div className="list-card-more-hint px-1 pt-1 text-[11px] text-text-secondary">
          {completedCount} completed — open list to review
        </div>
      )}
    </div>
  );

  const detailColorVars = listColorStyle
    ? ({
        background: listColorStyle.bg,
        ["--list-bg" as string]: listColorStyle.bg,
        ["--list-border" as string]: listColorStyle.border,
        ["--list-chip-bg" as string]: listColorStyle.bg,
        ["--list-chip-border" as string]: listColorStyle.border,
        ["--list-title-color" as string]: listColorStyle.titleColor,
        ["--list-meta-color" as string]: listColorStyle.metaColor,
        ["--list-item-text-color" as string]: listColorStyle.itemTextColor,
        ["--list-check-border" as string]: listColorStyle.checkBorder,
      } satisfies React.CSSProperties)
    : undefined;

  if (isDetail) {
    return (
      <div
        className={cn(
          "list-detail-body flex min-h-0 flex-1 flex-col overflow-hidden",
          "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]",
          mobileDetail ? "pb-0 px-3 pt-1" : "px-4 pb-4 pt-2",
        )}
        style={detailColorVars}
      >
        {completedCount > 0 && (
          <div
            className={cn(
              "list-detail-toolbar shrink-0 flex items-center pb-2",
              mobileDetail ? "pt-0.5" : "pt-0",
            )}
          >
            <ListShowCompletedToggle
              completedCount={completedCount}
              showCompleted={showCompleted}
              onToggle={() => setShowCompleted((value) => !value)}
            />
          </div>
        )}
        {addItemRow}
        <div className="list-detail-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {editableItemsList}
        </div>
      </div>
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
      {list.pinned && (
        <div className="list-header-badge list-card-pinned-badge mb-1">Pinned</div>
      )}
      <span className="list-header-title list-card-title block w-full tracking-tight">
        {displayTitle}
      </span>
      {(openCount > 0 || completedCount > 0) && (
        <div className="list-header-meta list-card-stats mt-1.5 font-medium">
          {openCount > 0
            ? `${openCount} open${completedCount > 0 ? ` · ${completedCount} done` : ""}`
            : `${completedCount} done`}
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="list-header-band list-card-header-band shrink-0">
        <header className="list-card-header flex items-stretch gap-2.5 px-4 pt-4 pb-2.5">
          <button
            type="button"
            ref={dragHandleRef}
            className="list-header-btn list-card-drag-handle shrink-0 self-center cursor-grab active:cursor-grabbing touch-none rounded-lg p-1.5 transition"
            aria-label="Drag list"
            data-no-open
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          {onOpenDetail ? (
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
            className="relative shrink-0 self-center"
            ref={menuRef}
            data-no-open
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="list-header-btn rounded-lg p-1.5 transition"
              aria-label="List options"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          {menuOpen &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                id={`list-card-menu-portal-${list.id}`}
                ref={menuPanelRef}
                className="list-card-menu fixed z-[320] min-w-[10.5rem] rounded-xl border border-border-glass bg-bg-card py-1 text-xs shadow-xl"
                style={
                  menuPosition
                    ? { top: menuPosition.top, left: menuPosition.left }
                    : { top: -9999, left: -9999, visibility: "hidden" }
                }
                role="menu"
                aria-label="List options"
              >
                {onOpenDetail && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenDetail();
                    }}
                  >
                    <PenLine className="h-3.5 w-3.5" />
                    Edit name
                  </button>
                )}
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
                {completedCount > 0 && (
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
                    setMenuOpen(false);
                    setDeleteConfirmOpen(true);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete list
                </button>
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
  onUpdateItem: (id: string, text: string) => void;
  onDeleteItem: (id: string) => void;
  onReorderItems: (listId: string, activeId: string, overId: string) => void;
  onIndentItem: (id: string) => void;
  onOutdentItem: (id: string) => void;
  onClearCompleted: (listId: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  dragHandleRef?: React.Ref<HTMLButtonElement>;
  isHighlighted?: boolean;
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
  onUpdateItem,
  onDeleteItem,
  onReorderItems,
  onIndentItem,
  onOutdentItem,
  onClearCompleted,
  dragHandleProps,
  dragHandleRef,
  isHighlighted = false,
}: ListCardProps) {
  const theme = useTaskStore((s) => s.theme);
  const presentation = getListColorPresentation(list.color, theme);

  return (
    <article
      data-list-id={list.id}
      data-list-color={list.color}
      className={cn("list-card list-card--premium flex flex-col", isHighlighted && "is-highlighted")}
      style={{
        background: presentation.bg,
        borderColor: presentation.border,
        ["--list-bg" as string]: presentation.bg,
        ["--list-border" as string]: presentation.border,
        ["--list-chip-bg" as string]: presentation.bg,
        ["--list-chip-border" as string]: presentation.border,
        ["--list-title-color" as string]: presentation.titleColor,
        ["--list-meta-color" as string]: presentation.metaColor,
        ["--list-item-text-color" as string]: presentation.itemTextColor,
        ["--list-check-border" as string]: presentation.checkBorder,
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
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
        onReorderItems={onReorderItems}
        onIndentItem={onIndentItem}
        onOutdentItem={onOutdentItem}
        onClearCompleted={onClearCompleted}
        dragHandleProps={dragHandleProps}
        dragHandleRef={dragHandleRef}
        onOpenDetail={onOpenDetail}
      />
    </article>
  );
}

export type ListDragSlotSize = { width: number; height: number };

type ListCardLayoutMode = "stack" | "grid";

interface SortableListCardProps extends Omit<ListCardProps, "dragHandleProps" | "dragHandleRef"> {
  id: string;
  layoutMode?: ListCardLayoutMode;
  dragSlotSize?: ListDragSlotSize | null;
}

export function SortableListCard(props: SortableListCardProps) {
  const { dragSlotSize, layoutMode = "grid", ...cardProps } = props;
  const isStackLayout = layoutMode === "stack";
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isSorting,
    isOver,
    overIndex,
    index,
  } = useSortable({
    id: props.id,
    animateLayoutChanges: () => false,
    transition: null,
  });

  const isDropSlot = isDragging && overIndex >= 0 && overIndex !== index;

  const style: React.CSSProperties = {
    transform: isStackLayout ? CSS.Translate.toString(transform) : sortableTranslateOnly(transform),
    transition: isStackLayout || isDragging ? undefined : transition,
    ...(isDragging && dragSlotSize
      ? {
          width: dragSlotSize.width,
          minWidth: dragSlotSize.width,
          maxWidth: dragSlotSize.width,
          minHeight: dragSlotSize.height,
          height: dragSlotSize.height,
        }
      : null),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "sortable-list-card",
        isSorting && "is-sorting",
        isDragging && "is-dragging-source",
        isDropSlot && "is-drop-slot",
        isOver && !isDragging && isSorting && "is-drop-target",
      )}
    >
      <ListCard
        {...cardProps}
        dragHandleRef={setActivatorNodeRef}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}