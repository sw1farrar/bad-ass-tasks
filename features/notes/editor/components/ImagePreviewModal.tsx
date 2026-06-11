"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { PreviewMobileActions } from "@/components/PreviewMobileActions";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { usePinchZoomPan } from "@/lib/hooks/usePinchZoomPan";
import { cn, triggerHaptic } from "@/lib/utils";

interface ImagePreviewModalProps {
  src: string | null;
  alt?: string;
  mimeType?: string;
  onClose: () => void;
}

export function ImagePreviewModal({
  src,
  alt = "Image preview",
  mimeType,
  onClose,
}: ImagePreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobileViewport();

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
    if (!src) return;
    reset();
  }, [src, reset]);

  useEffect(() => {
    if (!src) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "+" || e.key === "=") zoomIn();
      else if (e.key === "-") zoomOut();
      else if (e.key.toLowerCase() === "0") reset();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [src, close, reset, zoomIn, zoomOut]);

  useScrollLock(!!src);

  const handleDownload = () => {
    if (!src) return;
    const link = document.createElement("a");
    link.href = src;
    link.download = alt || "image";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerHaptic("light");
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {src && (
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
            {/* Top chrome */}
            <div
              className={cn(
                "pointer-events-auto flex shrink-0 items-center justify-between",
                isMobile ? "file-preview-mobile-chrome" : "px-4 py-3 md:px-6",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {!isMobile && (
                <div className="flex min-w-0 items-center gap-2 text-sm text-white/70">
                  {alt && <span className="max-w-[40vw] truncate text-white/80">{alt}</span>}
                </div>
              )}

              {isMobile ? (
                <div className="ml-auto flex items-center gap-2">
                  {src ? (
                    <PreviewMobileActions
                      file={{ url: src, fileName: alt, mimeType }}
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

            {/* Image stage — tap backdrop (not image) closes */}
            <div
              className={cn(
                "pointer-events-auto relative flex flex-1 items-center justify-center overflow-hidden touch-none select-none",
                isMobile ? "file-preview-mobile-body px-0 py-0" : "px-4 pb-4 md:px-8",
              )}
              onClick={close}
            >
              <div
                className="pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
                onWheel={handleWheel}
                {...mouseHandlers}
                {...touchHandlers}
                style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={alt}
                  draggable={false}
                  className={cn(
                    "object-contain select-none",
                    isMobile
                      ? "max-h-[100dvh] max-w-[100vw]"
                      : "max-h-[86vh] max-w-[min(94vw,1400px)] rounded-2xl border border-border-glass modal-panel shadow-[0_24px_80px_rgba(0,0,0,0.65)]",
                  )}
                  style={transformStyle}
                  onClick={() => handleTap()}
                />
              </div>
            </div>

            {/* Mobile zoom pill — only when zoomed */}
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