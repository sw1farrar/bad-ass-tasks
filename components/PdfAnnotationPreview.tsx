"use client";

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Loader2,
  Maximize2,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { PreviewMobileActions } from "@/components/PreviewMobileActions";
import type { PreviewFileRef } from "@/lib/preview/mobileFileActions";
import {
  type PdfHighlightAnnotation,
  PDF_HIGHLIGHT_COLORS,
  annotationsEqual,
  createHighlightId,
  normalizeAreaRect,
  parsePdfAnnotations,
} from "@/lib/pdf/annotations";
import { cn } from "@/lib/utils";

export type PdfAnnotationPreviewHandle = {
  isDirty: () => boolean;
  save: () => Promise<boolean>;
};

type PdfAnnotationPreviewProps = {
  url: string;
  attachmentId?: string;
  noteId?: string;
  initialAnnotations?: PdfHighlightAnnotation[];
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: (annotations: PdfHighlightAnnotation[]) => void;
  /** Mobile read-only preview — compact toolbar, pinch zoom, no highlighting */
  mobilePreview?: boolean;
  /** Share / save / close row rendered above PDF controls on mobile */
  mobileChrome?: {
    file: PreviewFileRef;
    onClose: () => void;
  };
};

type PageRender = {
  pageNumber: number;
  baseWidth: number;
  baseHeight: number;
  dataUrl: string;
};

