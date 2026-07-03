"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn, triggerHaptic } from "@/lib/utils";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useMobileSheetDrag } from "@/lib/hooks/useMobileSheetDrag";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useVisualViewportInsets } from "@/lib/hooks/useVisualViewportInsets";
import { useFocusWithinScroll } from "@/lib/hooks/useFocusWithinScroll";
import {
  MOBILE_SHEET_HEIGHT_90_CLASS,
  MOBILE_SHEET_HEIGHT_CLASS,
  SHEET_SPRING,
} from "@/lib/motion/sheet";
import { SheetDragHandle } from "@/components/SheetDragHandle";

export type MobileSheetHeight = "full" | "90";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  /** Accessible label when title is omitted */
  ariaLabel?: string;
  className?: string;
  panelClassName?: string;
  backdropClassName?: string;
  zIndex?: number;
  /** Desktop max width (tailwind class) */
  desktopMaxWidth?: string;
  /** Mobile presentation: bottom sheet (default) or centered dialog */
  mobileLayout?: "sheet" | "centered";
  /** Mobile sheet height: 90dvh (default) or full viewport */
  mobileHeight?: MobileSheetHeight;
  showClose?: boolean;
  showDragHandle?: boolean;
  enableDragDismiss?: boolean;
  /** handle: drag only from handle (scroll-safe). panel: whole sheet draggable */
  dragMode?: "handle" | "panel";
  /** When false, children render directly (for custom flex layouts inside sheet) */
  wrapChildrenInScroll?: boolean;
}

export function BottomSheet({
  open,
  onClose,
  children,
  title,
  ariaLabel,
  className,
  panelClassName,
  backdropClassName,
  zIndex = 260,
  desktopMaxWidth = "max-w-md",
  mobileLayout = "sheet",
  mobileHeight = "90",
  showClose = true,
  showDragHandle = true,
  enableDragDismiss = true,
  dragMode = "handle",
  wrapChildrenInScroll = true,
}: BottomSheetProps) {
  const [mounted] = useState(() => typeof window !== "undefined");
  const isMobile = useIsMobileViewport();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    triggerHaptic("light");
    onClose();
  }, [onClose]);

  const useMobileSheet = isMobile && mobileLayout === "sheet";
  const useMobileCentered = isMobile && mobileLayout === "centered";
  const dragEnabled = useMobileSheet && enableDragDismiss;

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
    enabled: dragEnabled,
    onDismiss: handleClose,
    dragMode,
  });

  useScrollLock(open);
  useVisualViewportInsets(open && useMobileSheet);
  useFocusWithinScroll(scrollRef, open && useMobileSheet && wrapChildrenInScroll);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  if (!mounted) return null;

  const mobileHeightClass =
    mobileHeight === "full" ? MOBILE_SHEET_HEIGHT_CLASS : MOBILE_SHEET_HEIGHT_90_CLASS;

  const backdropClasses = cn(
    "absolute inset-0",
    backdropClassName ??
      (useMobileSheet
        ? "sheet-backdrop"
        : useMobileCentered
          ? "overlay-scrim backdrop-blur-md"
          : "overlay-scrim"),
  );

  const scrollBody = wrapChildrenInScroll ? (
    <div
      ref={scrollRef}
      className="bottom-sheet-scroll-body flex-1 min-h-0 overflow-y-auto overscroll-contain"
      style={{
        paddingBottom: useMobileSheet
          ? "max(1rem, env(safe-area-inset-bottom, 12px), var(--keyboard-inset, 0px))"
          : undefined,
      }}
    >
      {children}
    </div>
  ) : (
    children
  );

  return createPortal(
    <AnimatePresence onExitComplete={resetDrag}>
      {open && (
        <div
          className={cn("fixed inset-0", className)}
          style={{ zIndex }}
          role="presentation"
        >
          <motion.div
            key="bottom-sheet-backdrop"
            className={backdropClasses}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={handleClose}
            aria-hidden="true"
          />

          <div
            className={cn(
              "relative z-10 flex h-full w-full pointer-events-none",
              useMobileSheet ? "items-end justify-center" : "items-center justify-center p-4",
            )}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel || title}
              className={cn(
                "bottom-sheet-panel pointer-events-auto w-full bg-bg-panel border border-border-glass modal-panel shadow-2xl flex flex-col overflow-hidden",
                useMobileSheet &&
                  cn(
                    "mobile-bottom-sheet keyboard-stable-sheet rounded-t-3xl",
                    mobileHeightClass,
                  ),
                useMobileCentered &&
                  "max-w-[min(20rem,calc(100vw-2rem))] mx-auto rounded-2xl max-h-[min(85dvh,640px)]",
                !isMobile && cn("rounded-3xl max-h-[min(90vh,880px)]", desktopMaxWidth),
                panelClassName,
              )}
              onClick={(e) => e.stopPropagation()}
              drag={drag}
              dragControls={dragControlsProp}
              dragListener={dragListener}
              dragConstraints={dragConstraints}
              dragElastic={dragElastic}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
              initial={
                useMobileSheet
                  ? { y: "100%" }
                  : { scale: 0.96, opacity: 0 }
              }
              animate={
                useMobileSheet
                  ? { y: dragY, opacity: 1 }
                  : { scale: 1, opacity: 1 }
              }
              exit={
                useMobileSheet
                  ? { y: "100%", opacity: 0 }
                  : { scale: 0.96, opacity: 0 }
              }
              transition={SHEET_SPRING}
              style={useMobileSheet ? { touchAction: "pan-y" } : undefined}
            >
              {useMobileSheet && showDragHandle && (
                <SheetDragHandle
                  onPointerDown={dragMode === "handle" ? startDrag : undefined}
                />
              )}

              {(title || showClose) && (
                <div
                  className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-border-glass"
                  style={
                    useMobileSheet && !showDragHandle
                      ? { paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }
                      : undefined
                  }
                >
                  {title ? (
                    <h2 className="font-semibold text-base tracking-tight text-text-primary min-w-0 truncate">
                      {title}
                    </h2>
                  ) : (
                    <span />
                  )}
                  {showClose && (
                    <button
                      type="button"
                      onClick={handleClose}
                      className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover transition active:scale-95"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}

              {scrollBody}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}