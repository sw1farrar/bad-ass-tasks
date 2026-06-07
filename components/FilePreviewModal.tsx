"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ImagePreviewModal } from "@/features/notes/editor/components/ImagePreviewModal";
import {
  PdfAnnotationPreview,
  type PdfAnnotationPreviewHandle,
} from "@/components/PdfAnnotationPreview";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { ExcelPreview } from "@/components/ExcelPreview";
import type { PdfHighlightAnnotation } from "@/lib/pdf/annotations";
import { cn } from "@/lib/utils";

export type FilePreviewTarget = {
  url: string;
  fileName: string;
  mimeType?: string;
  attachmentId?: string;
  noteId?: string;
  pdfAnnotations?: PdfHighlightAnnotation[];
};

interface FilePreviewModalProps {
  file: FilePreviewTarget | null;
  onClose: () => void;
  onPdfAnnotationsSaved?: (attachmentId: string, annotations: PdfHighlightAnnotation[]) => void;
}

function isImageMime(mime?: string, fileName?: string): boolean {
  if (mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName ?? "");
}

function isPdfMime(mime?: string, fileName?: string): boolean {
  if (mime === "application/pdf") return true;
  return /\.pdf$/i.test(fileName ?? "");
}

function isDocxMime(mime?: string, fileName?: string): boolean {
  if (mime?.includes("wordprocessingml")) return true;
  return /\.docx$/i.test(fileName ?? "");
}

function isXlsxMime(mime?: string, fileName?: string): boolean {
  if (mime?.includes("spreadsheetml")) return true;
  return /\.xlsx?$/i.test(fileName ?? "");
}

function OfficeLoadingState() {
  return (
    <div className="flex min-h-[280px] items-center justify-center px-8 py-16 text-[#71717a]">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Preparing preview…
    </div>
  );
}

function OfficeErrorState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center bg-white p-8 text-center text-sm text-[#71717a]">
      {message}
    </div>
  );
}

function DocxPreview({ file }: { file: FilePreviewTarget }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const bodyContainer = bodyRef.current;
      const styleContainer = styleRef.current;
      if (!bodyContainer) return;

      setLoading(true);
      setError(null);
      bodyContainer.innerHTML = "";
      if (styleContainer) styleContainer.innerHTML = "";

      try {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error("fetch_failed");
        const buffer = await response.arrayBuffer();
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;

        await renderAsync(buffer, bodyContainer, styleContainer ?? undefined, {
          className: "docx-preview",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          renderAltChunks: true,
          experimental: true,
          useBase64URL: true,
        });
      } catch {
        if (!cancelled) setError("Preview unavailable. Download the file instead.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (bodyRef.current) bodyRef.current.innerHTML = "";
      if (styleRef.current) styleRef.current.innerHTML = "";
    };
  }, [file.url, file.mimeType, file.fileName]);

  if (error) return <OfficeErrorState message={error} />;

  return (
    <div className="docx-preview-root relative min-h-[280px]">
      <div ref={styleRef} className="docx-preview-styles" aria-hidden />
      {loading ? <OfficeLoadingState /> : null}
      <div
        ref={bodyRef}
        className={cn("docx-preview-body", loading && "invisible absolute inset-0 overflow-hidden")}
      />
    </div>
  );
}

function OfficePreview({ file }: { file: FilePreviewTarget }) {
  if (isDocxMime(file.mimeType, file.fileName)) {
    return <DocxPreview file={file} />;
  }
  if (isXlsxMime(file.mimeType, file.fileName)) {
    return <ExcelPreview url={file.url} />;
  }
  return null;
}

