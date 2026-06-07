"use client";

import React, { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { areWorkspaceListTablesReady, ensureWorkspaceListPersistenceReady } from "@/lib/data/hybridStore";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { ListChecks, Plus } from "lucide-react";
import { WorkspaceViewHeader } from "@/components/WorkspaceViewHeader";
import type { ListItem, WorkspaceList } from "@/types";
import { ListCard, SortableListCard } from "./components/ListCard";
import "./lists-workspace.css";

interface ListsViewProps {
  workspaceName: string;
  lists: WorkspaceList[];
  getItemsForList: (listId: string) => ListItem[];
  onAddList: (title?: string) => void | Promise<void>;
  onUpdateList: (id: string, updates: Partial<WorkspaceList>) => void;
  onDeleteList: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onAddItem: (listId: string, text: string) => void;
  onToggleItem: (id: string) => void;
  onUpdateItem: (id: string, text: string) => void;
  onDeleteItem: (id: string) => void;
  onReorderLists: (activeId: string, overId: string) => void;
  onReorderItems: (listId: string, activeId: string, overId: string) => void;
  onClearCompleted: (listId: string) => void;
  highlightListId?: string | null;
}

export function ListsView({
  workspaceName,
  lists,
  getItemsForList,
  onAddList,
  onUpdateList,
  onDeleteList,
  onTogglePinned,
  onAddItem,
  onToggleItem,
  onUpdateItem,
  onDeleteItem,
  onReorderLists,
  onReorderItems,
  onClearCompleted,
  highlightListId = null,
}: ListsViewProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [listsDbReady, setListsDbReady] = useState<boolean | null>(null);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [dragOverlayWidth, setDragOverlayWidth] = useState<number | null>(null);
  const [dragSlotHeight, setDragSlotHeight] = useState<number | null>(null);
  const listIds = useMemo(() => lists.map((l) => l.id), [lists]);
  const activeList = useMemo(
    () => (activeListId ? lists.find((l) => l.id === activeListId) : undefined),
    [activeListId, lists],
  );

  useEffect(() => {
    if (!highlightListId) return;
    const timer = window.setTimeout(() => {
      const el = document.querySelector(`[data-list-id="${highlightListId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [highlightListId, lists]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setListsDbReady(null);
      return;
    }
    void ensureWorkspaceListPersistenceReady().then(() => {
      setListsDbReady(areWorkspaceListTablesReady());
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /** 2D grid: pointer hit first, then corner distance for precise cell targeting. */
  const listCollisionDetection: CollisionDetection = (args) => {
    const within = pointerWithin(args);
    if (within.length > 0) return within;
    return closestCorners(args);
  };

  const totalOpen = useMemo(() => {
    return lists.reduce((sum, list) => {
      return sum + getItemsForList(list.id).filter((i) => !i.completed).length;
    }, 0);
  }, [lists, getItemsForList]);

  const handleCreateList = async () => {
    const trimmed = newListTitle.trim();
    await onAddList(trimmed || "Untitled list");
    setNewListTitle("");
    setComposerOpen(false);
  };

  const handleListDragStart = (event: DragStartEvent) => {
    setActiveListId(String(event.active.id));
    const rect = event.active.rect.current.initial ?? event.active.rect.current.translated;
    setDragOverlayWidth(rect?.width ?? null);
    setDragSlotHeight(rect?.height ?? null);
  };

  const handleListDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveListId(null);
    setDragOverlayWidth(null);
    setDragSlotHeight(null);
    if (!over || active.id === over.id) return;
    onReorderLists(String(active.id), String(over.id));
  };

  const handleListDragCancel = () => {
    setActiveListId(null);
    setDragOverlayWidth(null);
    setDragSlotHeight(null);
  };

  return (
    <div className="lists-workspace max-w-[1400px] mx-auto">
      <WorkspaceViewHeader
        variant="inline"
        title="Lists"
        workspaceName={workspaceName}
        icon={<ListChecks className="h-6 w-6" />}
        description={
          lists.length === 0
            ? "Quick checklists for groceries, launches, ideas — drag to reorder anytime."
            : undefined
        }
        meta={
          lists.length > 0
            ? `${lists.length} list${lists.length === 1 ? "" : "s"} · ${totalOpen} open item${totalOpen === 1 ? "" : "s"}`
            : undefined
        }
        className="mb-6"
        actions={
        <button
          type="button"
          onClick={() => {
            setComposerOpen(true);
            setTimeout(() => {
              document.getElementById("list-composer-input")?.focus();
            }, 0);
          }}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-[#c084fc]/40 bg-[#c084fc]/10 px-4 py-2 text-sm font-medium text-[#e4e4e7] hover:bg-[#c084fc]/20 transition"
        >
          <Plus className="h-4 w-4 text-[#c084fc]" />
          New list
        </button>
        }
      />

      {listsDbReady === false && (
        <div className="mb-4 rounded-2xl border border-[#ff9500]/35 bg-[#111114] px-4 py-3 text-sm text-[#a1a1aa]">
          <span className="text-[#ff9500] font-medium">Lists database not set up.</span>{" "}
          Run <code className="text-[#e4e4e7] text-xs">supabase/add-workspace-lists.sql</code> in your
          Supabase SQL Editor, then hard-refresh. Until then, lists are saved in this browser only.
        </div>
      )}

      {(composerOpen || lists.length === 0) && (
        <div className="list-composer mb-6 px-4 py-3">
          <input
            id="list-composer-input"
            value={newListTitle}
            onChange={(e) => setNewListTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreateList();
              }
              if (e.key === "Escape") {
                setComposerOpen(false);
                setNewListTitle("");
              }
            }}
            onBlur={() => {
              if (newListTitle.trim()) void handleCreateList();
              else if (lists.length > 0) setComposerOpen(false);
            }}
            placeholder="Title"
            className="w-full bg-transparent text-[15px] font-medium text-white outline-none placeholder:text-[#52525b]"
            aria-label="New list title"
          />
          <p className="text-[11px] text-[#52525b] mt-2">Press Enter to create · drag cards to reorder</p>
        </div>
      )}

      {lists.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 p-10 text-center">
          <ListChecks className="h-10 w-10 text-[#c084fc]/60 mx-auto mb-3" />
          <div className="text-lg font-medium text-[#f4f4f5]">Your lists live here</div>
          <p className="text-sm text-[#71717a] mt-1 max-w-md mx-auto">
            Add items, check them off, pin important lists, and rearrange the board.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={listCollisionDetection}
          onDragStart={handleListDragStart}
          onDragEnd={handleListDragEnd}
          onDragCancel={handleListDragCancel}
        >
          <SortableContext items={listIds} strategy={rectSortingStrategy}>
            <div className="lists-masonry">
              {lists.map((list) => (
                <SortableListCard
                  key={list.id}
                  id={list.id}
                  dragSlotHeight={activeListId === list.id ? dragSlotHeight : null}
                  list={list}
                  items={getItemsForList(list.id)}
                  onUpdateList={onUpdateList}
                  onDeleteList={onDeleteList}
                  onTogglePinned={onTogglePinned}
                  onAddItem={onAddItem}
                  onToggleItem={onToggleItem}
                  onUpdateItem={onUpdateItem}
                  onDeleteItem={onDeleteItem}
                  onReorderItems={onReorderItems}
                  onClearCompleted={onClearCompleted}
                  isHighlighted={list.id === highlightListId}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay adjustScale={false} dropAnimation={null}>
            {activeList ? (
              <div
                className="list-card-drag-overlay"
                style={dragOverlayWidth ? { width: dragOverlayWidth } : undefined}
              >
                <ListCard
                  list={activeList}
                  items={getItemsForList(activeList.id)}
                  onUpdateList={onUpdateList}
                  onDeleteList={onDeleteList}
                  onTogglePinned={onTogglePinned}
                  onAddItem={onAddItem}
                  onToggleItem={onToggleItem}
                  onUpdateItem={onUpdateItem}
                  onDeleteItem={onDeleteItem}
                  onReorderItems={onReorderItems}
                  onClearCompleted={onClearCompleted}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}