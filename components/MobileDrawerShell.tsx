"use client";

import React, { useCallback, useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMobileSheetDrag } from "@/lib/hooks/useMobileSheetDrag";
import { MOBILE_SHEET_HEIGHT_90_CLASS, SHEET_SPRING } from "@/lib/motion/sheet";
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
  } = useMobileSheetDrag({
    enabled: isMobile && open && enableDragDismiss,
    onDismiss: onClose,
    dragMode: "handle",
    dragEngine: "manual",
  });

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

  return (
    <AnimatePresence onExitComplete={resetDrag}>
      {open && (
        <div
          className={cn(
            "fixed inset-0 flex p-0",
            isMobile ? "flex-col justify-end" : "items-center justify-center sm:p-3 md:p-4",
            wrapperClassName,
          )}
          style={{ zIndex }}
        >
          <motion.div
            className={cn(
              "absolute inset-0",
              isMobile ? "sheet-backdrop" : "overlay-scrim backdrop-blur-sm",
            )}
            initial={isMobile ? false : { opacity: 0 }}
            animate={isMobile ? undefined : { opacity: 1 }}
            style={isMobile ? { opacity: backdropOpacityMotion } : undefined}
            exit={{ opacity: 0 }}
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
              "relative flex flex-col w-full border border-border-glass modal-panel bg-bg-panel shadow-2xl overflow-hidden",
              isMobile
                ? cn(
                    "mobile-bottom-sheet rounded-t-3xl",
                    MOBILE_SHEET_HEIGHT_90_CLASS,
                    isDragging && "bottom-sheet-panel--dragging",
                  )
                : "rounded-t-2xl sm:rounded-2xl max-h-[94vh]",
              panelClassName,
            )}
            onClick={(e) => e.stopPropagation()}
            initial={isMobile ? { opacity: 0.98 } : { scale: 0.96, opacity: 0 }}
            animate={isMobile ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={isMobile ? { opacity: 0 } : { scale: 0.96, opacity: 0 }}
            transition={isMobile ? { duration: 0.18, ease: "easeOut" } : SHEET_SPRING}
            style={isMobile ? { y: sheetY, touchAction: "pan-y" } : undefined}
          >
            {isMobile && <SheetDragHandle onPointerDown={startDrag} />}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