export function FilePreviewModal({ file, onClose, onPdfAnnotationsSaved }: FilePreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [pdfDirty, setPdfDirty] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const pdfRef = useRef<PdfAnnotationPreviewHandle>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!file) {
      setPdfDirty(false);
      setShowSavePrompt(false);
    }
  }, [file]);

  const finishClose = useCallback(() => {
    setPdfDirty(false);
    setShowSavePrompt(false);
    onClose();
  }, [onClose]);

  const attemptClose = useCallback(() => {
    const isPdf = file && isPdfMime(file.mimeType, file.fileName);
    if (isPdf && file?.attachmentId && pdfRef.current?.isDirty()) {
      setShowSavePrompt(true);
      return;
    }
    finishClose();
  }, [file, finishClose]);

  const close = useCallback(() => attemptClose(), [attemptClose]);

  useEffect(() => {
    if (!file) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [file, close]);

  useEffect(() => {
    if (!file) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [file]);

  if (!mounted || !file) return null;

  if (isImageMime(file.mimeType, file.fileName)) {
    return <ImagePreviewModal src={file.url} alt={file.fileName} onClose={finishClose} />;
  }

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const showPdf = isPdfMime(file.mimeType, file.fileName);
  const showOffice = isDocxMime(file.mimeType, file.fileName) || isXlsxMime(file.mimeType, file.fileName);

  const handleSaveHighlights = async () => {
    const ok = await pdfRef.current?.save();
    if (!ok) {
      toast.error("Could not save highlights");
      throw new Error("save_failed");
    }
    toast.success("Highlights saved");
  };

  return createPortal(
    <>
      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999]"
            role="dialog"
            aria-modal="true"
            aria-label="File preview"
          >
            <div
              className="absolute inset-0 bg-[#050508]/90 backdrop-blur-xl"
              onClick={close}
              aria-hidden
            />

            <div className="relative z-10 flex h-full w-full flex-col pointer-events-none p-4 md:p-6">
              <div
                className="pointer-events-auto mb-3 flex shrink-0 items-center justify-between gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex min-w-0 items-center gap-2 text-sm text-white/80">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{file.fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
                    aria-label="Close preview"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Click outside the document (gray margin) closes the modal */}
              <div
                className="pointer-events-auto flex flex-1 min-h-0 items-start justify-center overflow-hidden"
                onClick={close}
              >
                <div
                  className={cn(
                    "flex h-full max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.45)]",
                    showOffice || showPdf ? "bg-[#e8e8e6]" : "bg-[#18181b]",
                  )}
                >
                  {showPdf ? (
                    <PdfAnnotationPreview
                      ref={pdfRef}
                      url={file.url}
                      attachmentId={file.attachmentId}
                      noteId={file.noteId}
                      initialAnnotations={file.pdfAnnotations}
                      onDirtyChange={setPdfDirty}
                      onSaved={(annotations) => {
                        if (file.attachmentId) {
                          onPdfAnnotationsSaved?.(file.attachmentId, annotations);
                        }
                      }}
                    />
                  ) : showOffice ? (
                    isXlsxMime(file.mimeType, file.fileName) ? (
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" onClick={close}>
                        <div className="min-h-0 flex-1" onClick={(e) => e.stopPropagation()}>
                          <OfficePreview file={file} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto" onClick={close}>
                        <div
                          className="mx-auto w-full max-w-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <OfficePreview file={file} />
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-white/60">
                      <p>Preview is not available for this file type.</p>
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="rounded-xl border border-white/10 px-4 py-2 text-white/80 hover:bg-white/10"
                      >
                        Download file
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <p className="pointer-events-none mt-2 text-center text-[10px] tracking-widest text-white/35">
                Click outside the document to close · ESC
                {showPdf && pdfDirty ? " · unsaved highlights" : ""}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        open={showSavePrompt}
        onOpenChange={(open) => {
          if (!open) {
            finishClose();
          } else {
            setShowSavePrompt(true);
          }
        }}
        title="Save PDF highlights?"
        highlight={file?.fileName}
        description="You have unsaved highlight markups on this PDF."
        confirmText="Save & close"
        cancelText="Discard"
        onConfirm={handleSaveHighlights}
      />
    </>,
    document.body,
  );
}