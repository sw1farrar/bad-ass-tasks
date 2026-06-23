"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { isImageMime } from "@/lib/preview/imageMime";
import {
  buildReceiptPreviewSlides,
  findReceiptPreviewSlideIndex,
  type ReceiptPreviewCatalogEntry,
  type ReceiptPreviewSlide,
} from "@/lib/files/receiptPreview";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { toast } from "sonner";

interface ReceiptSourcePreviewModalProps {
  catalog: ReceiptPreviewCatalogEntry[];
  startNoteId: string | null;
  onClose: () => void;
}

export function ReceiptSourcePreviewModal({
  catalog,
  startNoteId,
  onClose,
}: ReceiptSourcePreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slides, setSlides] = useState<ReceiptPreviewSlide[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);

  const isOpen = !!startNoteId && catalog.length > 0;

  useScrollLock(isOpen && (loading || slides.length > 0));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !startNoteId) {
      setSlides([]);
      setSlideIndex(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSlides([]);
    setSlideIndex(0);

    void (async () => {
      try {
        const nextSlides = await buildReceiptPreviewSlides(catalog);
        if (cancelled) return;
        if (!nextSlides.length) {
          toast.error("No receipt preview available", {
            description: "None of the loaded ledger receipts have an image or PDF to preview.",
          });
          onClose();
          return;
        }

        const startIndex = findReceiptPreviewSlideIndex(nextSlides, startNoteId);
        setSlides(nextSlides);
        setSlideIndex(startIndex >= 0 ? startIndex : 0);
      } catch {
        if (cancelled) return;
        toast.error("Could not load receipt preview");
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, startNoteId, catalog, onClose]);

  const handleClose = useCallback(() => {
    setSlides([]);
    setSlideIndex(0);
    onClose();
  }, [onClose]);

  const currentSlide = slides[slideIndex] ?? null;
  const showNav = slides.length > 1;
  const currentIsImage =
    !!currentSlide &&
    isImageMime(currentSlide.target.mimeType, currentSlide.target.fileName);

  const goPrev = useCallback(() => {
    setSlideIndex((current) => (current > 0 ? current - 1 : slides.length - 1));
  }, [slides.length]);

  const goNext = useCallback(() => {
    setSlideIndex((current) => (current < slides.length - 1 ? current + 1 : 0));
  }, [slides.length]);

  useEffect(() => {
    if (!isOpen || !showNav || currentIsImage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, showNav, currentIsImage, goPrev, goNext]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <>
      {loading ? (
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-[#050508]/90 backdrop-blur-xl"
          role="status"
          aria-live="polite"
          aria-label="Loading receipt preview"
        >
          <div className="flex items-center gap-2 rounded-2xl border border-border-glass bg-bg-secondary px-4 py-3 text-sm text-text-secondary shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-neon-purple" aria-hidden />
            Loading receipts…
          </div>
        </div>
      ) : null}

      <FilePreviewModal
        file={currentSlide?.target ?? null}
        onClose={handleClose}
        imageNavigation={
          showNav && currentIsImage
            ? {
                onPrev: goPrev,
                onNext: goNext,
                label: `Image ${currentSlide.imageIndex + 1} of ${currentSlide.receiptImageCount}`,
              }
            : undefined
        }
      />

      {currentSlide ? (
        <>
          {showNav && !currentIsImage ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="receipt-source-preview-arrow receipt-source-preview-arrow--left"
                aria-label="Previous receipt or image"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>

              <button
                type="button"
                onClick={goNext}
                className="receipt-source-preview-arrow receipt-source-preview-arrow--right"
                aria-label="Next receipt or image"
              >
                <ChevronRight className="h-6 w-6" aria-hidden />
              </button>
            </>
          ) : null}

          <div className="receipt-source-preview-status fixed inset-x-0 bottom-6 z-[10051] flex justify-center px-4 pointer-events-none">
            <div className="receipt-source-preview-status__inner pointer-events-auto text-center">
              <p className="receipt-source-preview-status__label">{currentSlide.label}</p>
              <p className="receipt-source-preview-status__meta tabular-nums">
                Image {currentSlide.imageIndex + 1} of {currentSlide.receiptImageCount}
                {currentSlide.receiptCount > 1 ? (
                  <>
                    <span className="receipt-source-preview-status__divider" aria-hidden>
                      ·
                    </span>
                    Receipt {currentSlide.receiptIndex + 1} of {currentSlide.receiptCount}
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </>
      ) : null}
    </>,
    document.body,
  );
}