"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImagePreviewModalProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 6;

/**
 * Full-screen image lightbox portaled above the entire app.
 * Desktop: wheel zoom, drag to pan, keyboard shortcuts.
 * Mobile: swipe down to close.
 */
export function ImagePreviewModal({ src, alt = "Image preview", onClose }: ImagePreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
    setTouchStartY(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!src) return;
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
    setTouchStartY(null);
  }, [src]);

  useEffect(() => {
    if (!src) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      } else if (e.key === "+" || e.key === "=") {
        setScale((s) => Math.min(MAX_SCALE, s + 0.25));
      } else if (e.key === "-") {
        setScale((s) => Math.max(MIN_SCALE, s - 0.25));
      } else if (e.key.toLowerCase() === "0") {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      } else if (e.key === "ArrowLeft") {
        setPosition((p) => ({ ...p, x: p.x + 40 }));
      } else if (e.key === "ArrowRight") {
        setPosition((p) => ({ ...p, x: p.x - 40 }));
      } else if (e.key === "ArrowUp") {
        setPosition((p) => ({ ...p, y: p.y + 40 }));
      } else if (e.key === "ArrowDown") {
        setPosition((p) => ({ ...p, y: p.y - 40 }));
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [src, close]);

  useEffect(() => {
    if (!src) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [src]);

  if (!mounted) return null;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY !== null && e.touches.length === 1) {
      const delta = e.touches[0].clientY - touchStartY;
      if (delta > 120 && scale === 1) {
        close();
      }
    }
  };

  const handleTouchEnd = () => {
    setTouchStartY(null);
  };

  const handleDownload = () => {
    if (!src) return;
    const link = document.createElement("a");
    link.href = src;
    link.download = alt || "image";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return createPortal(
    <AnimatePresence>
      {src && (
        <motion.div
          key="image-lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[9999]"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <div
            className="absolute inset-0 bg-[#050508]/95 backdrop-blur-2xl"
            onClick={close}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 70% at 50% 45%, rgba(192,132,252,0.08) 0%, transparent 65%)",
            }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex h-full w-full flex-col pointer-events-none p-4 md:p-8"
          >
            <div
              className="pointer-events-auto absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-3 md:px-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-sm text-white/70">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] tracking-[1.5px] text-white/50">
                  PREVIEW
                </span>
                {alt && (
                  <span className="max-w-[40vw] truncate text-white/80">{alt}</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={resetView}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                  title="Reset view (0)"
                  aria-label="Reset zoom and position"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.35))}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
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
                  onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.35))}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                  title="Zoom in"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="ml-1 flex h-9 items-center gap-2 rounded-full px-3 text-sm text-white/80 hover:bg-white/10 hover:text-white"
                  title="Download original image"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden text-xs tracking-widest md:inline">SAVE</span>
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="ml-1 flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                  title="Close (Esc)"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              className="pointer-events-auto relative flex flex-1 w-full items-center justify-center overflow-hidden touch-none select-none"
              onClick={close}
            >
              <div
                className="pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in" }}
              >
                <motion.img
                  src={src}
                  alt={alt}
                  draggable={false}
                  className="max-h-[86vh] max-w-[min(94vw,1400px)] rounded-2xl object-contain shadow-[0_24px_80px_rgba(0,0,0,0.65)] ring-1 ring-white/15"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transition: isDragging ? "none" : "transform 0.08s ease-out",
                  }}
                  onClick={(e) => {
                    if (e.detail === 2) {
                      if (scale > 1.1) {
                        resetView();
                      } else {
                        setScale(2.2);
                      }
                    }
                  }}
                />
              </div>
            </div>

            <div className="absolute bottom-5 left-0 right-0 flex justify-center text-[10px] tracking-[1.5px] text-white/35">
              ESC to close · scroll or +/- to zoom · drag to pan when zoomed
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}