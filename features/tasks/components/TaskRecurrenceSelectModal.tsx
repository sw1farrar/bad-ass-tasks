"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BottomSheet } from "@/components/BottomSheet";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";
import { TaskRecurrencePickerContent } from "./TaskRecurrencePickerContent";

interface TaskRecurrenceSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | undefined;
  disabled?: boolean;
  onSave: (updates: Partial<Task>) => void | Promise<void>;
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

  const body = (
    <TaskRecurrencePickerContent
      task={task}
      disabled={disabled}
      onSave={onSave}
      onClose={close}
      variant="modal"
    />
  );

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
