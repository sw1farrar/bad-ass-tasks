"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { sortableTranslateOnly } from "../lib/sortableTransform";
import { GripVertical, MoreHorizontal, Pin, PinOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListItem, WorkspaceList } from "@/types";
import type { FlatListItem } from "@/lib/lists/listItemTree";
import { triggerHaptic } from "@/lib/utils";
import {
  LIST_ITEM_PREVIEW_LIMIT,
  flattenListItems,
} from "@/lib/lists/listItemTree";
import {
  getListColorStyleForTheme,
  getListColorsForTheme,
} from "@/lib/lists/listColorStyles";
import type { ListColorId } from "@/store/listSlice";
import { useTaskStore } from "@/store/useTaskStore";
import type { OnAddListItem } from "@/lib/lists/addListItem";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useListDndSensors } from "../dndConfig";
import { ListItemRow } from "./ListItemRow";

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
  onOpenDetail?: (e: React.MouseEvent) => void;
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
}: ListCardBodyProps) {
  const theme = useTaskStore((s) => s.theme);
  const listColors = getListColorsForTheme(theme);
  const activeColorRing = theme === "light" ? "#7c3aed" : "#f4f4f5";
  const [newItemText, setNewItemText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemInputRefs = useRef(new Map<string, HTMLInputElement>());
  const isMobile = useIsMobileViewport();
  const isPreview = variant === "preview";
  const isDetail = variant === "detail";
  const mobileDetail = isDetail && isMobile;

  useEffect(() => {
    if (!menuOpen && !colorOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setColorOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen, colorOpen]);

  const flatItems = useMemo(() => {
    const withDepth = items as FlatListItem[];
    if (withDepth.length > 0 && "depth" in withDepth[0]) {
      return withDepth;
    }
    return flattenListItems(items);
  }, [items]);

  const visibleItems = isPreview
    ? flatItems.slice(0, LIST_ITEM_PREVIEW_LIMIT)
    : flatItems;
  const hiddenCount = isPreview ? Math.max(0, flatItems.length - LIST_ITEM_PREVIEW_LIMIT) : 0;
  const openCount = flatItems.filter((i) => !i.completed).length;
  const completedCount = flatItems.length - openCount;
  const itemIds = useMemo(() => visibleItems.map((i) => i.id), [visibleItems]);
  const rawItems = useMemo(() => items.map((i) => ({ ...i, parentItemId: i.parentItemId })), [items]);

  const sensors = useListDndSensors();
  const activeItem = useMemo(
    () => (activeItemId ? visibleItems.find((i) => i.id === activeItemId) : undefined),
    [activeItemId, visibleItems],
  );

  const handleAddItem = async () => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    await onAddItem(list.id, trimmed);
    setNewItemText("");
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

  const addItemRow = isDetail ? (
    <div className={cn("flex items-start gap-2", mobileDetail ? "mb-2" : "mt-2")}>
      <button
        type="button"
        className="list-item-check shrink-0 opacity-40 mt-0.5"
        tabIndex={-1}
        aria-hidden
      />
      <input
        value={newItemText}
        onChange={(e) => setNewItemText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void handleAddItem();
          }
        }}
        onBlur={() => {
          if (newItemText.trim()) void handleAddItem();
        }}
        placeholder="List item"
        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-faint outline-none"
        aria-label="Add list item"
      />
    </div>
  ) : null;

  const itemsPanel = (
    <>
      {mobileDetail && addItemRow}
      {isDetail ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleItemDragStart}
          onDragEnd={handleItemDragEnd}
          onDragCancel={handleItemDragCancel}
        >
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div className="list-items-stack space-y-0.5">
              {visibleItems.map((item) => (
                <ListItemRow
                  key={item.id}
                  item={item}
                  depth={item.depth}
                  onToggle={onToggleItem}
                  onDelete={onDeleteItem}
                  onTextChange={onUpdateItem}
                  onIndent={onIndentItem}
                  onOutdent={onOutdentItem}
                  insertBelowOnEnter={mobileDetail}
                  onInsertBelow={(id) => {
                    void handleInsertBelow(id);
                  }}
                  registerInputRef={(el) => {
                    if (el) itemInputRefs.current.set(item.id, el);
                    else itemInputRefs.current.delete(item.id);
                  }}
                />
              ))}
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
      ) : (
        <div className="list-items-stack space-y-0.5">
          {visibleItems.map((item) => (
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
            <div className="list-card-more-hint px-1 pt-1 text-[11px] text-text-secondary">
              +{hiddenCount} more — open list
            </div>
          )}
        </div>
      )}

      {isDetail && !mobileDetail && addItemRow}
    </>
  );

  if (isDetail) {
    return (
      <div className="list-detail-body flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{itemsPanel}</div>
      </div>
    );
  }

  return (
    <>
      <header className="list-card-header flex items-start gap-2.5 px-4 pt-4 pb-2.5">
        <button
          type="button"
          ref={dragHandleRef}
          className="list-card-drag-handle mt-1 shrink-0 text-text-muted hover:text-neon-purple cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag list"
          data-no-open
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          {list.pinned && <div className="list-card-pinned-badge mb-1">Pinned</div>}
          <input
            value={list.title}
            onChange={(e) => onUpdateList(list.id, { title: e.target.value })}
            onBlur={(e) => {
              const trimmed = e.target.value.trim();
              onUpdateList(list.id, { title: trimmed || "Untitled list" });
            }}
            className="w-full bg-transparent text-base font-semibold text-text-primary outline-none placeholder:text-text-muted tracking-tight"
            placeholder="Title"
            aria-label="List title"
          />
          {flatItems.length > 0 && (
            <div className="list-card-stats text-[11px] text-text-muted mt-1.5 font-medium">
              {openCount} open{completedCount > 0 ? ` · ${completedCount} done` : ""}
            </div>
          )}
        </div>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              setMenuOpen((v) => !v);
              setColorOpen(false);
            }}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover"
            aria-label="List options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 min-w-[10rem] rounded-xl border border-border-glass bg-bg-card shadow-xl py-1 text-xs">
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-surface-hover flex items-center gap-2"
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
                onClick={() => {
                  setColorOpen((v) => !v);
                }}
              >
                Change color
              </button>
              {completedCount > 0 && (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-surface-hover text-text-secondary"
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
                className="w-full px-3 py-2 text-left hover:bg-surface-hover text-[var(--priority-p0)] flex items-center gap-2"
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
            <div className="absolute right-0 top-full mt-1 z-30 flex gap-1.5 p-2 rounded-xl border border-border-glass bg-bg-card shadow-xl">
              {listColors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  className={cn("list-color-dot", list.color === c.id && "is-active")}
                  style={{ background: c.bg, borderColor: list.color === c.id ? activeColorRing : c.border }}
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

      <div
        className={cn(
          "list-card-body px-4 pb-3.5 flex-1 min-h-0",
          onOpenDetail && "list-card-open-target cursor-pointer",
        )}
        onClick={onOpenDetail}
        role={onOpenDetail ? "button" : undefined}
        tabIndex={onOpenDetail ? 0 : undefined}
        onKeyDown={
          onOpenDetail
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenDetail(e as unknown as React.MouseEvent);
                }
              }
            : undefined
        }
      >
        {itemsPanel}
      </div>
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
  const colorStyle = getListColorStyleForTheme(list.color, theme);

  const handleOpenDetail = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a, [data-no-open]")) return;
    onOpenDetail?.();
  };

  return (
    <article
      data-list-id={list.id}
      data-list-color={list.color}
      className={cn("list-card flex flex-col", isHighlighted && "is-highlighted")}
      style={{
        background: colorStyle.bg,
        borderColor: colorStyle.border,
        ["--list-bg" as string]: colorStyle.bg,
        ["--list-border" as string]: colorStyle.border,
        ["--list-chip-bg" as string]: colorStyle.bg,
        ["--list-chip-border" as string]: colorStyle.border,
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
        onOpenDetail={onOpenDetail ? handleOpenDetail : undefined}
      />
    </article>
  );
}

export type ListDragSlotSize = { width: number; height: number };

interface SortableListCardProps extends Omit<ListCardProps, "dragHandleProps" | "dragHandleRef"> {
  id: string;
  dragSlotSize?: ListDragSlotSize | null;
}

export function SortableListCard(props: SortableListCardProps) {
  const { dragSlotSize, ...cardProps } = props;
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
    transition: {
      duration: 200,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    },
  });

  const isDropSlot = isDragging && overIndex >= 0 && overIndex !== index;

  const style: React.CSSProperties = {
    transform: sortableTranslateOnly(transform),
    transition: isDragging || isSorting ? undefined : transition,
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