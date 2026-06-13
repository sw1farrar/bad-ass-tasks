"use client";

import React, { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { areWorkspaceListTablesReady, ensureWorkspaceListPersistenceReady } from "@/lib/data/hybridStore";
import { Archive, ArchiveRestore, LayoutGrid, List, ListChecks, Plus } from "lucide-react";
import { WorkspaceViewHeader } from "@/components/WorkspaceViewHeader";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { cn } from "@/lib/utils";
import {
  readListsDesktopLayout,
  writeListsDesktopLayout,
  type ListsDesktopLayout,
} from "./lib/listsDesktopLayout";
import type { OnAddListItem } from "@/lib/lists/addListItem";
import type { ListItem, WorkspaceList } from "@/types";

export type ListDetailOpenOptions = {
  discardIfEmpty?: boolean;
};
import { ListCard } from "./components/ListCard";
import "./lists-workspace.css";

type ListsLibraryView = "active" | "archived";

interface ListsViewProps {
  workspaceName: string;
  lists: WorkspaceList[];
  archivedLists: WorkspaceList[];
  getItemsForList: (listId: string) => ListItem[];
  onAddList: (title?: string) => WorkspaceList | Promise<WorkspaceList | void> | void;
  onUpdateList: (id: string, updates: Partial<WorkspaceList>) => void;
  onDeleteList: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onAddItem: OnAddListItem;
  onToggleItem: (id: string) => void;
  onCompleteItemFamily: (id: string) => void;
  onUpdateItem: (id: string, text: string) => void;
  onDeleteItem: (id: string) => void;
  onNudgeList: (listId: string, direction: "up" | "down") => void;
  onIndentItem: (id: string) => void;
  onOutdentItem: (id: string) => void;
  onClearCompleted: (listId: string) => void;
  onArchiveList: (id: string) => void;
  onUnarchiveList: (id: string) => void;
  highlightListId?: string | null;
  onOpenDetail: (listId: string, options?: ListDetailOpenOptions) => void;
}

export function ListsView({
  workspaceName,
  lists,
  archivedLists,
  getItemsForList,
  onAddList,
  onUpdateList,
  onDeleteList,
  onTogglePinned,
  onAddItem,
  onToggleItem,
  onCompleteItemFamily,
  onUpdateItem,
  onDeleteItem,
  onNudgeList,
  onIndentItem,
  onOutdentItem,
  onClearCompleted,
  onArchiveList,
  onUnarchiveList,
  highlightListId = null,
  onOpenDetail,
}: ListsViewProps) {
  const [libraryView, setLibraryView] = useState<ListsLibraryView>("active");
  const [composerOpen, setComposerOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [listsDbReady, setListsDbReady] = useState<boolean | null>(null);
  const [desktopLayout, setDesktopLayout] = useState<ListsDesktopLayout>("grid");
  const isMobileViewport = useIsMobileViewport();
  const visibleLists = libraryView === "archived" ? archivedLists : lists;
  const isArchivedView = libraryView === "archived";

  useEffect(() => {
    if (!highlightListId) return;
    const timer = window.setTimeout(() => {
      const el = document.querySelector(`[data-list-id="${highlightListId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [highlightListId, visibleLists]);

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

  const handleLayoutChange = (layout: ListsDesktopLayout) => {
    setDesktopLayout(layout);
    writeListsDesktopLayout(layout);
  };

  const totalOpen = useMemo(() => {
    return visibleLists.reduce((sum, list) => {
      return sum + getItemsForList(list.id).filter((i) => !i.completed).length;
    }, 0);
  }, [visibleLists, getItemsForList]);

  const handleCreateList = async () => {
    const trimmed = newListTitle.trim();
    const created = await onAddList(trimmed || "Untitled list");
    setNewListTitle("");
    setComposerOpen(false);
    if (created?.id) {
      onOpenDetail(created.id, { discardIfEmpty: true });
    }
  };

  const openListComposer = () => {
    setComposerOpen(true);
    requestAnimationFrame(() => {
      document.getElementById("list-composer-input")?.focus();
    });
  };

  const showListComposer =
    !isArchivedView &&
    (isMobileViewport ? composerOpen : composerOpen || lists.length === 0);

  const newListButton = (
    <button
      type="button"
      onClick={openListComposer}
      className={cn(
        "lists-new-list-btn btn btn-primary inline-flex items-center transition active:scale-95 shrink-0",
        isMobileViewport
          ? "lists-new-list-btn--toolbar gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold min-h-[2.5rem]"
          : "gap-2 self-start rounded-xl px-4 py-2 text-sm font-medium",
      )}
      aria-label={isMobileViewport ? "Add list" : "New list"}
    >
      <Plus className="h-4 w-4 shrink-0" aria-hidden />
      {isMobileViewport ? "Add list" : "New list"}
    </button>
  );

  const listLayoutButtonClass = (active: boolean) =>
    cn(
      "lists-layout-toggle__btn inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition",
      active && "lists-layout-toggle__btn--active",
    );

  const archiveToggleButtonClass = (active: boolean) =>
    cn(
      "lists-archive-toggle__btn inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition",
      active && "lists-archive-toggle__btn--active",
    );

  const archiveToggle = (
    <button
      type="button"
      onClick={() => setLibraryView((view) => (view === "active" ? "archived" : "active"))}
      className={archiveToggleButtonClass(isArchivedView)}
      aria-pressed={isArchivedView}
      aria-label={isArchivedView ? "Back to active lists" : "View archived lists"}
    >
      {isArchivedView ? (
        <>
          <ArchiveRestore className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Lists
        </>
      ) : (
        <>
          <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Archive
          {archivedLists.length > 0 ? (
            <span className="lists-archive-toggle__count tabular-nums" aria-hidden>
              {archivedLists.length}
            </span>
          ) : null}
        </>
      )}
    </button>
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

  return (
    <div className="lists-workspace w-full max-w-[1400px] mx-auto max-md:max-w-none max-md:mx-0">
      <div className="lists-workspace-header">
      {isMobileViewport ? (
        <h1 className="sr-only">{isArchivedView ? "Archived lists" : "Lists"}</h1>
      ) : (
        <WorkspaceViewHeader
          variant="inline"
          title={isArchivedView ? "Archived lists" : "Lists"}
          workspaceName={workspaceName}
          hideWorkspaceLabelOnMobile
          hideWorkspaceNameOnMobile
          hideMetaOnMobile
          icon={<ListChecks className="h-6 w-6" />}
          description={
            !isArchivedView && lists.length === 0
              ? "Quick checklists for groceries, launches, ideas — use the menu arrows to reorder."
              : isArchivedView
                ? "Restore lists to bring them back to your main board."
                : undefined
          }
          meta={
            visibleLists.length > 0
              ? isArchivedView
                ? `${visibleLists.length} archived list${visibleLists.length === 1 ? "" : "s"}`
                : `${lists.length} list${lists.length === 1 ? "" : "s"} · ${totalOpen} open item${totalOpen === 1 ? "" : "s"}`
              : undefined
          }
          className="mb-0"
          actions={!isArchivedView ? newListButton : undefined}
        />
      )}

      <div
        className={cn("lists-toolbar", isMobileViewport && "lists-toolbar--mobile")}
        aria-label="List view controls"
      >
        <div className="lists-toolbar__start flex items-center gap-2 flex-wrap">
          {layoutToggle}
          {archiveToggle}
        </div>
        {!isArchivedView ? newListButton : null}
      </div>

      {listsDbReady === false && (
        <div className="mb-4 rounded-2xl border border-[var(--priority-p1)]/35 bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
          <span className="text-[var(--priority-p1)] font-medium">Lists database not set up.</span>{" "}
          Run <code className="text-text-primary text-xs">supabase/add-workspace-lists.sql</code> and{" "}
          <code className="text-text-primary text-xs">supabase/add-list-items-nesting.sql</code> in your
          Supabase SQL Editor, then hard-refresh. Until then, lists are saved in this browser only.
        </div>
      )}

      {showListComposer && (
        <div
          className={cn(
            "list-composer px-4 py-3",
            isMobileViewport ? "lists-composer-sheet list-composer--mobile mb-3" : "mb-6",
          )}
        >
          <div
            className={cn(
              "list-composer-body flex items-center gap-2",
              isMobileViewport && "list-composer-field flex-col items-stretch",
            )}
          >
            {isMobileViewport && (
              <div className="list-composer-input-row flex min-h-[3rem] items-center gap-2.5">
                <span className="list-composer-icon" aria-hidden>
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </span>
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
                  placeholder="Title"
                  enterKeyHint="done"
                  className="list-composer-input min-w-0 flex-1 bg-transparent text-base font-medium text-text-primary outline-none placeholder:text-text-faint"
                  aria-label="New list title"
                />
              </div>
            )}
            {!isMobileViewport && (
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
                enterKeyHint="done"
                className="list-composer-input w-full bg-transparent text-[15px] font-medium text-text-primary outline-none placeholder:text-text-faint"
                aria-label="New list title"
              />
            )}
            {isMobileViewport && (
              <button
                type="button"
                onClick={() => void handleCreateList()}
                disabled={!newListTitle.trim()}
                className="list-composer-create-btn btn btn-primary min-h-[44px] rounded-xl px-4 text-sm font-medium disabled:opacity-40"
              >
                Create list
              </button>
            )}
          </div>
          {!isMobileViewport && (
            <p className="text-[11px] text-text-faint mt-2">
              Press Enter to create · use list menu arrows to reorder
            </p>
          )}
        </div>
      )}
      </div>

      {visibleLists.length === 0 && !composerOpen ? (
        <div className="glass rounded-2xl border border-border-glass p-10 text-center">
          {isArchivedView ? (
            <>
              <Archive className="h-10 w-10 text-text-muted/70 mx-auto mb-3" />
              <div className="text-lg font-medium text-text-primary">No archived lists</div>
              <p className="text-sm text-text-muted mt-1 max-w-md mx-auto">
                Archive a list from its options menu to hide it from your main board.
              </p>
            </>
          ) : (
            <>
              <ListChecks className="h-10 w-10 text-neon-purple/60 mx-auto mb-3" />
              <div className="text-lg font-medium text-text-primary">Your lists live here</div>
              <p className="text-sm text-text-muted mt-1 max-w-md mx-auto">
                Add items, check them off, pin important lists, and reorder from the menu.
              </p>
            </>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "lists-board",
            isMobileViewport
              ? "lists-stack lists-stack--mobile"
              : desktopLayout === "stack"
                ? "lists-stack lists-stack--desktop"
                : "lists-masonry",
          )}
        >
          {visibleLists.map((list, index) => (
            <ListCard
              key={list.id}
              list={list}
              items={getItemsForList(list.id)}
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
              onClearCompleted={onClearCompleted}
              onArchiveList={!isArchivedView ? onArchiveList : undefined}
              onUnarchiveList={isArchivedView ? onUnarchiveList : undefined}
              onNudgeList={onNudgeList}
              canNudgeListUp={index > 0}
              canNudgeListDown={index < visibleLists.length - 1}
              onOpenDetail={() => onOpenDetail(list.id)}
              isHighlighted={list.id === highlightListId}
            />
          ))}
        </div>
      )}

    </div>
  );
}