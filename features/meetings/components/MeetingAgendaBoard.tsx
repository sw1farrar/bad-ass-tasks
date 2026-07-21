"use client";

import React, { useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { MeetingAgendaEntry, MeetingAgendaItem, WorkspaceMember } from "@/types";
import { isAgendaItemReviewed } from "@/lib/meetings/agendaReviewed";
import { sortAgendaItems } from "@/lib/meetings/meetingFilters";
import { MeetingAgendaTile } from "./MeetingAgendaTile";

interface MeetingAgendaBoardProps {
  items: MeetingAgendaItem[];
  entries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  currentUserId?: string;
  readOnly?: boolean;
  onSelect: (id: string) => void;
  /** Add a topic. Pass openInModal: false for Quick Add (no topic modal). */
  onAdd: (title?: string, options?: { openInModal?: boolean }) => void;
  onReorder: (orderedIds: string[]) => void;
  onCompleteItem: (id: string) => void;
  onContinueItem: (id: string) => void;
  onUnreviewItem: (id: string) => void;
  onReopenItem: (id: string) => void;
}

function entryCountForItem(
  itemId: string,
  entries: MeetingAgendaEntry[],
): number {
  return entries.filter((e) => e.agendaItemId === itemId).length;
}

function swapColumnNeighbors(
  sorted: MeetingAgendaItem[],
  columnItems: MeetingAgendaItem[],
  indexInColumn: number,
  direction: "up" | "down",
): string[] | null {
  const nextIndex = direction === "up" ? indexInColumn - 1 : indexInColumn + 1;
  if (nextIndex < 0 || nextIndex >= columnItems.length) return null;

  const idA = columnItems[indexInColumn].id;
  const idB = columnItems[nextIndex].id;
  const ordered = sorted.map((item) => item.id);
  const indexA = ordered.indexOf(idA);
  const indexB = ordered.indexOf(idB);
  if (indexA < 0 || indexB < 0) return null;

  [ordered[indexA], ordered[indexB]] = [ordered[indexB], ordered[indexA]];
  return ordered;
}

function buildBoardOrder(
  activeItems: MeetingAgendaItem[],
  reviewedItems: MeetingAgendaItem[],
  completedItems: MeetingAgendaItem[],
): string[] {
  return [
    ...activeItems.map((item) => item.id),
    ...reviewedItems.map((item) => item.id),
    ...completedItems.map((item) => item.id),
  ];
}

export function MeetingAgendaBoard({
  items,
  entries,
  members,
  currentUserId,
  readOnly,
  onSelect,
  onAdd,
  onReorder,
  onCompleteItem,
  onContinueItem,
  onUnreviewItem,
  onReopenItem,
}: MeetingAgendaBoardProps) {
  const quickAddRef = useRef<HTMLInputElement>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  const sorted = useMemo(() => sortAgendaItems(items), [items]);

  const activeItems = useMemo(
    () =>
      sorted.filter(
        (item) => item.status !== "completed" && !isAgendaItemReviewed(item),
      ),
    [sorted],
  );
  const reviewedItems = useMemo(
    () =>
      sorted.filter(
        (item) => item.status !== "completed" && isAgendaItemReviewed(item),
      ),
    [sorted],
  );
  const completedItems = useMemo(
    () => sorted.filter((item) => item.status === "completed"),
    [sorted],
  );

  const moveInGroup = (
    groupItems: MeetingAgendaItem[],
    index: number,
    direction: "up" | "down",
  ) => {
    const ordered = swapColumnNeighbors(sorted, groupItems, index, direction);
    if (ordered) onReorder(ordered);
  };

  const toggleReviewed = (item: MeetingAgendaItem) => {
    if (isAgendaItemReviewed(item)) {
      const nextActive = [...activeItems, item];
      const nextReviewed = reviewedItems.filter((entry) => entry.id !== item.id);
      onReorder(buildBoardOrder(nextActive, nextReviewed, completedItems));
      onUnreviewItem(item.id);
      return;
    }

    const nextActive = activeItems.filter((entry) => entry.id !== item.id);
    const nextReviewed = [...reviewedItems, item];
    onReorder(buildBoardOrder(nextActive, nextReviewed, completedItems));
    onContinueItem(item.id);
  };

  const handleQuickAdd = () => {
    const title = quickAddTitle.trim();
    if (!title || isQuickAdding) return;
    setIsQuickAdding(true);
    setQuickAddTitle("");
    try {
      onAdd(title, { openInModal: false });
    } finally {
      setIsQuickAdding(false);
      requestAnimationFrame(() => {
        quickAddRef.current?.focus();
      });
    }
  };

  const renderTile = (
    item: MeetingAgendaItem,
    index: number,
    group: MeetingAgendaItem[],
  ) => (
    <MeetingAgendaTile
      key={item.id}
      item={item}
      members={members}
      currentUserId={currentUserId}
      entryCount={entryCountForItem(item.id, entries)}
      column="active"
      readOnly={readOnly}
      canMoveUp={index > 0}
      canMoveDown={index < group.length - 1}
      onOpen={() => onSelect(item.id)}
      onMove={() => onCompleteItem(item.id)}
      onToggleReviewed={() => toggleReviewed(item)}
      onMoveUp={() => moveInGroup(group, index, "up")}
      onMoveDown={() => moveInGroup(group, index, "down")}
    />
  );

  return (
    <div className="meeting-agenda-board flex flex-1 min-h-0 min-w-0">
      <section
        className="meeting-agenda-board__column meeting-agenda-board__column--active"
        aria-label="Active agenda items"
      >
        <header className="meeting-agenda-board__header space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <h2 className="meeting-agenda-board__title">Active</h2>
              <span className="meeting-agenda-board__count">
                {activeItems.length + reviewedItems.length}
              </span>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => onAdd(undefined, { openInModal: true })}
                className="inline-flex items-center gap-1.5 shrink-0 rounded-xl border border-neon-purple/30 bg-neon-purple/10 px-3 py-2 text-xs font-semibold text-neon-purple-tint transition hover:bg-neon-purple/15 active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Add Agenda Item
              </button>
            )}
          </div>
          {!readOnly && (
            <input
              ref={quickAddRef}
              type="text"
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleQuickAdd();
                }
              }}
              placeholder="Quick add agenda item…"
              className="w-full rounded-xl border border-border-glass bg-bg px-3 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint"
              aria-label="Quick add agenda item"
            />
          )}
        </header>

        <div className="meeting-agenda-board__list">
          {activeItems.length === 0 && reviewedItems.length === 0 ? (
            <p className="meeting-agenda-board__empty">
              {readOnly ? "No active topics." : "Add a topic to start the agenda."}
            </p>
          ) : (
            <>
              {activeItems.map((item, index) => renderTile(item, index, activeItems))}

              {reviewedItems.length > 0 && (
                <>
                  <div
                    className="meeting-agenda-board__group-label"
                    role="presentation"
                  >
                    Reviewed
                  </div>
                  {reviewedItems.map((item, index) =>
                    renderTile(item, index, reviewedItems),
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>

      <section
        className="meeting-agenda-board__column meeting-agenda-board__column--completed"
        aria-label="Completed agenda items"
      >
        <header className="meeting-agenda-board__header">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="meeting-agenda-board__title">Completed</h2>
            <span className="meeting-agenda-board__count">{completedItems.length}</span>
          </div>
          <p className="meeting-agenda-board__hint">
            Finished in this meeting. Move left to reopen.
          </p>
        </header>

        <div className="meeting-agenda-board__list">
          {completedItems.length === 0 ? (
            <p className="meeting-agenda-board__empty">Nothing completed yet.</p>
          ) : (
            completedItems.map((item) => (
              <MeetingAgendaTile
                key={item.id}
                item={item}
                members={members}
                currentUserId={currentUserId}
                entryCount={entryCountForItem(item.id, entries)}
                column="completed"
                readOnly={readOnly}
                onOpen={() => onSelect(item.id)}
                onMove={() => onReopenItem(item.id)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
