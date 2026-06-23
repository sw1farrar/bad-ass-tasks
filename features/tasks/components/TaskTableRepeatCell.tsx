"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Repeat } from "lucide-react";
import { cn, getRecurringLabel } from "@/lib/utils";
import { isClickInsideTaskTablePopover } from "@/lib/dom/taskTablePopoverDismiss";
import { useAnchoredPopoverPosition } from "@/lib/hooks/useAnchoredPopoverPosition";
import { useTaskStore } from "@/store/useTaskStore";
import type { Task } from "@/types";
import { TaskRecurrencePickerContent } from "./TaskRecurrencePickerContent";

interface TaskTableRepeatCellProps {
  task: Task;
  disabled?: boolean;
}

export function TaskTableRepeatCell({ task, disabled = false }: TaskTableRepeatCellProps) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const popoverPosition = useAnchoredPopoverPosition({
    open,
    anchorRef: triggerRef,
    panelRef,
    estimatedWidth: 360,
    estimatedHeight: 640,
    horizontalAlign: "auto",
    boundaryMode: "viewport",
    sizeMode: "content",
  });

  const label = task.recurringRule ? getRecurringLabel(task.recurringRule) : undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      if (isClickInsideTaskTablePopover(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown, true);
    };
  }, [open]);

  const popover =
    open && mounted && popoverPosition ? (
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Repeat schedule"
        className="tasks-repeat-popover tasks-table-popover tasks-anchor-popover fixed w-[min(360px,calc(100vw-16px))] rounded-xl border border-border-glass bg-bg-panel shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        data-popover-placement={popoverPosition.placement}
        style={{
          top: popoverPosition.top,
          left: popoverPosition.left,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <TaskRecurrencePickerContent
          task={task}
          disabled={disabled}
          variant="popover"
          onSave={(updates) => void updateTask(task.id, updates)}
        />
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={cn(
          "tasks-repeat-inline-trigger flex w-full max-w-full min-h-[28px] items-start gap-1 rounded-md border px-2 py-1 text-left text-[11px] font-medium leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple/40 disabled:opacity-50 disabled:pointer-events-none",
          label
            ? "tasks-table-repeat border-neon-purple/25 bg-neon-purple/10 text-neon-purple hover:border-neon-purple/40 hover:bg-neon-purple/15"
            : "border-transparent text-text-muted hover:bg-surface-hover hover:text-text-secondary",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label ? `Repeat: ${label}. Click to change.` : "Set repeat schedule"}
        title={label}
      >
        <Repeat className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span className="tasks-table-repeat__label min-w-0 flex-1">{label ?? "—"}</span>
      </button>
      {popover && typeof document !== "undefined"
        ? createPortal(popover, document.body)
        : null}
    </>
  );
}
