"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Pin, PinOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListItem, WorkspaceList } from "@/types";
import { getListColorStyle, LIST_COLORS, type ListColorId } from "@/store/listSlice";
import { ListItemRow } from "./ListItemRow";

interface ListCardProps {
  list: WorkspaceList;
  items: ListItem[];
  onUpdateList: (id: string, updates: Partial<WorkspaceList>) => void;
  onDeleteList: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onAddItem: (listId: string, text: string) => void;
  onToggleItem: (id: string) => void;
  onUpdateItem: (id: string, text: string) => void;
  onDeleteItem: (id: string) => void;
  onReorderItems: (listId: string, activeId: string, overId: string) => void;
  onClearCompleted: (listId: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isHighlighted?: boolean;
}

export function ListCard({
  list,
  items,
  onUpdateList,
  onDeleteList,
  onTogglePinned,
  onAddItem,
  onToggleItem,
  onUpdateItem,
  onDeleteItem,
  onReorderItems,
  onClearCompleted,
  dragHandleProps,
  isHighlighted = false,
}: ListCardProps) {
  const [newItemText, setNewItemText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
  const colorStyle = getListColorStyle(list.color);
  const openCount = items.filter((i) => !i.completed).length;
  const completedCount = items.length - openCount;
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleAddItem = () => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    onAddItem(list.id, trimmed);
    setNewItemText("");
  };

  const handleItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorderItems(list.id, String(active.id), String(over.id));
  };

  return (
    <article
      data-list-id={list.id}
      className={cn("list-card flex flex-col", isHighlighted && "is-highlighted")}
      style={{
        background: colorStyle.bg,
        borderColor: colorStyle.border,
        ["--list-bg" as string]: colorStyle.bg,
        ["--list-border" as string]: colorStyle.border,
      }}
    >
      <header className="flex items-start gap-2 px-3.5 pt-3.5 pb-2">
        <button
          type="button"
          className="mt-1 shrink-0 text-[#71717a] hover:text-[#c084fc] cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag list"
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
            className="w-full bg-transparent text-[15px] font-semibold text-white outline-none placeholder:text-[#71717a]"
            placeholder="Title"
            aria-label="List title"
          />
          {items.length > 0 && (
            <div className="text-[10px] text-[#71717a] mt-1">
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
            className="p-1.5 rounded-lg text-[#71717a] hover:text-white hover:bg-white/10"
            aria-label="List options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 min-w-[10rem] rounded-xl border border-white/10 bg-[#141418] shadow-xl py-1 text-xs">
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-white/5 flex items-center gap-2"
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
                className="w-full px-3 py-2 text-left hover:bg-white/5"
                onClick={() => {
                  setColorOpen((v) => !v);
                }}
              >
                Change color
              </button>
              {completedCount > 0 && (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-white/5 text-[#a1a1aa]"
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
                className="w-full px-3 py-2 text-left hover:bg-white/5 text-[#ff3366] flex items-center gap-2"
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
            <div className="absolute right-0 top-full mt-1 z-30 flex gap-1.5 p-2 rounded-xl border border-white/10 bg-[#141418] shadow-xl">
              {LIST_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  className={cn("list-color-dot", list.color === c.id && "is-active")}
                  style={{ background: c.bg, borderColor: list.color === c.id ? "#f4f4f5" : c.border }}
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

      <div className="px-3 pb-2 flex-1 min-h-0">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {items.map((item) => (
                <ListItemRow
                  key={item.id}
                  item={item}
                  onToggle={onToggleItem}
                  onDelete={onDeleteItem}
                  onTextChange={onUpdateItem}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="mt-2 flex items-start gap-2">
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
                handleAddItem();
              }
            }}
            onBlur={() => {
              if (newItemText.trim()) handleAddItem();
            }}
            placeholder="List item"
            className="flex-1 bg-transparent text-sm text-[#e4e4e7] placeholder:text-[#52525b] outline-none"
            aria-label="Add list item"
          />
        </div>
      </div>
    </article>
  );
}

interface SortableListCardProps extends Omit<ListCardProps, "dragHandleProps"> {
  id: string;
  /** Locked height of the dragged card so the drop slot keeps stable dimensions. */
  dragSlotHeight?: number | null;
}

export function SortableListCard(props: SortableListCardProps) {
  const { dragSlotHeight, ...cardProps } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
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
    // DragOverlay mode: dnd-kit translates the source wrapper to the drop cell.
    // Translate only — scale from rectSortingStrategy warps variable-height masonry cards.
    transform: transform
      ? isDragging
        ? CSS.Translate.toString(transform)
        : CSS.Transform.toString(transform)
      : undefined,
    transition: isDragging || isSorting ? undefined : transition,
    ...(isDragging && dragSlotHeight ? { minHeight: dragSlotHeight } : null),
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
      <ListCard {...cardProps} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}