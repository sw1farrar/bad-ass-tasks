"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { cn, triggerHaptic } from "@/lib/utils";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

const SPRING = { type: "spring" as const, damping: 28, stiffness: 320, mass: 0.85 };

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
  showClose?: boolean;
  showDragHandle?: boolean;
  enableDragDismiss?: boolean;
}

function useIsMobileSheet(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
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
  showClose = true,
  showDragHandle = true,
  enableDragDismiss = true,
}: BottomSheetProps) {
  const [mounted] = useState(() => typeof window !== "undefined");
  const [dragY, setDragY] = useState(0);
  const isMobile = useIsMobileSheet();

  const handleClose = useCallback(() => {
    triggerHaptic("light");
    onClose();
  }, [onClose]);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) {
      handleClose();
    } else {
      setDragY(0);
    }
  };

  if (!mounted) return null;

  const useMobileSheet = isMobile && mobileLayout === "sheet";
  const useMobileCentered = isMobile && mobileLayout === "centered";

  const backdropClasses = cn(
    "absolute inset-0",
    backdropClassName ??
      (useMobileSheet
        ? "sheet-backdrop"
        : useMobileCentered
          ? "overlay-scrim backdrop-blur-md"
          : "overlay-scrim"),
  );

  return createPortal(
    <AnimatePresence onExitComplete={() => setDragY(0)}>
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
                useMobileSheet && "mobile-bottom-sheet rounded-t-3xl max-h-[92dvh]",
                useMobileCentered &&
                  "max-w-[min(20rem,calc(100vw-2rem))] mx-auto rounded-2xl max-h-[min(85dvh,640px)]",
                !isMobile && cn("rounded-3xl max-h-[min(90vh,880px)]", desktopMaxWidth),
                panelClassName,
              )}
              onClick={(e) => e.stopPropagation()}
              drag={useMobileSheet && enableDragDismiss ? "y" : false}
              dragConstraints={{ top: 0, bottom: 400 }}
              dragElastic={0.15}
              onDrag={(_e, info) => {
                if (useMobileSheet) setDragY(Math.max(0, info.offset.y));
              }}
              onDragEnd={useMobileSheet && enableDragDismiss ? handleDragEnd : undefined}
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
              transition={SPRING}
              style={useMobileSheet ? { touchAction: "pan-y" } : undefined}
            >
              {useMobileSheet && showDragHandle && (
                <div className="sheet-drag-handle shrink-0" aria-hidden="true" />
              )}

              {(title || showClose) && (
                <div
                  className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-border-glass"
                  style={
                    useMobileSheet
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

              <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
                style={{
                  paddingBottom: useMobileSheet
                    ? "max(1rem, env(safe-area-inset-bottom, 12px))"
                    : undefined,
                }}
              >
                {children}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}