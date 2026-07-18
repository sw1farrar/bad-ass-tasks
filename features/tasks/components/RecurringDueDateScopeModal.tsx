"use client";

import React from "react";
import { createPortal } from "react-dom";
import { CalendarClock, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecurringDueDateScope } from "@/features/tasks/lib/recurrenceTaskState";

interface RecurringDueDateScopeModalProps {
  open: boolean;
  taskTitle?: string;
  onChoose: (scope: RecurringDueDateScope) => void;
  onCancel: () => void;
}

export function RecurringDueDateScopeModal({
  open,
  taskTitle,
  onChoose,
  onCancel,
}: RecurringDueDateScopeModalProps) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[900] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 overlay-scrim backdrop-blur-[3px]" onClick={onCancel} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="recurring-due-scope-title"
        className={cn(
          "relative w-full max-w-md bg-bg-panel border border-border-glass modal-panel shadow-2xl",
          "rounded-t-2xl md:rounded-2xl",
          "pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-0",
          "animate-in fade-in slide-in-from-bottom-4 md:zoom-in-95 duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2.5 md:hidden">
          <div className="h-1 w-10 rounded-full bg-border-glass" aria-hidden />
        </div>
        <div className="p-5 pb-4">
          <h3
            id="recurring-due-scope-title"
            className="text-lg font-semibold text-text-primary tracking-tight"
          >
            Reschedule recurring task?
          </h3>
          {taskTitle ? (
            <p className="mt-2 text-sm font-medium text-text-primary truncate">
              &ldquo;{taskTitle}&rdquo;
            </p>
          ) : null}
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            Change only this occurrence, or move the whole series to the new date.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 px-5 pb-5">
          <button
            type="button"
            onClick={() => onChoose("occurrence")}
            className="flex w-full items-start gap-3 rounded-xl border border-border-glass px-4 py-3 text-left hover:bg-surface-hover transition min-h-[44px]"
          >
            <CalendarClock className="h-4 w-4 mt-0.5 shrink-0 text-neon-purple" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-text-primary">This occurrence only</span>
              <span className="block text-xs text-text-muted mt-0.5">
                Moves this date; the series schedule stays the same
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChoose("series")}
            className="flex w-full items-start gap-3 rounded-xl border border-neon-purple/35 bg-neon-purple/10 px-4 py-3 text-left hover:bg-neon-purple/15 transition min-h-[44px]"
          >
            <CalendarRange className="h-4 w-4 mt-0.5 shrink-0 text-neon-purple" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-text-primary">Entire series</span>
              <span className="block text-xs text-text-muted mt-0.5">
                Re-anchors the schedule from the new date
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full min-h-[44px] rounded-xl border border-border-glass px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-hover transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
