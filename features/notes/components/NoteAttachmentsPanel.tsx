"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Paperclip,
  Upload,
  Trash2,
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { Note } from "@/types";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { isWordFile, isXlsxPreviewable } from "@/lib/preview/officeMime";
import type { PdfHighlightAnnotation } from "@/lib/pdf/annotations";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type NoteAttachmentRow = {
  id: string;
  noteId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  source: "email" | "upload";
  createdAt: string;
  previewUrl: string | null;
  pdfAnnotations?: PdfHighlightAnnotation[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(mimeType: string, fileName: string): boolean {
  return mimeType.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(fileName);
}

type AttachmentFileKind = "word" | "excel" | "pdf" | "generic";

function isWordAttachment(mimeType: string, fileName: string): boolean {
  return isWordFile(mimeType, fileName);
}

function isExcelAttachment(mimeType: string, fileName: string): boolean {
  return isXlsxPreviewable(mimeType, fileName);
}

function isPdfAttachment(mimeType: string, fileName: string): boolean {
  return mimeType === "application/pdf" || /\.pdf$/i.test(fileName);
}

function getAttachmentFileKind(mimeType: string, fileName: string): AttachmentFileKind {
  if (isWordAttachment(mimeType, fileName)) return "word";
  if (isExcelAttachment(mimeType, fileName)) return "excel";
  if (isPdfAttachment(mimeType, fileName)) return "pdf";
  return "generic";
}

const ATTACHMENT_FILE_STYLES: Record<
  AttachmentFileKind,
  { railClass: string; label: string }
> = {
  word: { railClass: "bg-[#185ABD]", label: "Word" },
  excel: { railClass: "bg-[#217346]", label: "Excel" },
  pdf: { railClass: "bg-[#DC2626]", label: "PDF" },
  generic: { railClass: "bg-[#e4e4e7]", label: "File" },
};

function AttachmentFileTypeIcon({ kind }: { kind: AttachmentFileKind }) {
  if (kind === "word") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
          fill="rgba(255,255,255,0.18)"
        />
        <path d="M15 3v5h5" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
        <text
          x="12"
          y="16.75"
          fill="white"
          fontSize="9.5"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          W
        </text>
      </svg>
    );
  }

  if (kind === "excel") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" fill="rgba(255,255,255,0.18)" />
        <path
          d="M7 8h10M7 12h10M7 16h10M11 8v8M15 8v8"
          stroke="white"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.85"
        />
        <text
          x="12"
          y="16.5"
          fill="white"
          fontSize="8"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          X
        </text>
      </svg>
    );
  }

  if (kind === "pdf") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
          fill="rgba(255,255,255,0.18)"
        />
        <path d="M15 3v5h5" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
        <text
          x="12"
          y="16.5"
          fill="white"
          fontSize="6.5"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          PDF
        </text>
      </svg>
    );
  }

  return <FileText className="h-4 w-4 text-[#52525b]" aria-hidden="true" />;
}

function AttachmentRemoveButton({
  compact,
  fileName,
  onRemove,
}: {
  compact: boolean;
  fileName: string;
  onRemove: () => void;
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute -right-0.5 -top-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-black/12 bg-white/95 text-[#52525b] shadow-sm active:scale-95 touch-manipulation"
        aria-label={`Remove ${fileName}`}
      >
        <X className="h-2 w-2" strokeWidth={2.5} aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className="absolute -right-1 -top-1 rounded-full border border-black/10 bg-white p-1 text-[#71717a] opacity-0 shadow-md transition-opacity hover:text-red-500 group-hover:opacity-100"
      aria-label={`Delete ${fileName}`}
    >
      <Trash2 className="h-3 w-3" aria-hidden />
    </button>
  );
}

function AttachmentIconSkeleton({
  wide = false,
  compact = false,
}: {
  wide?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "shrink-0 animate-pulse border border-[var(--note-canvas-border,rgba(24,24,27,0.12))] bg-black/[0.06]",
        compact
          ? "h-9 w-9 rounded-md"
          : cn("h-12 rounded-lg", wide ? "w-[7.75rem]" : "w-12"),
      )}
      aria-hidden
    />
  );
}

interface NoteAttachmentsPanelProps {
  selectedNote: Note;
  /** Render as footer inside the note editor card */
  embedded?: boolean;
  /** Mobile drawer — tighter layout + native photo picker */
  compact?: boolean;
  /** Known count from workspace-level cache while per-note details load */
  countHint?: number;
  /** Workspace attachment counts have finished loading (enables skip when count is 0) */
  countsReady?: boolean;
  onCountChange?: (noteId: string, count: number) => void;
}

