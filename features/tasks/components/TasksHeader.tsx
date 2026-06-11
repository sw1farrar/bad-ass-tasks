"use client";

import React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TasksHeaderProps {
  filteredTaskCount: number;
  openTaskCount: number;
  kanbanView: "list" | "board";
  onViewChange: (view: "list" | "board") => void;
  onNaturalAdd: () => void;
}

/**
 * TasksHeader
 *
 * Extracted from the monolithic app/page.tsx as part of M0 architecture resumption (Batch 2.4).
 *
 * This is the first slice of the Tasks view: title, counts, view toggles (List/Board),
 * and the "Natural add" button.
 *
 * Guard note (M0 safety): All store access, filteredTasks derivation, search/filter logic,
 * renderTaskRow, KanbanBoard, and any demo/live guards remain in the parent (app/page.tsx).
 * This component receives only pre-computed props.
 *
 * Future batches can expand this area or extract the search bar + semantic results as a sibling component.
 */
export function TasksHeader({
  filteredTaskCount,
  openTaskCount,
  kanbanView,
  onViewChange,
  onNaturalAdd,
}: TasksHeaderProps) {
  return (
    <div className="tasks-header flex items-center justify-between mb-3 md:mb-6">
      <div>
        <div className="text-2xl md:text-3xl font-semibold tracking-tight">Tasks</div>
        <div className="text-text-muted text-xs md:text-sm mt-0.5">
          {filteredTaskCount} tasks • {openTaskCount} open
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onViewChange("list")}
          className={cn(
            "px-3 py-1 text-xs md:text-sm md:px-4 md:py-1.5 rounded-full transition",
            kanbanView === "list" ? "tasks-header__view-btn tasks-header__view-btn--active bg-surface-hover" : "tasks-header__view-btn hover:bg-surface-hover"
          )}
        >
          List
        </button>
        <button
          onClick={() => onViewChange("board")}
          className={cn(
            "px-3 py-1 text-xs md:text-sm md:px-4 md:py-1.5 rounded-full transition",
            kanbanView === "board" ? "tasks-header__view-btn tasks-header__view-btn--active bg-surface-hover" : "tasks-header__view-btn hover:bg-surface-hover"
          )}
        >
          Board
        </button>
        <button
          onClick={onNaturalAdd}
          className="btn btn-secondary ml-1 text-xs md:text-sm px-3 md:px-4 py-1 md:py-2"
        >
          <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Natural</span> add
        </button>
      </div>
    </div>
  );
}
