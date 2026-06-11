"use client";

import React, { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { areWorkspaceListTablesReady, ensureWorkspaceListPersistenceReady } from "@/lib/data/hybridStore";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { LayoutGrid, List, ListChecks, Plus } from "lucide-react";
import { WorkspaceViewHeader } from "@/components/WorkspaceViewHeader";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { cn, triggerHaptic } from "@/lib/utils";
import {
  readListsDesktopLayout,
  writeListsDesktopLayout,
  type ListsDesktopLayout,
} from "./lib/listsDesktopLayout";
import type { OnAddListItem } from "@/lib/lists/addListItem";
import type { ListItem, WorkspaceList } from "@/types";
import { ListCard, SortableListCard, type ListDragSlotSize } from "./components/ListCard";
import { useListDndSensors } from "./dndConfig";
import "./lists-workspace.css";

interface ListsViewProps {
  workspaceName: string;
  lists: WorkspaceList[];
  getItemsForList: (listId: string) => ListItem[];
  onAddList: (title?: string) => void | Promise<void>;
  onUpdateList: (id: string, updates: Partial<WorkspaceList>) => void;
  onDeleteList: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onAddItem: OnAddListItem;
  onToggleItem: (id: string) => void;
  onUpdateItem: (id: string, text: string) => void;
  onDeleteItem: (id: string) => void;
  onReorderLists: (activeId: string, overId: string) => void;
  onReorderItems: (listId: string, activeId: string, overId: string) => void;
  onIndentItem: (id: string) => void;
  onOutdentItem: (id: string) => void;
  onClearCompleted: (listId: string) => void;
  highlightListId?: string | null;
  onOpenDetail: (listId: string) => void;
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
  onIndentItem,
  onOutdentItem,
  onClearCompleted,
  highlightListId = null,
  onOpenDetail,
}: ListsViewProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [listsDbReady, setListsDbReady] = useState<boolean | null>(null);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [dragSlotSize, setDragSlotSize] = useState<ListDragSlotSize | null>(null);
  const [desktopLayout, setDesktopLayout] = useState<ListsDesktopLayout>("grid");
  const isMobileViewport = useIsMobileViewport();
  const sensors = useListDndSensors();
  const listIds = useMemo(() => lists.map((l) => l.id), [lists]);
  const isStackLayout = isMobileViewport || desktopLayout === "stack";
  const listSortStrategy = isStackLayout ? verticalListSortingStrategy : rectSortingStrategy;
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
    setDesktopLayout(readListsDesktopLayout());
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setListsDbReady(null);
      return;
    }
    void ensureWorkspaceListPersistenceReady().then(() => {
      setListsDbReady(areWorkspaceListTablesReady());
    });
  }, []);

  /** Stack: pointer-first for vertical reorder. Grid: pointer hit first, then corners. */
  const listCollisionDetection: CollisionDetection = (args) => {
    const within = pointerWithin(args);
    if (within.length > 0) return within;
    if (isStackLayout) return closestCenter(args);
    return closestCorners(args);
  };

  const handleLayoutChange = (layout: ListsDesktopLayout) => {
    setDesktopLayout(layout);
    writeListsDesktopLayout(layout);
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

  const newListButton = (
    <button
      type="button"
      onClick={() => {
        setComposerOpen(true);
        setTimeout(() => {
          document.getElementById("list-composer-input")?.focus();
        }, 0);
      }}
      className="lists-new-list-btn btn btn-primary inline-flex items-center gap-2 self-start rounded-xl px-4 py-2 text-sm font-medium transition"
    >
      <Plus className="h-4 w-4" aria-hidden />
      New list
    </button>
  );

  const listLayoutButtonClass = (active: boolean) =>
    cn(
      "lists-layout-toggle__btn inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition",
      active && "lists-layout-toggle__btn--active",
    );

  const layoutToggle = !isMobileViewport ? (
    <div
      className="lists-layout-toggle hidden md:inline-flex"
      role="radiogroup"
      aria-label="List layout"
    >
      <button
        type="button"
        role="radio"
        onClick={() => handleLayoutChange("grid")}
        aria-checked={desktopLayout === "grid"}
        className={listLayoutButtonClass(desktopLayout === "grid")}
      >
        <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Grid
      </button>
      <button
        type="button"
        role="radio"
        onClick={() => handleLayoutChange("stack")}
        aria-checked={desktopLayout === "stack"}
        className={listLayoutButtonClass(desktopLayout === "stack")}
      >
        <List className="h-3.5 w-3.5 shrink-0" aria-hidden />
        List
      </button>
    </div>
  ) : null;

  const handleListDragStart = (event: DragStartEvent) => {
    setActiveListId(String(event.active.id));
    const rect = event.active.rect.current.initial ?? event.active.rect.current.translated;
    if (rect) {
      setDragSlotSize({ width: rect.width, height: rect.height });
    } else {
      setDragSlotSize(null);
    }
  };

  const handleListDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveListId(null);
    setDragSlotSize(null);
    if (!over || active.id === over.id) return;
    onReorderLists(String(active.id), String(over.id));
    if (isMobileViewport) triggerHaptic("light");
  };

  const handleListDragCancel = () => {
    setActiveListId(null);
    setDragSlotSize(null);
  };

  return (
    <div className="lists-workspace w-full max-w-[1400px] mx-auto max-md:max-w-none max-md:mx-0">
      <div className="lists-workspace-header">
      <WorkspaceViewHeader
        variant={isMobileViewport ? "inline-centered" : "inline"}
        title="Lists"
        workspaceName={workspaceName}
        hideWorkspaceLabelOnMobile
        hideWorkspaceNameOnMobile
        hideMetaOnMobile
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
        className="mb-0"
        actions={isMobileViewport ? newListButton : undefined}
      />

      {!isMobileViewport && (
        <div className="lists-toolbar" aria-label="List view controls">
          {layoutToggle}
          {newListButton}
        </div>
      )}

      {listsDbReady === false && (
        <div className="mb-4 rounded-2xl border border-[var(--priority-p1)]/35 bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
          <span className="text-[var(--priority-p1)] font-medium">Lists database not set up.</span>{" "}
          Run <code className="text-text-primary text-xs">supabase/add-workspace-lists.sql</code> and{" "}
          <code className="text-text-primary text-xs">supabase/add-list-items-nesting.sql</code> in your
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
            className="w-full bg-transparent text-[15px] font-medium text-text-primary outline-none placeholder:text-text-faint"
            aria-label="New list title"
          />
          <p className="text-[11px] text-text-faint mt-2">Press Enter to create · drag cards to reorder</p>
        </div>
      )}
      </div>

      {lists.length === 0 ? (
        <div className="glass rounded-2xl border border-border-glass p-10 text-center">
          <ListChecks className="h-10 w-10 text-neon-purple/60 mx-auto mb-3" />
          <div className="text-lg font-medium text-text-primary">Your lists live here</div>
          <p className="text-sm text-text-muted mt-1 max-w-md mx-auto">
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
          <SortableContext items={listIds} strategy={listSortStrategy}>
            <div
              className={cn(
                isMobileViewport
                  ? "lists-stack lists-stack--mobile"
                  : desktopLayout === "stack"
                    ? "lists-stack lists-stack--desktop"
                    : "lists-masonry",
                activeListId && "lists-board--dragging",
              )}
            >
              {lists.map((list) => (
                <SortableListCard
                  key={list.id}
                  id={list.id}
                  dragSlotSize={activeListId === list.id ? dragSlotSize : null}
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
                  onIndentItem={onIndentItem}
                  onOutdentItem={onOutdentItem}
                  onClearCompleted={onClearCompleted}
                  onOpenDetail={() => onOpenDetail(list.id)}
                  isHighlighted={list.id === highlightListId}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay adjustScale={false} dropAnimation={null}>
            {activeList ? (
              <div
                className="list-card-drag-overlay"
                style={
                  dragSlotSize
                    ? { width: dragSlotSize.width, height: dragSlotSize.height }
                    : undefined
                }
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
                  onIndentItem={onIndentItem}
                  onOutdentItem={onOutdentItem}
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