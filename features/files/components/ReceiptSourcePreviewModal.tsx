"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, FileText, Loader2, X } from "lucide-react";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { ReceiptEmailPreviewPanel } from "./ReceiptEmailPreviewPanel";
import { isImageMime } from "@/lib/preview/imageMime";
import {
  buildReceiptPreviewSlidesForNote,
  resolveReceiptNoteEmailPreview,
  type ReceiptEmailPreviewContent,
  type ReceiptPreviewSlide,
} from "@/lib/files/receiptPreview";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useTaskStore } from "@/store/useTaskStore";
import { toast } from "sonner";

interface ReceiptSourcePreviewModalProps {
  noteId: string | null;
  label: string;
  onClose: () => void;
}

type PreviewMode = "loading" | "attachment" | "email" | null;

export function ReceiptSourcePreviewModal({
  noteId,
  label,
  onClose,
}: ReceiptSourcePreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<PreviewMode>(null);
  const [slides, setSlides] = useState<ReceiptPreviewSlide[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [emailPreview, setEmailPreview] = useState<ReceiptEmailPreviewContent | null>(null);
  const hydrateNoteDetail = useTaskStore((s) => s.hydrateNoteDetail);

  const isOpen = !!noteId;

  useScrollLock(isOpen && mode !== null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !noteId) {
      setMode(null);
      setSlides([]);
      setSlideIndex(0);
      setEmailPreview(null);
      return;
    }

    let cancelled = false;
    setMode("loading");
    setSlides([]);
    setSlideIndex(0);
    setEmailPreview(null);

    void (async () => {
      try {
        const nextSlides = await buildReceiptPreviewSlidesForNote(noteId, label);
        if (cancelled) return;

        if (nextSlides.length > 0) {
          setSlides(nextSlides);
          setMode("attachment");
          return;
        }

        const note = await hydrateNoteDetail(noteId);
        if (cancelled) return;

        if (!note) {
          toast.error("Could not load receipt file");
          onClose();
          return;
        }

        const email = resolveReceiptNoteEmailPreview(note);
        if (!email) {
          toast.error("No receipt preview available", {
            description: "This item has no image attachment or email body to preview.",
          });
          onClose();
          return;
        }

        setEmailPreview(email);
        setMode("email");
      } catch {
        if (cancelled) return;
        toast.error("Could not load receipt preview");
        onClose();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, noteId, label, hydrateNoteDetail, onClose]);

  const handleClose = useCallback(() => {
    setMode(null);
    setSlides([]);
    setSlideIndex(0);
    setEmailPreview(null);
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
    if (mode !== "attachment" || !showNav || currentIsImage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, showNav, currentIsImage, goPrev, goNext]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <>
      {mode === "loading" ? (
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-[#050508]/90 backdrop-blur-xl"
          role="status"
          aria-live="polite"
          aria-label="Loading receipt preview"
        >
          <div className="flex items-center gap-2 rounded-2xl border border-border-glass bg-bg-secondary px-4 py-3 text-sm text-text-secondary shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-neon-purple" aria-hidden />
            Loading receipt…
          </div>
        </div>
      ) : null}

      {mode === "attachment" ? (
        <>
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
                    aria-label="Previous receipt image"
                  >
                    <ChevronLeft className="h-6 w-6" aria-hidden />
                  </button>

                  <button
                    type="button"
                    onClick={goNext}
                    className="receipt-source-preview-arrow receipt-source-preview-arrow--right"
                    aria-label="Next receipt image"
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
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {mode === "email" && emailPreview ? (
        <div
          className="file-preview-overlay fixed inset-0 z-[10050]"
          role="dialog"
          aria-modal="true"
          aria-label="Receipt email preview"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#050508]/90 backdrop-blur-xl"
            onClick={handleClose}
            aria-label="Close preview"
          />

          <div className="receipt-email-preview-shell relative z-10 flex h-full w-full flex-col p-4 md:p-6 pointer-events-none">
            <div className="pointer-events-auto mb-3 flex shrink-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-sm text-white/85">
                <FileText className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{emailPreview.title || label}</span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-glass bg-black/55 text-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-md hover:bg-black/70"
                aria-label="Close preview"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="receipt-email-preview-panel pointer-events-auto min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border-glass bg-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
              <ReceiptEmailPreviewPanel preview={emailPreview} />
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}