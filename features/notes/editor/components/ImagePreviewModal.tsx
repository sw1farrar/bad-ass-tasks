"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { PreviewMobileActions } from "@/components/PreviewMobileActions";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { usePinchZoomPan } from "@/lib/hooks/usePinchZoomPan";
import { cn, triggerHaptic } from "@/lib/utils";

export type ImagePreviewItem = {
  src: string;
  alt?: string;
  mimeType?: string;
};

export type ImagePreviewGallery = {
  items: ImagePreviewItem[];
  index: number;
  onIndexChange: (index: number) => void;
  loop?: boolean;
};

export type ImagePreviewNavigation = {
  onPrev: () => void;
  onNext: () => void;
  label?: string;
};

interface ImagePreviewModalProps {
  src?: string | null;
  alt?: string;
  mimeType?: string;
  onClose: () => void;
  gallery?: ImagePreviewGallery;
  navigation?: ImagePreviewNavigation;
}

const SWIPE_THRESHOLD_PX = 48;

export function ImagePreviewModal({
  src = null,
  alt = "Image preview",
  mimeType,
  onClose,
  gallery,
  navigation,
}: ImagePreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobileViewport();
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const hasGallery = (gallery?.items.length ?? 0) > 1;
  const hasNavigation = !!navigation;
  const canNavigate = hasGallery || hasNavigation;

  const activeItem = gallery?.items[gallery.index] ?? { src: src ?? "", alt, mimeType };
  const displaySrc = activeItem.src || src;
  const displayAlt = activeItem.alt ?? alt;
  const displayMimeType = activeItem.mimeType ?? mimeType;

  const {
    scale,
    isDragging,
    transformStyle,
    reset,
    zoomIn,
    zoomOut,
    touchHandlers,
    mouseHandlers,
    handleWheel,
    handleTap,
  } = usePinchZoomPan({ minScale: 1, maxScale: 6, doubleTapScale: 2.5 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    reset();
    triggerHaptic("light");
    onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (!displaySrc) return;
    reset();
  }, [displaySrc, reset]);

  const goPrev = useCallback(() => {
    if (navigation) {
      navigation.onPrev();
      return;
    }
    if (!gallery || gallery.items.length <= 1) return;
    const nextIndex =
      gallery.index > 0
        ? gallery.index - 1
        : gallery.loop
          ? gallery.items.length - 1
          : gallery.index;
    if (nextIndex !== gallery.index) gallery.onIndexChange(nextIndex);
  }, [gallery, navigation]);

  const goNext = useCallback(() => {
    if (navigation) {
      navigation.onNext();
      return;
    }
    if (!gallery || gallery.items.length <= 1) return;
    const nextIndex =
      gallery.index < gallery.items.length - 1
        ? gallery.index + 1
        : gallery.loop
          ? 0
          : gallery.index;
    if (nextIndex !== gallery.index) gallery.onIndexChange(nextIndex);
  }, [gallery, navigation]);

  useEffect(() => {
    if (!displaySrc) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft" && canNavigate) goPrev();
      else if (e.key === "ArrowRight" && canNavigate) goNext();
      else if (e.key === "+" || e.key === "=") zoomIn();
      else if (e.key === "-") zoomOut();
      else if (e.key.toLowerCase() === "0") reset();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [displaySrc, close, reset, zoomIn, zoomOut, canNavigate, goPrev, goNext]);

  useScrollLock(!!displaySrc);

  const handleDownload = () => {
    if (!displaySrc) return;
    const link = document.createElement("a");
    link.href = displaySrc;
    link.download = displayAlt || "image";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerHaptic("light");
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length === 1 && scale <= 1.02 && canNavigate) {
      swipeStartRef.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    } else {
      swipeStartRef.current = null;
    }
    touchHandlers.onTouchStart?.(event);
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;

    if (start && scale <= 1.02 && canNavigate && event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * 1.25) {
        if (dx < 0) goNext();
        else goPrev();
        touchHandlers.onTouchEnd?.();
        return;
      }
    }

    touchHandlers.onTouchEnd?.();
  };

  const positionLabel = navigation?.label
    ? navigation.label
    : hasGallery && gallery
      ? `${gallery.index + 1} / ${gallery.items.length}`
      : null;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {displaySrc && (
        <motion.div
          key="image-lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[10050]"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#050508]/96 backdrop-blur-xl"
            onClick={close}
            aria-label="Close preview"
          />

          <div
            className={cn(
              "absolute inset-0 z-10 flex h-full w-full flex-col",
              isMobile ? "pointer-events-auto" : "pointer-events-none",
            )}
          >
            <div
              className={cn(
                "pointer-events-auto flex shrink-0 items-center justify-between",
                isMobile ? "file-preview-mobile-chrome" : "px-4 py-3 md:px-6",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {!isMobile && (
                <div className="flex min-w-0 items-center gap-2 text-sm text-white/70">
                  {displayAlt ? (
                    <span className="max-w-[32vw] truncate text-white/80">{displayAlt}</span>
                  ) : null}
                  {positionLabel ? (
                    <span className="shrink-0 font-mono text-[11px] text-white/45 tabular-nums">
                      {positionLabel}
                    </span>
                  ) : null}
                </div>
              )}

              {isMobile ? (
                <div className="ml-auto flex items-center gap-2">
                  {positionLabel ? (
                    <span className="font-mono text-[11px] text-white/55 tabular-nums">
                      {positionLabel}
                    </span>
                  ) : null}
                  {displaySrc ? (
                    <PreviewMobileActions
                      file={{ url: displaySrc, fileName: displayAlt, mimeType: displayMimeType }}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={close}
                    className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-glass bg-black/55 text-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-md active:scale-95"
                    aria-label="Close preview"
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </div>
              ) : (
                <div className="ml-auto flex items-center gap-1.5 rounded-full border border-border-glass bg-black/40 p-1 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-surface-hover hover:text-text-primary"
                    title="Reset view"
                    aria-label="Reset zoom and position"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomOut()}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-surface-hover hover:text-text-primary"
                    title="Zoom out"
                    aria-label="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="min-w-[3rem] text-center font-mono text-[11px] text-white/50">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => zoomIn()}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-surface-hover hover:text-text-primary"
                    title="Zoom in"
                    aria-label="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="ml-1 flex h-9 items-center gap-2 rounded-full px-3 text-sm text-white/80 hover:bg-surface-hover hover:text-text-primary"
                    title="Download"
                    aria-label="Download image"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="ml-1 flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-surface-hover hover:text-text-primary"
                    title="Close"
                    aria-label="Close preview"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div
              className={cn(
                "pointer-events-auto relative flex flex-1 items-center justify-center overflow-hidden touch-none select-none",
                isMobile ? "file-preview-mobile-body px-0 py-0" : "px-4 pb-4 md:px-8",
              )}
              onClick={close}
            >
              {canNavigate ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goPrev();
                    }}
                    className="image-preview-nav image-preview-nav--left"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-6 w-6" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goNext();
                    }}
                    className="image-preview-nav image-preview-nav--right"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-6 w-6" aria-hidden />
                  </button>
                </>
              ) : null}

              <div
                className="pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
                onWheel={handleWheel}
                {...mouseHandlers}
                onTouchStart={handleTouchStart}
                onTouchMove={touchHandlers.onTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.img
                    key={displaySrc}
                    src={displaySrc}
                    alt={displayAlt}
                    draggable={false}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      "object-contain select-none",
                      isMobile
                        ? "max-h-[100dvh] max-w-[100vw]"
                        : "max-h-[86vh] max-w-[min(94vw,1400px)] rounded-2xl border border-border-glass modal-panel shadow-[0_24px_80px_rgba(0,0,0,0.65)]",
                    )}
                    style={transformStyle}
                    onClick={() => handleTap()}
                  />
                </AnimatePresence>
              </div>
            </div>

            {isMobile && scale > 1.05 && (
              <div className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2">
                <span className="rounded-full border border-border-glass bg-black/50 px-3 py-1 font-mono text-[11px] text-white/70 backdrop-blur-md">
                  {Math.round(scale * 100)}%
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}