export function NoteAttachmentsPanel({
  selectedNote,
  embedded = false,
  compact = false,
  countHint,
  countsReady = false,
  onCountChange,
}: NoteAttachmentsPanelProps) {
  const [attachments, setAttachments] = useState<NoteAttachmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    fileName: string;
    mimeType: string;
    attachmentId: string;
    noteId: string;
    pdfAnnotations?: PdfHighlightAnnotation[];
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NoteAttachmentRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileViewport(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const useNativePhotoPicker = compact || isMobileViewport;

  const syncCount = useCallback(
    (list: NoteAttachmentRow[]) => {
      onCountChange?.(selectedNote.id, list.length);
    },
    [onCountChange, selectedNote.id],
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const noteId = selectedNote.id;
    let cancelled = false;

    // Wait for workspace counts before deciding whether a fetch is needed.
    if (!countsReady) {
      setAttachments([]);
      setLoading(false);
      return;
    }

    const expectedCount = countHint ?? 0;
    if (expectedCount === 0) {
      setAttachments([]);
      setLoading(false);
      return;
    }

    setAttachments([]);
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch(`/api/notes/${noteId}/attachments`);
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const list = data.attachments ?? [];
        setAttachments(list);
        onCountChange?.(noteId, list.length);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedNote.id, onCountChange, countHint, countsReady]);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || uploading) return;
    setUploading(true);
    try {
      const added: NoteAttachmentRow[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/notes/${selectedNote.id}/attachments`, {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Upload failed");
          continue;
        }
        if (data.attachment) {
          added.push({
            ...data.attachment,
            createdAt: new Date().toISOString(),
          });
        }
      }
      if (added.length) {
        setAttachments((prev) => {
          const next = [...added, ...prev];
          syncCount(next);
          return next;
        });
        toast.success("File attached");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    const res = await fetch(`/api/notes/${selectedNote.id}/attachments/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not delete attachment");
      return;
    }
    setAttachments((prev) => {
      const next = prev.filter((a) => a.id !== id);
      syncCount(next);
      return next;
    });
    toast.success("Attachment removed");
  };

  const openPreview = (att: NoteAttachmentRow) => {
    if (!att.previewUrl) {
      toast.error("Preview URL unavailable");
      return;
    }
    setPreviewFile({
      url: att.previewUrl,
      fileName: att.fileName,
      mimeType: att.mimeType,
      attachmentId: att.id,
      noteId: selectedNote.id,
      pdfAnnotations: att.pdfAnnotations,
    });
  };

  if (!isSupabaseConfigured()) return null;

  if (!embedded && !loading && attachments.length === 0) return null;

  const displayCount = loading
    ? countHint && countHint > 0
      ? countHint
      : null
    : attachments.length > 0
      ? attachments.length
      : null;

  const skeletonCount =
    loading && (countHint ?? 0) > 0
      ? Math.min(Math.max(countHint ?? 1, 1), 6)
      : 0;

  return (
    <>
      <div
        className={cn(
          embedded
            ? cn(
                "note-attachments-embedded border-b border-[var(--note-canvas-border,rgba(24,24,27,0.1))] bg-[var(--note-canvas-bg,#f8f8f6)]",
                compact ? "note-attachments-embedded--compact px-3 py-1" : "px-3 py-2 md:px-4",
              )
            : "border-t border-[var(--note-canvas-border,rgba(24,24,27,0.1))] px-4 md:px-6 py-4 space-y-3",
        )}
      >
        <div className={cn("flex items-center justify-between gap-2", compact ? "mb-1" : "mb-2")}>
          <div
            className={cn(
              "flex items-center gap-1 text-[var(--note-canvas-text-muted,#71717a)]",
              compact
                ? "text-[9px] uppercase tracking-wide"
                : "gap-1.5 text-[10px] uppercase tracking-widest",
            )}
          >
            <Paperclip className={cn("text-[#7c3aed]", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
            Attachments
            {loading && (countHint ?? 0) > 0 && (
              <Loader2
                className={cn("animate-spin text-[#7c3aed]/70", compact ? "h-2.5 w-2.5" : "h-3 w-3")}
                aria-hidden
              />
            )}
            {displayCount != null && displayCount > 0 && (
              <span
                className={cn(
                  "rounded-full bg-black/5 font-mono text-[var(--note-canvas-text-secondary,#52525b)]",
                  compact ? "px-1 py-0 text-[8px]" : "px-1.5 py-0.5 text-[9px]",
                  loading && "opacity-70",
                )}
                title={loading ? `Loading ${displayCount} attachment${displayCount === 1 ? "" : "s"}` : undefined}
              >
                {displayCount}
              </span>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={useNativePhotoPicker ? "image/*" : undefined}
              className="hidden"
              aria-hidden
              onChange={(e) => handleUpload(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                "flex items-center justify-center border border-[var(--note-canvas-border,rgba(24,24,27,0.1))] bg-white text-[var(--note-canvas-text,#18181b)] hover:bg-black/5 disabled:opacity-50 touch-manipulation transition-colors",
                compact
                  ? "h-6 w-6 min-h-6 min-w-6 rounded-md p-0"
                  : "gap-1 rounded-lg px-2 py-1 text-[10px]",
              )}
              aria-label={useNativePhotoPicker ? "Attach photo or take picture" : "Attach file"}
              title={useNativePhotoPicker ? "Photo library or camera" : "Attach file"}
            >
              {uploading ? (
                <Loader2 className={cn("animate-spin", compact ? "h-3 w-3" : "h-3 w-3")} />
              ) : (
                <Upload className={cn(compact ? "h-3 w-3" : "h-3 w-3")} />
              )}
              {!compact && "Attach"}
            </button>
          </div>
        </div>

        {loading && skeletonCount > 0 ? (
          <div className={cn(compact ? "space-y-1" : "space-y-2")} role="status" aria-live="polite" aria-label="Loading attachments">
            <div className={cn("flex flex-wrap", compact ? "gap-1" : "gap-1.5")}>
              {Array.from({ length: skeletonCount }).map((_, index) => (
                <AttachmentIconSkeleton
                  key={index}
                  wide={!compact && index % 3 === 1}
                  compact={compact}
                />
              ))}
            </div>
            {!compact && (
              <div className="flex items-center gap-1.5 text-xs text-[#71717a]">
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                <span>
                  {displayCount != null && displayCount > 0
                    ? `Loading ${displayCount} attachment${displayCount === 1 ? "" : "s"}…`
                    : "Loading attachments…"}
                </span>
              </div>
            )}
          </div>
        ) : attachments.length === 0 ? (
          embedded ? null : (
            <div className="text-xs text-[#71717a] py-1">
              Email attachments and manual uploads appear here.
            </div>
          )
        ) : (
          <div className={cn("flex flex-wrap", compact ? "gap-1" : "gap-1.5")}>
            {attachments.map((att) => {
              const isImage = isImageAttachment(att.mimeType, att.fileName);
              const thumbSize = compact ? "h-9 w-9" : "h-12 w-12";
              const thumbRadius = compact ? "rounded-md" : "rounded-lg";

              if (isImage) {
                return (
                  <div key={att.id} className="group relative shrink-0">
                    <button
                      type="button"
                      onClick={() => openPreview(att)}
                      className={cn(
                        "relative overflow-hidden border border-[var(--note-canvas-border,rgba(24,24,27,0.12))] bg-white hover:border-[#7c3aed]/35 shadow-sm transition-colors",
                        thumbSize,
                        thumbRadius,
                      )}
                      title={att.fileName}
                    >
                      {att.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={att.previewUrl}
                          alt={att.fileName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#71717a]">
                          <ImageIcon className={compact ? "h-4 w-4" : "h-5 w-5"} />
                        </div>
                      )}
                    </button>
                    <AttachmentRemoveButton
                      compact={compact}
                      fileName={att.fileName}
                      onRemove={() => setPendingDelete(att)}
                    />
                  </div>
                );
              }

              const fileKind = getAttachmentFileKind(att.mimeType, att.fileName);
              const fileStyle = ATTACHMENT_FILE_STYLES[fileKind];
              return (
                <div
                  key={att.id}
                  className={cn(
                    "group relative flex shrink-0 overflow-hidden border border-[var(--note-canvas-border,rgba(24,24,27,0.12))] bg-white shadow-sm",
                    compact ? "h-9 w-[6.25rem] rounded-md" : "h-12 w-[7.75rem] rounded-lg",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openPreview(att)}
                    className="flex min-w-0 flex-1 text-left hover:opacity-95"
                    title={att.fileName}
                  >
                    <div
                      className={cn(
                        "flex shrink-0 items-center justify-center",
                        compact ? "w-7" : "w-9",
                        fileStyle.railClass,
                      )}
                      aria-label={fileStyle.label}
                    >
                      <AttachmentFileTypeIcon kind={fileKind} />
                    </div>
                    <div className={cn("flex min-w-0 flex-1 flex-col justify-center", compact ? "px-1 py-0.5" : "px-1.5 py-1")}>
                      <span
                        className={cn(
                          "truncate font-medium leading-tight text-[var(--note-canvas-text,#18181b)]",
                          compact ? "text-[9px]" : "text-[10px]",
                        )}
                      >
                        {att.fileName}
                      </span>
                      <div
                        className={cn(
                          "truncate leading-tight text-[var(--note-canvas-text-muted,#71717a)]",
                          compact ? "text-[8px]" : "text-[9px]",
                        )}
                      >
                        {formatBytes(att.sizeBytes)}
                        {att.source === "email" && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[var(--note-canvas-text-secondary,#52525b)]">
                            <Mail className="h-3 w-3" /> Email
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <AttachmentRemoveButton
                    compact={compact}
                    fileName={att.fileName}
                    onRemove={() => setPendingDelete(att)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onPdfAnnotationsSaved={(attachmentId, annotations) => {
          setAttachments((prev) =>
            prev.map((a) => (a.id === attachmentId ? { ...a, pdfAnnotations: annotations } : a)),
          );
        }}
      />

      <ConfirmationModal
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        onConfirm={handleDelete}
        title="Remove attachment?"
        highlight={pendingDelete?.fileName}
        description="The file will be permanently removed from this note."
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}