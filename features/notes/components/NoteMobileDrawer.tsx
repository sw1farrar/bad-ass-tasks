"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo, useDragControls } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn, triggerHaptic } from "@/lib/utils";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

const SHEET_SPRING = { type: "spring" as const, damping: 32, stiffness: 380, mass: 0.85 };

interface NoteMobileDrawerProps {
  open: boolean;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
  isSaving?: boolean;
}

export function NoteMobileDrawer({
  open,
  onSave,
  onCancel,
  children,
  isSaving = false,
}: NoteMobileDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragControls = useDragControls();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  useEffect(() => {
    if (open) triggerHaptic("light");
  }, [open]);

  const handleCancel = useCallback(() => {
    triggerHaptic("light");
    onCancel();
  }, [onCancel]);

  const handleSave = useCallback(() => {
    triggerHaptic("light");
    onSave();
  }, [onSave]);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleCancel]);

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 400) {
      handleCancel();
    } else {
      setDragY(0);
    }
  };

  const startSheetDrag = (e: React.PointerEvent) => {
    dragControls.start(e);
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence onExitComplete={() => setDragY(0)}>
      {open && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end">
          <motion.div
            key="note-drawer-backdrop"
            className="absolute inset-0 sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={handleCancel}
            aria-hidden="true"
          />

          <motion.div
            key="note-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Note editor"
            className={cn(
              "notes-drawer-sheet mobile-bottom-sheet relative flex flex-col",
              "h-[92dvh] max-h-[92dvh] rounded-t-3xl max-w-none w-full overflow-hidden",
              "bg-bg border-t border-border-glass shadow-2xl",
            )}
            onClick={(e) => e.stopPropagation()}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 500 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={handleDragEnd}
            onDrag={(_e, info) => setDragY(Math.max(0, info.offset.y))}
            initial={{ y: "100%" }}
            animate={{ y: dragY }}
            exit={{ y: "100%" }}
            transition={SHEET_SPRING}
          >
            <div
              className="sheet-drag-handle shrink-0 touch-none cursor-grab active:cursor-grabbing"
              onPointerDown={startSheetDrag}
              aria-hidden="true"
            />

            <div className="notes-drawer-chrome shrink-0 flex items-center justify-between gap-3 w-full px-4 py-3 border-b border-border-glass">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="text-sm font-medium text-text-secondary hover:text-text-primary min-h-[44px] px-1 disabled:opacity-50 active:scale-[0.98] transition"
                aria-label="Cancel changes"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="btn btn-primary text-sm px-4 py-2 min-h-[44px] disabled:opacity-60 flex items-center gap-1.5 active:scale-[0.98]"
                aria-label="Save and close note"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                Save and Close
              </button>
            </div>

            <div className="notes-drawer-body flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}