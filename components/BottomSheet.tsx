"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/utils";

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
  zIndex?: number;
  /** Desktop max width (tailwind class) */
  desktopMaxWidth?: string;
  showClose?: boolean;
  showDragHandle?: boolean;
  enableDragDismiss?: boolean;
}

function useIsMobileSheet(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

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
  zIndex = 260,
  desktopMaxWidth = "max-w-md",
  showClose = true,
  showDragHandle = true,
  enableDragDismiss = true,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const isMobile = useIsMobileSheet();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => {
    triggerHaptic("light");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, handleClose]);

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) {
      handleClose();
    } else {
      setDragY(0);
    }
  };

  if (!mounted) return null;

  const mobileSheet = isMobile;

  return createPortal(
    <AnimatePresence onExitComplete={() => setDragY(0)}>
      {open && (
        <div
          className={cn(
            "fixed inset-0 flex p-0 md:p-4",
            mobileSheet ? "items-end sheet-backdrop" : "items-center justify-center bg-black/70",
            className
          )}
          style={{ zIndex }}
          onClick={handleClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || title}
            className={cn(
              "relative w-full bg-[#0f0f12] border border-white/10 shadow-2xl flex flex-col overflow-hidden",
              mobileSheet
                ? "mobile-bottom-sheet rounded-t-3xl max-h-[92dvh]"
                : cn("rounded-3xl max-h-[min(90vh,880px)]", desktopMaxWidth),
              panelClassName
            )}
            onClick={(e) => e.stopPropagation()}
            drag={mobileSheet && enableDragDismiss ? "y" : false}
            dragConstraints={{ top: 0, bottom: 400 }}
            dragElastic={0.15}
            onDrag={(_e, info) => {
              if (mobileSheet) setDragY(Math.max(0, info.offset.y));
            }}
            onDragEnd={mobileSheet && enableDragDismiss ? handleDragEnd : undefined}
            initial={mobileSheet ? { y: "100%" } : { scale: 0.96, opacity: 0 }}
            animate={mobileSheet ? { y: dragY, opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={mobileSheet ? { y: "100%", opacity: 0 } : { scale: 0.96, opacity: 0 }}
            transition={SPRING}
            style={mobileSheet ? { touchAction: "pan-y" } : undefined}
          >
            {mobileSheet && showDragHandle && (
              <div className="sheet-drag-handle shrink-0" aria-hidden="true" />
            )}

            {(title || showClose) && (
              <div
                className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-white/10"
                style={
                  mobileSheet
                    ? { paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }
                    : undefined
                }
              >
                {title ? (
                  <h2 className="font-semibold text-base tracking-tight text-[#f4f4f5] min-w-0 truncate">
                    {title}
                  </h2>
                ) : (
                  <span />
                )}
                {showClose && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#71717a] hover:text-white hover:bg-white/10 transition active:scale-95"
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
                paddingBottom: mobileSheet
                  ? "max(1rem, env(safe-area-inset-bottom, 12px))"
                  : undefined,
              }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}