type DragHighlightState = {
  pageNumber: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  pageWidth: number;
  pageHeight: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.25;

function measureFitWidth(container: HTMLElement): number {
  const style = getComputedStyle(container);
  const paddingX =
    (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  return Math.max(240, Math.floor(container.clientWidth - paddingX));
}

export const PdfAnnotationPreview = React.forwardRef<
  PdfAnnotationPreviewHandle,
  PdfAnnotationPreviewProps
>(function PdfAnnotationPreview(
  {
    url,
    attachmentId,
    noteId,
    initialAnnotations = [],
    onDirtyChange,
    onSaved,
    mobilePreview = false,
    mobileChrome,
  },
  ref,
) {
  const [pages, setPages] = useState<PageRender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<PdfHighlightAnnotation[]>(initialAnnotations);
  const [savedAnnotations, setSavedAnnotations] = useState<PdfHighlightAnnotation[]>(initialAnnotations);
  const [activeColor, setActiveColor] = useState<string>(PDF_HIGHLIGHT_COLORS[0].value);
  const [saving, setSaving] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [fitWidth, setFitWidth] = useState<number | null>(null);
  const [renderFitWidth, setRenderFitWidth] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const pageAnchorRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const undoStackRef = useRef<PdfHighlightAnnotation[][]>([]);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [dragHighlight, setDragHighlight] = useState<DragHighlightState | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const annotationsRef = useRef(annotations);
  const activeColorRef = useRef(activeColor);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  useEffect(() => {
    activeColorRef.current = activeColor;
  }, [activeColor]);

  useEffect(() => {
    setRenderFitWidth(null);
    setZoomScale(1);
    setCurrentPage(1);
    undoStackRef.current = [];
    setUndoAvailable(false);
  }, [url]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => setFitWidth(measureFitWidth(el));
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (fitWidth !== null && renderFitWidth === null) {
      setRenderFitWidth(fitWidth);
    }
  }, [fitWidth, renderFitWidth]);

  useEffect(() => {
    setAnnotations(initialAnnotations);
    setSavedAnnotations(initialAnnotations);
    undoStackRef.current = [];
    setUndoAvailable(false);
  }, [url, initialAnnotations]);

  const recordUndo = useCallback(() => {
    undoStackRef.current.push(annotations);
    if (undoStackRef.current.length > 50) {
      undoStackRef.current.shift();
    }
    setUndoAvailable(undoStackRef.current.length > 0);
  }, [annotations]);

  const applyAnnotations = useCallback(
    (next: PdfHighlightAnnotation[]) => {
      setAnnotations(next);
    },
    [],
  );

  const undoHighlight = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (previous) {
      applyAnnotations(previous);
    }
    setUndoAvailable(undoStackRef.current.length > 0);
  }, [applyAnnotations]);

  const clearHighlights = useCallback(() => {
    if (!annotations.length) return;
    recordUndo();
    applyAnnotations([]);
  }, [annotations.length, applyAnnotations, recordUndo]);

  const clampZoom = useCallback((value: number) => {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value / ZOOM_STEP) * ZOOM_STEP));
  }, []);

  const scrollToPage = useCallback((pageNumber: number) => {
    const anchor = pageAnchorRefs.current[pageNumber];
    if (!anchor || !scrollRef.current) return;
    anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentPage(pageNumber);
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || pages.length === 0) return;

    const updateCurrentPage = () => {
      const scrollTop = scrollEl.scrollTop;
      let closestPage = 1;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const page of pages) {
        const anchor = pageAnchorRefs.current[page.pageNumber];
        if (!anchor) continue;
        const distance = Math.abs(anchor.offsetTop - scrollTop);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = page.pageNumber;
        }
      }

      setCurrentPage(closestPage);
    };

    updateCurrentPage();
    scrollEl.addEventListener("scroll", updateCurrentPage, { passive: true });
    return () => scrollEl.removeEventListener("scroll", updateCurrentPage);
  }, [pages]);

  const isDirty = !annotationsEqual(annotations, savedAnnotations);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const targetWidth = renderFitWidth;
    if (targetWidth === null) return;

    let cancelled = false;

    async function loadPdf(width: number) {
      setLoading(true);
      setError(null);
      setPages([]);

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const response = await fetch(url);
        if (!response.ok) throw new Error("fetch_failed");
        const buffer = await response.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buffer }).promise;
        const rendered: PageRender[] = [];
        const dpr = window.devicePixelRatio || 1;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = (width / baseViewport.width) * dpr;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("canvas_unavailable");

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: context, viewport, canvas }).promise;

          rendered.push({
            pageNumber,
            baseWidth: baseViewport.width,
            baseHeight: baseViewport.height,
            dataUrl: canvas.toDataURL("image/png"),
          });
        }

        if (!cancelled) setPages(rendered);
      } catch {
        if (!cancelled) setError("Could not load PDF preview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPdf(targetWidth);
    return () => {
      cancelled = true;
    };
  }, [url, renderFitWidth]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!attachmentId || !noteId) return false;
    if (!isDirty) return true;

    setSaving(true);
    try {
      const res = await fetch(`/api/notes/${noteId}/attachments/${attachmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfAnnotations: annotations }),
      });
      if (!res.ok) return false;
      setSavedAnnotations(annotations);
      onSaved?.(annotations);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [attachmentId, noteId, isDirty, annotations, onSaved]);

  useImperativeHandle(ref, () => ({
    isDirty: () => isDirty,
    save,
  }));

  useEffect(() => {
    if (!isDirty || !attachmentId || !noteId) return;
    const timer = window.setTimeout(() => {
      void save();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [isDirty, attachmentId, noteId, annotations, save]);

  const addAreaHighlight = useCallback(
    (
      pageNumber: number,
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      pageWidth: number,
      pageHeight: number,
    ) => {
      const rects = normalizeAreaRect(startX, startY, endX, endY, pageWidth, pageHeight);
      if (!rects.length) return;

      const next: PdfHighlightAnnotation = {
        id: createHighlightId(),
        page: pageNumber,
        color: activeColorRef.current,
        rects,
        createdAt: new Date().toISOString(),
      };

      recordUndo();
      applyAnnotations([...annotationsRef.current, next]);
    },
    [applyAnnotations, recordUndo],
  );

  const handlePinchTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!mobilePreview || event.touches.length !== 2) return;
      const a = event.touches[0];
      const b = event.touches[1];
      pinchStartDistRef.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchStartZoomRef.current = zoomScale;
    },
    [mobilePreview, zoomScale],
  );

  const handlePinchTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!mobilePreview || event.touches.length !== 2 || pinchStartDistRef.current === null) return;
      event.preventDefault();
      const a = event.touches[0];
      const b = event.touches[1];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = dist / pinchStartDistRef.current;
      setZoomScale(clampZoom(pinchStartZoomRef.current * ratio));
    },
    [clampZoom, mobilePreview],
  );

  const handlePinchTouchEnd = useCallback(() => {
    pinchStartDistRef.current = null;
  }, []);

  const startAreaHighlight = useCallback((pageNumber: number, event: React.PointerEvent) => {
    if (mobilePreview || event.button !== 0) return;

    const pageEl = pageRefs.current[pageNumber];
    if (!pageEl) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = pageEl.getBoundingClientRect();
    const startX = clamp(event.clientX - rect.left, 0, rect.width);
    const startY = clamp(event.clientY - rect.top, 0, rect.height);

    setDragHighlight({
      pageNumber,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      pageWidth: rect.width,
      pageHeight: rect.height,
    });

    const onPointerMove = (ev: PointerEvent) => {
      const liveRect = pageEl.getBoundingClientRect();
      setDragHighlight({
        pageNumber,
        startX,
        startY,
        currentX: clamp(ev.clientX - liveRect.left, 0, liveRect.width),
        currentY: clamp(ev.clientY - liveRect.top, 0, liveRect.height),
        pageWidth: liveRect.width,
        pageHeight: liveRect.height,
      });
    };

    const onPointerUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      const liveRect = pageEl.getBoundingClientRect();
      const endX = clamp(ev.clientX - liveRect.left, 0, liveRect.width);
      const endY = clamp(ev.clientY - liveRect.top, 0, liveRect.height);

      setDragHighlight(null);
      addAreaHighlight(pageNumber, startX, startY, endX, endY, liveRect.width, liveRect.height);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }, [addAreaHighlight, mobilePreview]);

  const removeHighlight = (id: string) => {
    recordUndo();
    applyAnnotations(annotations.filter((a) => a.id !== id));
  };

  useEffect(() => {
    if (!loading && pages.length > 0) {
      rootRef.current?.focus({ preventScroll: true });
    }
  }, [loading, pages.length]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoHighlight();
        return;
      }

      if (event.key === "PageUp" || (event.altKey && event.key === "ArrowUp")) {
        event.preventDefault();
        scrollToPage(Math.max(1, currentPage - 1));
        return;
      }

      if (event.key === "PageDown" || (event.altKey && event.key === "ArrowDown")) {
        event.preventDefault();
        scrollToPage(Math.min(pages.length, currentPage + 1));
        return;
      }

      if (mod && (event.key === "=" || event.key === "+")) {
        event.preventDefault();
        setZoomScale((prev) => clampZoom(prev + ZOOM_STEP));
        return;
      }

      if (mod && event.key === "-") {
        event.preventDefault();
        setZoomScale((prev) => clampZoom(prev - ZOOM_STEP));
      }
    };

    root.addEventListener("keydown", handleKeyDown);
    return () => root.removeEventListener("keydown", handleKeyDown);
  }, [clampZoom, currentPage, pages.length, scrollToPage, undoHighlight]);

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className={cn(
        "pdf-preview-root flex h-full min-h-0 flex-col bg-[#e8e8e6] outline-none",
        mobilePreview && "pdf-preview-root--mobile",
      )}
    >
      {mobilePreview && mobileChrome && (
        <div
          className="pdf-preview-mobile-chrome flex shrink-0 items-center justify-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <PreviewMobileActions file={mobileChrome.file} />
          <button
            type="button"
            onClick={mobileChrome.onClose}
            className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/55 text-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-md active:scale-95"
            aria-label="Close preview"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}

      <div
        className={cn(
          "pdf-preview-toolbar flex shrink-0 items-center border-b border-black/10 bg-white",
          mobilePreview
            ? "justify-between gap-2 px-2 py-2"
            : "flex-wrap gap-2 bg-white/95 px-3 py-2 backdrop-blur-sm md:gap-3 md:px-4",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Zoom out"
            onClick={() => setZoomScale((prev) => clampZoom(prev - ZOOM_STEP))}
            className={cn(
              "flex items-center justify-center rounded-lg text-[#52525b] active:bg-black/8",
              mobilePreview ? "h-10 w-10" : "h-7 w-7 hover:bg-black/5",
            )}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Reset zoom"
            onClick={() => setZoomScale(1)}
            className={cn(
              "min-w-[52px] text-center font-medium text-[#52525b]",
              mobilePreview ? "px-1 text-[12px]" : "text-[11px]",
            )}
            aria-label="Reset zoom"
          >
            {Math.round(zoomScale * 100)}%
          </button>
          <button
            type="button"
            title="Zoom in"
            onClick={() => setZoomScale((prev) => clampZoom(prev + ZOOM_STEP))}
            className={cn(
              "flex items-center justify-center rounded-lg text-[#52525b] active:bg-black/8",
              mobilePreview ? "h-10 w-10" : "h-7 w-7 hover:bg-black/5",
            )}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          {!mobilePreview && (
            <button
              type="button"
              title="Fit width"
              onClick={() => setZoomScale(1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#52525b] hover:bg-black/5"
              aria-label="Fit width"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className={cn("flex items-center gap-0.5", mobilePreview && "ml-auto")}>
          <button
            type="button"
            title="Previous page"
            disabled={currentPage <= 1}
            onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
            className={cn(
              "flex items-center justify-center rounded-lg text-[#52525b] disabled:opacity-35",
              mobilePreview ? "h-10 w-10 active:bg-black/8" : "h-7 w-7 hover:bg-black/5",
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span
            className={cn(
              "text-center font-medium text-[#52525b]",
              mobilePreview ? "min-w-[64px] text-[12px]" : "min-w-[72px] text-[11px]",
            )}
          >
            {currentPage} / {pages.length || 1}
          </span>
          <button
            type="button"
            title="Next page"
            disabled={currentPage >= pages.length}
            onClick={() => scrollToPage(Math.min(pages.length, currentPage + 1))}
            className={cn(
              "flex items-center justify-center rounded-lg text-[#52525b] disabled:opacity-35",
              mobilePreview ? "h-10 w-10 active:bg-black/8" : "h-7 w-7 hover:bg-black/5",
            )}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {!mobilePreview && (
          <>
            <div className="h-5 w-px bg-black/10" />

            <Highlighter className="h-4 w-4 text-[#7c3aed]" />
            <span className="hidden text-[10px] text-[#a1a1aa] sm:inline">Drag to highlight</span>
            <div className="flex items-center gap-1.5">
              {PDF_HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => setActiveColor(c.value)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform",
                    activeColor === c.value
                      ? "border-[#7c3aed] scale-110"
                      : "border-black/15 hover:border-black/30",
                  )}
                  style={{ backgroundColor: c.value }}
                  aria-label={`${c.label} highlight`}
                />
              ))}
            </div>

            <div className="h-5 w-px bg-black/10" />

            <button
              type="button"
              title="Undo highlight (Ctrl+Z)"
              disabled={!undoAvailable}
              onClick={undoHighlight}
              className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-[#52525b] hover:bg-black/5 disabled:opacity-35"
              aria-label="Undo highlight"
            >
              <Undo2 className="h-4 w-4" />
              <span className="hidden sm:inline">Undo</span>
            </button>
            <button
              type="button"
              title="Clear all highlights"
              disabled={!annotations.length}
              onClick={clearHighlights}
              className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-[#52525b] hover:bg-black/5 disabled:opacity-35"
              aria-label="Clear all highlights"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>

            {saving && <span className="ml-auto text-[10px] text-[#7c3aed]">Saving…</span>}
            {!saving && isDirty && attachmentId && (
              <span className="ml-auto text-[10px] text-[#a1a1aa]">Unsaved changes</span>
            )}
          </>
        )}
      </div>

      <div
        ref={scrollRef}
        className={cn(
          "pdf-preview-scroll relative flex-1 overflow-auto",
          mobilePreview ? "px-2 py-2 pb-[calc(2.75rem+env(safe-area-inset-bottom))]" : "p-6 md:p-10",
        )}
        onTouchStart={handlePinchTouchStart}
        onTouchMove={handlePinchTouchMove}
        onTouchEnd={handlePinchTouchEnd}
        onTouchCancel={handlePinchTouchEnd}
      >
        {(loading || renderFitWidth === null) && (
          <div className="flex min-h-[280px] items-center justify-center text-[#71717a]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading PDF…
          </div>
        )}

        {error && !loading && (
          <div className="flex min-h-[280px] items-center justify-center p-8 text-center text-sm text-[#71717a]">
            {error}
          </div>
        )}

        {!loading && !error && pages.length > 0 && (
        <div
          className={cn("mx-auto flex w-full flex-col", mobilePreview ? "gap-3" : "gap-6")}
          style={{ width: `${zoomScale * 100}%`, maxWidth: zoomScale > 1 ? "none" : "100%" }}
        >
          {pages.map((page) => (
            <div
              key={page.pageNumber}
              ref={(el) => {
                pageAnchorRefs.current[page.pageNumber] = el;
              }}
              className={cn("relative w-full", mobilePreview ? "pb-1" : "pb-6")}
            >
              <div
                ref={(el) => {
                  pageRefs.current[page.pageNumber] = el;
                }}
                className={cn(
                  "pdf-page-surface relative mx-auto w-full bg-white select-none",
                  mobilePreview
                    ? "shadow-[0_4px_20px_rgba(0,0,0,0.1)] ring-1 ring-black/8"
                    : "cursor-crosshair shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/10 touch-none",
                )}
                style={{ aspectRatio: `${page.baseWidth} / ${page.baseHeight}` }}
                onPointerDown={(event) => startAreaHighlight(page.pageNumber, event)}
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.dataUrl}
                  alt={`Page ${page.pageNumber}`}
                  className="pointer-events-none absolute inset-0 block h-full w-full select-none"
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-0">
                  {annotations
                    .filter((a) => a.page === page.pageNumber)
                    .flatMap((annotation) =>
                      annotation.rects.map((rect, idx) => (
                        <button
                          key={`${annotation.id}-${idx}`}
                          type="button"
                          title={mobilePreview ? undefined : "Remove highlight"}
                          tabIndex={mobilePreview ? -1 : undefined}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!mobilePreview) removeHighlight(annotation.id);
                          }}
                          className={cn(
                            "absolute transition-opacity",
                            mobilePreview
                              ? "pointer-events-none"
                              : "pointer-events-auto cursor-pointer hover:opacity-60",
                          )}
                          style={{
                            left: `${rect.x * 100}%`,
                            top: `${rect.y * 100}%`,
                            width: `${rect.width * 100}%`,
                            height: `${rect.height * 100}%`,
                            backgroundColor: annotation.color,
                          }}
                          aria-label="Remove highlight"
                        />
                      )),
                    )}
                  {dragHighlight?.pageNumber === page.pageNumber && (
                    <div
                      className="absolute border border-[#7c3aed]/70"
                      style={{
                        left: `${(Math.min(dragHighlight.startX, dragHighlight.currentX) / dragHighlight.pageWidth) * 100}%`,
                        top: `${(Math.min(dragHighlight.startY, dragHighlight.currentY) / dragHighlight.pageHeight) * 100}%`,
                        width: `${(Math.abs(dragHighlight.currentX - dragHighlight.startX) / dragHighlight.pageWidth) * 100}%`,
                        height: `${(Math.abs(dragHighlight.currentY - dragHighlight.startY) / dragHighlight.pageHeight) * 100}%`,
                        backgroundColor: activeColor,
                      }}
                    />
                  )}
                </div>
              </div>
              {!mobilePreview && (
                <span className="absolute bottom-0 left-0 text-[10px] text-[#71717a]">
                  Page {page.pageNumber}
                </span>
              )}
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
});

export { parsePdfAnnotations };