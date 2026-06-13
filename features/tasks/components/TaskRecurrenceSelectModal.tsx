"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Repeat, X } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { DateTimePicker } from "@/components/DateTimePicker";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { toDueDateStorage } from "@/lib/datetime";
import { applyTaskUpdateSideEffects, cn, getRecurringLabel } from "@/lib/utils";
import type { Task } from "@/types";
import { TaskRecurrenceEditor } from "./TaskRecurrenceEditor";

interface TaskRecurrenceSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | undefined;
  disabled?: boolean;
  onSave: (updates: Partial<Task>) => void | Promise<void>;
}

function buildDueDateUpdates(dateStr: string | null | undefined): Partial<Task> {
  if (!dateStr) {
    return { dueDate: undefined, recurringRule: null, exceptionDates: undefined };
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const localDate = new Date(y, m - 1, d);
  return { dueDate: toDueDateStorage(localDate) };
}

function mergeRecurrenceTaskState(current: Task, updates: Partial<Task>): Task {
  const normalized = applyTaskUpdateSideEffects(updates);
  if (
    Object.prototype.hasOwnProperty.call(normalized, "recurringRule") &&
    (normalized.recurringRule === null || normalized.recurringRule === undefined)
  ) {
    normalized.recurringRule = null;
    if (!Object.prototype.hasOwnProperty.call(normalized, "exceptionDates")) {
      normalized.exceptionDates = undefined;
    }
  }
  const next = { ...current, ...normalized };
  if (
    Object.prototype.hasOwnProperty.call(normalized, "dueDate") &&
    (normalized.dueDate === undefined || normalized.dueDate === null)
  ) {
    delete next.dueDate;
  }
  if (normalized.recurringRule === null) {
    delete next.recurringRule;
    if (normalized.exceptionDates === undefined) {
      delete next.exceptionDates;
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(normalized, "completedAt") &&
    (normalized.completedAt === undefined || normalized.completedAt === null)
  ) {
    delete next.completedAt;
  }
  return next;
}

function SelectBody({
  task,
  disabled,
  onSave,
  onClose,
}: {
  task: Task;
  disabled?: boolean;
  onSave: (updates: Partial<Task>) => void | Promise<void>;
  onClose: () => void;
}) {
  const [localTask, setLocalTask] = useState(task);

  useEffect(() => {
    setLocalTask(task);
  }, [task.id, task.dueDate, task.recurringRule, task.exceptionDates]);

  const save = (updates: Partial<Task>) => {
    if (disabled) return;
    const next = mergeRecurrenceTaskState(localTask, updates);
    setLocalTask(next);
    void onSave(updates);
  };

  const recurringLabel = getRecurringLabel(localTask.recurringRule);

  return (
    <div className="task-recurrence-select__body space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-text-primary tracking-tight flex items-center gap-2">
            <Repeat className="h-4 w-4 text-neon-purple shrink-0" aria-hidden />
            Repeat
          </h3>
          <p className="mt-1 text-sm text-text-secondary leading-relaxed truncate" title={task.title}>
            {task.title}
          </p>
          {recurringLabel ? (
            <p className="mt-1 text-xs font-medium text-neon-purple">{recurringLabel}</p>
          ) : (
            <p className="mt-1 text-xs text-text-muted">No repeat schedule</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted hover:text-text-primary min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-surface-hover transition shrink-0"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <DateTimePicker
        label="Due date"
        value={localTask.dueDate}
        onChange={(dateStr) => save(buildDueDateUpdates(dateStr))}
        className="w-full"
      />

      {!localTask.dueDate ? (
        <p className="text-xs text-text-secondary rounded-xl border border-dashed border-border-glass px-3 py-2.5">
          Set a due date above to enable recurring rules.
        </p>
      ) : (
        <TaskRecurrenceEditor localTask={localTask} save={save} />
      )}
    </div>
  );
}

export function TaskRecurrenceSelectModal({
  open,
  onOpenChange,
  task,
  disabled = false,
  onSave,
}: TaskRecurrenceSelectModalProps) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobileViewport();

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useScrollLock(open && !isMobile);

  useEffect(() => {
    if (!open || isMobile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, isMobile]);

  if (!open || !mounted || !task) return null;

  const body = <SelectBody task={task} disabled={disabled} onSave={onSave} onClose={close} />;

  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onClose={close}
        title="Repeat"
        zIndex={850}
        panelClassName="task-recurrence-select-modal"
        showClose={false}
        showDragHandle
        enableDragDismiss
        dragMode="handle"
        ariaLabel="Repeat schedule"
      >
        {body}
      </BottomSheet>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[850] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 overlay-scrim backdrop-blur-[3px]"
        onClick={close}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Repeat schedule"
        className={cn(
          "task-recurrence-select-modal relative w-full md:max-w-lg bg-bg-panel border border-border-glass modal-panel shadow-2xl rounded-2xl max-h-[min(90dvh,720px)] overflow-y-auto",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {body}
      </div>
    </div>,
    document.body,
  );
}