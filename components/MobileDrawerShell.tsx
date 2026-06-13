"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMobileSheetDrag } from "@/lib/hooks/useMobileSheetDrag";
import { MOBILE_SHEET_HEIGHT_CLASS, SHEET_SPRING } from "@/lib/motion/sheet";
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
}: MobileDrawerShellProps) {
  const {
    dragY,
    resetDrag,
    startDrag,
    handleDragEnd,
    handleDrag,
    drag,
    dragControlsProp,
    dragListener,
    dragConstraints,
    dragElastic,
  } = useMobileSheetDrag({
    enabled: isMobile && open,
    onDismiss: onClose,
    dragMode: "handle",
  });

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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={ariaLabelledBy}
            aria-label={ariaLabel}
            className={cn(
              "relative flex flex-col w-full border border-border-glass modal-panel bg-bg-panel shadow-2xl overflow-hidden",
              isMobile
                ? cn("mobile-bottom-sheet rounded-t-3xl", MOBILE_SHEET_HEIGHT_CLASS)
                : "rounded-t-2xl sm:rounded-2xl max-h-[94vh]",
              panelClassName,
            )}
            onClick={(e) => e.stopPropagation()}
            drag={isMobile ? drag : false}
            dragControls={isMobile ? dragControlsProp : undefined}
            dragListener={dragListener}
            dragConstraints={isMobile ? dragConstraints : undefined}
            dragElastic={isMobile ? dragElastic : undefined}
            onDrag={isMobile ? handleDrag : undefined}
            onDragEnd={isMobile ? handleDragEnd : undefined}
            initial={isMobile ? { y: "100%" } : { scale: 0.96, opacity: 0 }}
            animate={isMobile ? { y: dragY, opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={isMobile ? { y: "100%" } : { scale: 0.96, opacity: 0 }}
            transition={SHEET_SPRING}
          >
            {isMobile && <SheetDragHandle onPointerDown={startDrag} />}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}