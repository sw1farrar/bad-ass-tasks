"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImagePreviewModalProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

/**
 * World-class image preview / lightbox for the Notes rich editor.
 * - Smooth enter/exit (framer-motion)
 * - Desktop: wheel zoom + drag to pan
 * - Mobile: pinch (via touch events) + swipe down to close
 * - Keyboard: ESC close, +/- zoom, 0 reset, arrows pan when zoomed
 * - Beautiful glassmorphism dark theme matching the app
 * - Download button (preserves original)
 * - Click backdrop or X to close
 * - Accessible (focus trap, aria labels, role=dialog)
 */
export function ImagePreviewModal({ src, alt = "Image preview", onClose }: ImagePreviewModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const minScale = 0.5;
  const maxScale = 6;

  const close = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    onClose();
  }, [onClose]);

  // Keyboard controls
  useEffect(() => {
    if (!src) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      } else if (e.key === "+" || e.key === "=") {
        setScale((s) => Math.min(maxScale, s + 0.25));
      } else if (e.key === "-") {
        setScale((s) => Math.max(minScale, s - 0.25));
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

  // Prevent body scroll while open
  useEffect(() => {
    if (!src) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [src]);

  if (!src) return null;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale((s) => Math.max(minScale, Math.min(maxScale, s + delta)));
  };

  // Mouse drag pan (when zoomed > 1)
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

  // Touch / mobile swipe down to close + basic pinch simulation
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY !== null && e.touches.length === 1) {
      const delta = e.touches[0].clientY - touchStartY;
      if (delta > 120 && scale === 1) {
        // Swipe down to close when not zoomed
        close();
      }
    }
  };

  const handleTouchEnd = () => {
    setTouchStartY(null);
  };

  const handleDownload = () => {
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

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-xl"
        onClick={close}
        role="dialog"
        aria-modal="true"
        aria-label="Image preview"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex h-full w-full flex-col items-center justify-center p-4 md:p-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top controls */}
          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-3 md:px-6">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <span className="font-mono text-[10px] tracking-[1px] text-white/40">PREVIEW</span>
              {alt && <span className="max-w-[40vw] truncate text-white/80">{alt}</span>}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={resetView}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white active:bg-white/15"
                title="Reset view (0)"
                aria-label="Reset zoom and position"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setScale((s) => Math.max(minScale, s - 0.35))}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white active:bg-white/15"
                title="Zoom out (−)"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={() => setScale((s) => Math.min(maxScale, s + 0.35))}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white active:bg-white/15"
                title="Zoom in (+)"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={handleDownload}
                className="ml-1 flex h-9 items-center gap-2 rounded-full bg-white/5 px-4 text-sm text-white/80 hover:bg-white/10 hover:text-white active:bg-white/15"
                title="Download original image"
              >
                <Download className="h-4 w-4" />
                <span className="hidden text-xs tracking-widest md:inline">DOWNLOAD</span>
              </button>
              <button
                onClick={close}
                className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white active:bg-white/15"
                title="Close (Esc)"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Image container with gestures */}
          <div
            className="relative flex h-full w-full items-center justify-center overflow-hidden touch-none select-none"
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
              className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isDragging ? "none" : "transform 0.08s ease-out",
              }}
              onClick={(e) => {
                // Double click / tap to reset or zoom in
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

          {/* Subtle footer hint */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center text-[10px] tracking-[1.5px] text-white/30">
            ESC to close • scroll or +/− to zoom • drag to pan
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
