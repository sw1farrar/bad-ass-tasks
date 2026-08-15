"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn, triggerHaptic } from "@/lib/utils";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useMobileSheetDrag } from "@/lib/hooks/useMobileSheetDrag";
import { useVisualViewportInsets } from "@/lib/hooks/useVisualViewportInsets";
import { MOBILE_SHEET_HEIGHT_CLASS } from "@/lib/motion/sheet";
import { isSheetBlankDragTarget } from "@/lib/motion/sheetDragTarget";
import { SheetDragHandle } from "@/components/SheetDragHandle";

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
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) triggerHaptic("light");
  }, [open]);

  const finishCancel = useCallback(() => {
    triggerHaptic("light");
    onCancel();
  }, [onCancel]);

  const {
    sheetY,
    backdropOpacityMotion,
    isDragging,
    requestDismiss,
    animateEnter,
    setDismissTarget,
    resetDrag,
    startDrag,
    attachCaptureDragSurface,
  } = useMobileSheetDrag({
    enabled: open,
    onDismiss: finishCancel,
    dragMode: "handle",
    dragEngine: "manual",
  });

  const handleCancel = useCallback(() => {
    requestDismiss();
  }, [requestDismiss]);

  const handleSave = useCallback(() => {
    triggerHaptic("light");
    onSave();
  }, [onSave]);

  useScrollLock(open);
  useVisualViewportInsets(open);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleCancel]);

  useLayoutEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }
    const height = panelRef.current?.offsetHeight ?? window.innerHeight;
    setDismissTarget(height);
    if (!openedRef.current) {
      openedRef.current = true;
      animateEnter();
    }
  }, [open, animateEnter, setDismissTarget]);

  useLayoutEffect(() => {
    if (!open) return;
    return attachCaptureDragSurface(panelRef.current, {
      getScrollEl: () => scrollRef.current,
      scrollGateSelector: ".notes-drawer-body",
      canStart: isSheetBlankDragTarget,
    });
  }, [attachCaptureDragSurface, open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence onExitComplete={resetDrag}>
      {open && (
        <div className="fixed inset-0 z-[200] flex flex-col">
          <motion.div
            key="note-drawer-backdrop"
            className="absolute inset-0 sheet-backdrop"
            initial={false}
            style={{ opacity: backdropOpacityMotion }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={handleCancel}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            key="note-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Note editor"
            className={cn(
              "notes-drawer-sheet mobile-bottom-sheet keyboard-stable-sheet relative flex flex-col",
              MOBILE_SHEET_HEIGHT_CLASS,
              "rounded-t-3xl max-w-none w-full overflow-hidden",
              "bg-bg border-t border-border-glass shadow-2xl",
              isDragging && "bottom-sheet-panel--dragging",
            )}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0.98 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ y: sheetY }}
          >
            <SheetDragHandle onPointerDown={startDrag} />

            <div
              ref={headerRef}
              className="notes-drawer-chrome shrink-0 flex items-center justify-between gap-3 w-full px-4 py-3 border-b border-border-glass"
            >
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

            <div
              ref={scrollRef}
              className="notes-drawer-body flex-1 min-h-0 overflow-y-auto overscroll-contain"
              style={{
                paddingBottom:
                  "max(1rem, env(safe-area-inset-bottom, 12px), var(--keyboard-inset, 0px))",
              }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
