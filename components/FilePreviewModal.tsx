"use client";

import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, FileText, Loader2 } from "lucide-react";
import { PreviewMobileActions } from "@/components/PreviewMobileActions";
import { toast } from "sonner";
import { ImagePreviewModal } from "@/features/notes/editor/components/ImagePreviewModal";
import {
  PdfAnnotationPreview,
  type PdfAnnotationPreviewHandle,
} from "@/components/PdfAnnotationPreview";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { ExcelPreview } from "@/components/ExcelPreview";
import type { PdfHighlightAnnotation } from "@/lib/pdf/annotations";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import {
  isDocxPreviewable,
  isLegacyWordDoc,
  isWordFile,
  isXlsxPreviewable,
  resolvePreviewMimeType,
} from "@/lib/preview/officeMime";
import {
  detectWordDocumentFormat,
  legacyWordBodyToParagraphs,
} from "@/lib/preview/legacyWordDocShared";
import { buildNoteAttachmentPreviewUrl } from "@/lib/notes/attachmentUrls";
import { cn, triggerHaptic } from "@/lib/utils";

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

function OfficeLoadingState({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center text-text-muted",
        compact ? "min-h-[50dvh] px-6" : "min-h-[280px] px-8 py-16",
      )}
    >
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Preparing preview…
    </div>
  );
}

function OfficeErrorState({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "file-preview-stage flex items-center justify-center p-8 text-center text-sm text-text-muted",
        compact ? "min-h-[50dvh]" : "min-h-[280px]",
      )}
    >
      {message}
    </div>
  );
}

const DOCX_PREVIEW_OPTIONS = {
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
  renderAltChunks: false,
  experimental: true,
  useBase64URL: true,
} as const;

function LegacyDocTextPreview({
  paragraphs,
  footnotes,
  endnotes,
  compact = false,
}: {
  paragraphs: string[];
  footnotes: string;
  endnotes: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "legacy-doc-preview-root w-full max-w-full",
        compact ? "legacy-doc-preview-root--compact min-h-0" : "min-h-[280px]",
      )}
    >
      <p className="legacy-doc-preview-hint">
        Word document — text preview; layout may differ from Microsoft Word.
      </p>
      <article className="legacy-doc-preview-sheet">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="legacy-doc-preview-paragraph">
            {paragraph}
          </p>
        ))}
        {footnotes ? (
          <section className="legacy-doc-preview-notes">
            <h3 className="legacy-doc-preview-notes__title">Footnotes</h3>
            <div className="legacy-doc-preview-notes__body whitespace-pre-wrap">{footnotes}</div>
          </section>
        ) : null}
        {endnotes ? (
          <section className="legacy-doc-preview-notes">
            <h3 className="legacy-doc-preview-notes__title">Endnotes</h3>
            <div className="legacy-doc-preview-notes__body whitespace-pre-wrap">{endnotes}</div>
          </section>
        ) : null}
      </article>
    </div>
  );
}

type WordTextPreviewContent = {
  paragraphs: string[];
  footnotes: string;
  endnotes: string;
};

function parseWordTextPreview(data: {
  ok?: boolean;
  body?: string;
  footnotes?: string;
  endnotes?: string;
}): WordTextPreviewContent | null {
  if (!data.ok) return null;

  const bodyParagraphs = legacyWordBodyToParagraphs(data.body ?? "");
  const footnoteText = (data.footnotes ?? "").trim();
  const endnoteText = (data.endnotes ?? "").trim();

  if (bodyParagraphs.length === 0 && !footnoteText && !endnoteText) {
    return null;
  }

  return {
    paragraphs: bodyParagraphs,
    footnotes: footnoteText,
    endnotes: endnoteText,
  };
}

type WordPreviewMode = "loading" | "text" | "docx" | "error";

