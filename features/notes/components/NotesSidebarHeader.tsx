"use client";

import React from "react";
import { ListChecks, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotesSidebarHeaderProps {
  showOpenTasksOnly: boolean;
  onToggleOpenTasksOnly: () => void;
  hasOverdueOpenTaskNotes: boolean;
  openTasksNoteCount: number;
  onCreateNote: () => void;
  isCreating: boolean;
}

export function NotesSidebarHeader({
  showOpenTasksOnly,
  onToggleOpenTasksOnly,
  hasOverdueOpenTaskNotes,
  openTasksNoteCount,
  onCreateNote,
  isCreating,
}: NotesSidebarHeaderProps) {
  return (
    <div className="border-b border-white/10">
      <div className="notes-sidebar-toolbar px-3 pt-3 pb-3">
        <button
          type="button"
          onClick={onToggleOpenTasksOnly}
          className={cn(
            "notes-sidebar-action-btn notes-open-tasks-filter touch-manipulation",
            showOpenTasksOnly && "is-active",
            hasOverdueOpenTaskNotes && "has-overdue",
          )}
          aria-pressed={showOpenTasksOnly}
          title={
            showOpenTasksOnly
              ? "Show all notes"
              : hasOverdueOpenTaskNotes
                ? `Show notes with open linked tasks (${openTasksNoteCount}) — some are overdue`
                : `Show only notes with open linked tasks (${openTasksNoteCount})`
          }
        >
          <ListChecks className="h-3.5 w-3.5 shrink-0" />
          <span>Open tasks</span>
          {openTasksNoteCount > 0 && (
            <span
              className={cn(
                "tabular-nums shrink-0",
                hasOverdueOpenTaskNotes ? "text-[#ff3366]" : "opacity-80",
              )}
            >
              {openTasksNoteCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onCreateNote}
          disabled={isCreating}
          className="notes-sidebar-action-btn notes-new-btn btn btn-primary disabled:opacity-50 touch-manipulation"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          New
        </button>
      </div>
    </div>
  );
}