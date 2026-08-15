"use client";

import React, { useCallback, useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMobileSheetDrag } from "@/lib/hooks/useMobileSheetDrag";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useVisualViewportInsets } from "@/lib/hooks/useVisualViewportInsets";
import { MOBILE_SHEET_HEIGHT_CLASS, SHEET_SPRING } from "@/lib/motion/sheet";
import { isSheetBlankDragTarget } from "@/lib/motion/sheetDragTarget";
import { SheetDragHandle } from "@/components/SheetDragHandle";

export interface MobileDrawerShellProps {
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
  zIndex?: number;
  wrapperClassName?: string;
  panelClassName?: string;
  children: React.ReactNode;
  ariaLabelledBy?: string;
  ariaLabel?: string;
  enableDragDismiss?: boolean;
}

export function MobileDrawerShell({
  open,
  onClose,
  isMobile,
  zIndex = 280,
  wrapperClassName,
  panelClassName,
  children,
  ariaLabelledBy,
  ariaLabel,
  enableDragDismiss = true,
}: MobileDrawerShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);

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
    isDismissing,
    isEntering,
  } = useMobileSheetDrag({
    enabled: isMobile && open && enableDragDismiss,
    onDismiss: onClose,
    dragMode: "handle",
    dragEngine: "manual",
  });

  useScrollLock(open);
  useVisualViewportInsets(isMobile && open);

  const handleClose = useCallback(() => {
    if (isMobile) {
      requestDismiss();
      return;
    }
    onClose();
  }, [isMobile, onClose, requestDismiss]);

  useLayoutEffect(() => {
    if (!open || !isMobile) {
      openedRef.current = false;
      return;
    }
    const height = panelRef.current?.offsetHeight ?? window.innerHeight;
    setDismissTarget(height);
    if (!openedRef.current) {
      openedRef.current = true;
      animateEnter();
    }
  }, [open, isMobile, animateEnter, setDismissTarget]);

  useLayoutEffect(() => {
    if (!open || !isMobile || isDismissing || isEntering) return;
    const panel = panelRef.current;
    const scrollEl =
      panel?.querySelector<HTMLElement>(".overflow-y-auto, .overscroll-contain") ?? null;
    return attachCaptureDragSurface(panel, {
      getScrollEl: () => scrollEl,
      scrollGateSelector: ".overflow-y-auto, .overscroll-contain",
      canStart: isSheetBlankDragTarget,
    });
  }, [attachCaptureDragSurface, open, isMobile, isDismissing, isEntering]);

  return (
    <AnimatePresence onExitComplete={resetDrag}>
      {open && (
        <motion.div
          className={cn(
            "fixed inset-0 flex p-0 pointer-events-none",
            isMobile ? "flex-col" : "items-center justify-center sm:p-3 md:p-4",
            wrapperClassName,
          )}
          style={{ zIndex }}
          initial={false}
          exit={{ pointerEvents: "none" }}
        >
          <motion.div
            className={cn(
              "absolute inset-0 pointer-events-auto",
              isMobile ? "sheet-backdrop" : "overlay-scrim backdrop-blur-sm",
            )}
            initial={isMobile ? false : { opacity: 0 }}
            animate={isMobile ? undefined : { opacity: 1 }}
            style={isMobile ? { opacity: backdropOpacityMotion } : undefined}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={ariaLabelledBy}
            aria-label={ariaLabel}
            className={cn(
              "relative flex flex-col w-full border border-border-glass modal-panel bg-bg-panel shadow-2xl overflow-hidden pointer-events-auto",
              isMobile
                ? cn(
                    "mobile-bottom-sheet keyboard-stable-sheet rounded-t-3xl",
                    MOBILE_SHEET_HEIGHT_CLASS,
                    isDragging && "bottom-sheet-panel--dragging",
                  )
                : "rounded-t-2xl sm:rounded-2xl max-h-[94vh]",
              panelClassName,
            )}
            onClick={(e) => e.stopPropagation()}
            initial={isMobile ? { opacity: 0.98 } : { scale: 0.96, opacity: 0 }}
            animate={isMobile ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={isMobile ? { opacity: 0, pointerEvents: "none" } : { scale: 0.96, opacity: 0 }}
            transition={isMobile ? { duration: 0.18, ease: "easeOut" } : SHEET_SPRING}
            style={isMobile ? { y: sheetY } : undefined}
          >
            {isMobile && <SheetDragHandle onPointerDown={startDrag} />}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