function WordDocumentPreview({ file, compact = false }: { file: FilePreviewTarget; compact?: boolean }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const textPreviewRef = useRef<WordTextPreviewContent | null>(null);
  const [mode, setMode] = useState<WordPreviewMode>("loading");
  const [error, setError] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<WordTextPreviewContent | null>(null);
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setMode("loading");
      setError(null);
      setTextPreview(null);
      setDocxBuffer(null);
      textPreviewRef.current = null;

      if (bodyRef.current) bodyRef.current.innerHTML = "";
      if (styleRef.current) styleRef.current.innerHTML = "";

      try {
        const previewUrl =
          file.noteId && file.attachmentId
            ? buildNoteAttachmentPreviewUrl(file.noteId, file.attachmentId)
            : null;

        const [fileResponse, textPreviewResult] = await Promise.all([
          fetch(file.url, { credentials: "include" }),
          previewUrl
            ? fetch(previewUrl, { credentials: "include" })
                .then(async (response) => {
                  const data = (await response.json()) as {
                    ok?: boolean;
                    body?: string;
                    footnotes?: string;
                    endnotes?: string;
                  };
                  return response.ok ? parseWordTextPreview(data) : null;
                })
                .catch(() => null)
            : Promise.resolve(null),
        ]);

        if (!fileResponse.ok) throw new Error("fetch_failed");

        const contentType = fileResponse.headers.get("content-type")?.toLowerCase() ?? "";
        if (contentType.includes("application/json")) {
          throw new Error("fetch_failed");
        }

        const buffer = await fileResponse.arrayBuffer();
        if (buffer.byteLength < 4) throw new Error("empty_file");
        if (cancelled) return;

        if (textPreviewResult) {
          textPreviewRef.current = textPreviewResult;
          setTextPreview(textPreviewResult);
        }

        if (detectWordDocumentFormat(buffer) === "docx") {
          setDocxBuffer(buffer);
          return;
        }

        if (textPreviewResult) {
          setMode("text");
          return;
        }
        throw new Error("preview_unavailable");
      } catch {
        if (!cancelled) {
          setMode("error");
          setError("Preview unavailable. Download the file to open it in Word.");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (bodyRef.current) bodyRef.current.innerHTML = "";
      if (styleRef.current) styleRef.current.innerHTML = "";
    };
  }, [file.url, file.noteId, file.attachmentId]);

  useLayoutEffect(() => {
    if (!docxBuffer) return;

    const bodyContainer = bodyRef.current;
    const styleContainer = styleRef.current;
    if (!bodyContainer) return;

    let cancelled = false;

    void (async () => {
      bodyContainer.innerHTML = "";
      if (styleContainer) styleContainer.innerHTML = "";

      try {
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;

        await renderAsync(docxBuffer, bodyContainer, styleContainer ?? undefined, DOCX_PREVIEW_OPTIONS);
        if (!cancelled) setMode("docx");
      } catch {
        if (!cancelled) {
          setDocxBuffer(null);
          if (textPreviewRef.current) {
            setMode("text");
          } else {
            setMode("error");
            setError("Preview unavailable. Download the file to open it in Word.");
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [docxBuffer]);

  if (mode === "error" && error) {
    return <OfficeErrorState message={error} compact={compact} />;
  }

  if (mode === "text" && textPreview) {
    return (
      <LegacyDocTextPreview
        paragraphs={textPreview.paragraphs}
        footnotes={textPreview.footnotes}
        endnotes={textPreview.endnotes}
        compact={compact}
      />
    );
  }

  const docxRendering = mode === "loading" || (docxBuffer != null && mode !== "docx");

  return (
    <div
      className={cn(
        "docx-preview-root relative w-full max-w-full",
        compact ? "docx-preview-root--compact min-h-0" : "min-h-[280px]",
      )}
    >
      <div ref={styleRef} className="docx-preview-styles" aria-hidden />
      {docxRendering ? (
        <div className={cn(compact ? "docx-preview-loading-overlay" : "relative")}>
          <OfficeLoadingState compact={compact} />
        </div>
      ) : null}
      <div
        ref={bodyRef}
        className={cn(
          "docx-preview-body",
          docxRendering && !compact && "invisible absolute inset-0 overflow-hidden",
        )}
      />
    </div>
  );
}

function OfficePreview({ file, compact = false }: { file: FilePreviewTarget; compact?: boolean }) {
  if (isWordFile(file.mimeType, file.fileName)) {
    return <WordDocumentPreview file={file} compact={compact} />;
  }
  if (isXlsxPreviewable(file.mimeType, file.fileName)) {
    return <ExcelPreview url={file.url} compact={compact} />;
  }
  return null;
}

export function FilePreviewModal({ file, onClose, onPdfAnnotationsSaved }: FilePreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [pdfDirty, setPdfDirty] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const pdfRef = useRef<PdfAnnotationPreviewHandle>(null);
  const isMobile = useIsMobileViewport();

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
    triggerHaptic("light");
    onClose();
  }, [onClose]);

  const attemptClose = useCallback(() => {
    const isPdf = file && isPdfMime(resolvePreviewMimeType(file.mimeType, file.fileName), file.fileName);
    if (isPdf && file?.attachmentId && pdfRef.current?.isDirty()) {
      setShowSavePrompt(true);
      return;
    }
    finishClose();
  }, [file, finishClose, isMobile]);

  const close = useCallback(() => attemptClose(), [attemptClose]);

  useEffect(() => {
    if (!file) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [file, close]);

  useScrollLock(!!file);

  if (!mounted || !file) return null;

  const resolvedMimeType = resolvePreviewMimeType(file.mimeType, file.fileName);
  const previewFile: FilePreviewTarget = {
    ...file,
    mimeType: resolvedMimeType ?? file.mimeType,
  };

  if (isImageMime(previewFile.mimeType, previewFile.fileName)) {
    return (
      <ImagePreviewModal
        src={previewFile.url}
        alt={previewFile.fileName}
        mimeType={previewFile.mimeType}
        onClose={finishClose}
      />
    );
  }

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = previewFile.url;
    link.download = previewFile.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerHaptic("light");
  };

  const showPdf = isPdfMime(previewFile.mimeType, previewFile.fileName);
  const showDocx = isDocxPreviewable(previewFile.mimeType, previewFile.fileName);
  const showLegacyDoc = isLegacyWordDoc(previewFile.mimeType, previewFile.fileName);
  const showWord = isWordFile(previewFile.mimeType, previewFile.fileName);
  const showOffice =
    showDocx || showLegacyDoc || isXlsxPreviewable(previewFile.mimeType, previewFile.fileName);
  const mobileDocxChrome = isMobile && showWord;

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
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="file-preview-overlay fixed inset-0 z-[10050]"
            role="dialog"
            aria-modal="true"
            aria-label="File preview"
          >
            <button
              type="button"
              className={cn(
                "absolute inset-0",
                isMobile ? "bg-[#050508]/96 backdrop-blur-xl" : "bg-[#050508]/90 backdrop-blur-xl",
              )}
              onClick={close}
              aria-label="Close preview"
            />

            <div
              className={cn(
                "file-preview-shell relative z-10 flex h-full w-full flex-col",
                isMobile ? "pointer-events-auto" : "pointer-events-none p-4 md:p-6",
              )}
            >
              {/* Header — PDF/Word mobile use dedicated in-preview or typed chrome */}
              {mobileDocxChrome ? (
                <div
                  className="file-preview-mobile-chrome file-preview-mobile-chrome--docx pointer-events-auto flex shrink-0 items-center justify-between gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="file-preview-mobile-chrome__leading">
                    <FileText className="h-4 w-4 shrink-0 text-[#2B579A]" aria-hidden />
                    <div className="file-preview-mobile-chrome__meta">
                      <span className="file-preview-mobile-chrome__type">Word document</span>
                      <span className="file-preview-mobile-chrome__name">{previewFile.fileName}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <PreviewMobileActions file={previewFile} />
                    <button
                      type="button"
                      onClick={close}
                      className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-glass bg-black/55 text-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-md active:scale-95"
                      aria-label="Close preview"
                    >
                      <X className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                </div>
              ) : !(isMobile && showPdf) ? (
                <div
                  className={cn(
                    "pointer-events-auto flex shrink-0 items-center justify-between gap-2",
                    isMobile ? "file-preview-mobile-chrome" : "mb-3",
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {!isMobile && (
                    <div className="flex min-w-0 items-center gap-2 text-sm text-white/80">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">{previewFile.fileName}</span>
                    </div>
                  )}

                  <div className={cn("flex items-center gap-2", isMobile && "ml-auto")}>
                    {!isMobile && (
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="flex items-center gap-2 rounded-full border border-border-glass bg-black/40 px-3 py-2 text-xs text-white/80 hover:bg-surface-hover"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    )}
                    {isMobile && <PreviewMobileActions file={previewFile} />}
                    <button
                      type="button"
                      onClick={close}
                      className={cn(
                        "relative z-10 flex items-center justify-center rounded-full text-white/70 hover:bg-surface-hover",
                        isMobile
                          ? "h-11 w-11 shrink-0 border border-border-glass bg-black/55 text-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-md active:scale-95"
                          : "h-9 w-9",
                      )}
                      aria-label="Close preview"
                    >
                      <X className={isMobile ? "h-[18px] w-[18px]" : "h-4 w-4"} />
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Document stage */}
              <div
                className={cn(
                  "pointer-events-auto flex min-h-0 flex-1 items-stretch justify-center overflow-hidden",
                  isMobile && "file-preview-mobile-body",
                )}
                onClick={isMobile ? undefined : close}
              >
                <div
                  className={cn(
                    "flex h-full w-full flex-col overflow-hidden",
                    isMobile
                      ? "max-h-full max-w-full bg-[#e8e8e6]"
                      : cn(
                          "max-h-full max-w-5xl rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.45)]",
                          showOffice || showPdf
                            ? "bg-[#e8e8e6] modal-panel modal-panel--light"
                            : "bg-bg-tertiary modal-panel",
                        ),
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {showPdf ? (
                    <PdfAnnotationPreview
                      ref={pdfRef}
                      url={previewFile.url}
                      attachmentId={previewFile.attachmentId}
                      noteId={previewFile.noteId}
                      initialAnnotations={previewFile.pdfAnnotations}
                      onDirtyChange={setPdfDirty}
                      onSaved={(annotations) => {
                        if (previewFile.attachmentId) {
                          onPdfAnnotationsSaved?.(previewFile.attachmentId, annotations);
                        }
                      }}
                      mobilePreview={isMobile}
                      mobileChrome={
                        isMobile
                          ? {
                              file: {
                                url: previewFile.url,
                                fileName: previewFile.fileName,
                                mimeType: previewFile.mimeType,
                              },
                              onClose: close,
                            }
                          : undefined
                      }
                    />
                  ) : showOffice ? (
                    isXlsxPreviewable(previewFile.mimeType, previewFile.fileName) ? (
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <OfficePreview file={previewFile} compact={isMobile} />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "docx-preview-scroll-host flex-1 min-w-0 min-h-0",
                          isMobile && "pb-[calc(1rem+env(safe-area-inset-bottom))]",
                        )}
                      >
                        <OfficePreview file={previewFile} compact={isMobile} />
                      </div>
                    )
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-white/60">
                      <p>Preview is not available for this file type.</p>
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="rounded-xl border border-border-glass px-4 py-2 text-white/80 hover:bg-surface-hover"
                      >
                        Download file
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {!isMobile && showPdf && pdfDirty && (
                <p className="pointer-events-none mt-2 text-center text-[10px] tracking-wide text-white/40">
                  Unsaved highlights
                </p>
              )}
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
        highlight={previewFile?.fileName}
        description="You have unsaved highlight markups on this PDF."
        confirmText="Save & close"
        cancelText="Discard"
        onConfirm={handleSaveHighlights}
      />
    </>,
    document.body,
  );
}