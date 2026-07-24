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
import { formatBytes } from "@/lib/files/formatBytes";
import { cn } from "@/lib/utils";
import { AttachmentImageSizeBadge } from "./AttachmentImageSizeBadge";
import {
  fetchNoteAttachments,
  getCachedNoteAttachments,
  invalidateNoteAttachments,
  setCachedNoteAttachments,
} from "@/lib/notes/noteAttachmentListCache";

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

/** Desktop file preview + edit — ~2× the previous compact strip size. */
const DESKTOP_PREVIEW_IMAGE_TILE = "h-20 w-20";
const DESKTOP_PREVIEW_FILE_TILE = "h-20 w-[14.5rem] rounded-lg";
const DESKTOP_PREVIEW_FILE_RAIL = "w-16";
const DESKTOP_PREVIEW_FILE_ICON = "h-10 w-10";
const DESKTOP_PREVIEW_IMAGE_FALLBACK_ICON = "h-8 w-8";

function AttachmentFileTypeIcon({
  kind,
  className = "h-5 w-5",
}: {
  kind: AttachmentFileKind;
  className?: string;
}) {
  if (kind === "word") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
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
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
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
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
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

  return <FileText className={cn(className, "text-text-faint")} aria-hidden="true" />;
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
        className="absolute -right-0.5 -top-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-border-glass bg-bg-elevated text-text-faint shadow-sm active:scale-95 touch-manipulation"
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
      className="absolute -right-1 -top-1 rounded-full border border-[var(--note-canvas-border,rgba(24,24,27,0.14))] bg-[var(--note-canvas-surface,#f0f0ed)] p-1 text-[var(--note-canvas-text-muted,#71717a)] opacity-0 shadow-md transition-opacity hover:text-red-500 group-hover:opacity-100"
      aria-label={`Delete ${fileName}`}
    >
      <Trash2 className="h-3 w-3" aria-hidden />
    </button>
  );
}

function AttachmentIconSkeleton({
  wide = false,
  compact = false,
  previewCompact = false,
}: {
  wide?: boolean;
  compact?: boolean;
  previewCompact?: boolean;
}) {
  return (
    <div
      className={cn(
        "shrink-0 animate-pulse border border-[var(--note-canvas-border,rgba(24,24,27,0.12))] bg-black/[0.06]",
        previewCompact
          ? cn(DESKTOP_PREVIEW_IMAGE_TILE, "rounded-lg")
          : compact
            ? "h-10 w-10 rounded-md"
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
  /** Preview mode — list attachments without upload or delete */
  readOnly?: boolean;
  /** Extra-tight layout for desktop file preview chrome */
  previewCompact?: boolean;
  /** Mobile files gallery owns image thumbnails */
  hideImageAttachments?: boolean;
  /** Keep the panel visible (with upload) even when the note has no attachments yet */
  showWhenEmpty?: boolean;
}

export function NoteAttachmentsPanel({
  selectedNote,
  embedded = false,
  compact = false,
  countHint,
  countsReady = false,
  onCountChange,
  readOnly = false,
  previewCompact = false,
  hideImageAttachments = false,
  showWhenEmpty = false,
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

    const cached = getCachedNoteAttachments(noteId);
    if (cached) {
      setAttachments(cached as NoteAttachmentRow[]);
      setLoading(false);
    } else {
      setAttachments([]);
      setLoading(true);
    }

    void (async () => {
      try {
        const list = (await fetchNoteAttachments(noteId)) as NoteAttachmentRow[];
        if (cancelled) return;
        setAttachments(list);
        const nextCount = list.length;
        if (nextCount !== (countHint ?? 0)) {
          onCountChange?.(noteId, nextCount);
        }
      } catch {
        if (!cancelled && !cached) setAttachments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedNote.id, onCountChange, countHint, countsReady, readOnly]);

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
          setCachedNoteAttachments(selectedNote.id, next);
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
      if (next.length === 0) {
        invalidateNoteAttachments(selectedNote.id);
      } else {
        setCachedNoteAttachments(selectedNote.id, next);
      }
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

  const knownCount = countHint ?? 0;

  if (readOnly) {
    if (!countsReady || knownCount === 0) return null;
    if (!loading && attachments.length === 0) return null;
  }

  if (!embedded && !showWhenEmpty && !loading && attachments.length === 0) return null;

  if (embedded && readOnly && hideImageAttachments) {
    const hasNonImageAttachment = attachments.some(
      (att) => !isImageAttachment(att.mimeType, att.fileName),
    );
    if (!hasNonImageAttachment) return null;
  }

  const displayCount = loading
    ? knownCount > 0
      ? knownCount
      : null
    : attachments.length > 0
      ? attachments.length
      : null;

  const skeletonCount =
    loading && knownCount > 0
      ? Math.min(Math.max(knownCount, 1), previewCompact ? 3 : 6)
      : 0;

  const tight = previewCompact || compact;

  const tileGap = previewCompact ? "gap-2.5" : compact ? "gap-1.5" : "gap-2";
  const iconSizeClass = previewCompact
    ? DESKTOP_PREVIEW_FILE_ICON
    : compact
      ? "h-5 w-5"
      : "h-5 w-5";

  const labelClass = cn(
    "flex items-center gap-1.5 text-[var(--note-canvas-text-muted,#71717a)] shrink-0 font-medium",
    previewCompact
      ? "text-[10px] uppercase tracking-wide"
      : compact
        ? "text-[10px] uppercase tracking-wide"
        : "gap-1.5 text-[11px] uppercase tracking-widest",
  );

  const attachmentsLabel = (
    <div className={labelClass}>
      <Paperclip
        className={cn(
          "text-neon-purple-dark shrink-0",
          previewCompact ? "h-3.5 w-3.5" : compact ? "h-3.5 w-3.5" : "h-4 w-4",
        )}
      />
      Attachments
      {!previewCompact && loading && knownCount > 0 && (
        <Loader2
          className={cn("animate-spin text-neon-purple-dark/70", compact ? "h-2.5 w-2.5" : "h-3 w-3")}
          aria-hidden
        />
      )}
      {displayCount != null && displayCount > 0 && !previewCompact && (
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
  );

  const uploadControl = !readOnly ? (
    <div className={embedded ? "shrink-0" : undefined}>
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
          "note-attachments-attach-btn flex items-center justify-center border border-[var(--note-canvas-border,rgba(24,24,27,0.1))] bg-[var(--note-canvas-surface,#f0f0ed)] text-[var(--note-canvas-text,#18181b)] hover:bg-[color-mix(in_srgb,var(--note-canvas-text,#18181b)_8%,transparent)] disabled:opacity-50 touch-manipulation transition-colors",
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
  ) : null;

  const tilesWrapClass = embedded ? "contents" : cn("flex flex-wrap min-w-0", tileGap);

  const attachmentTiles =
    loading && skeletonCount > 0 ? (
      <div
        className={tilesWrapClass}
        role="status"
        aria-live="polite"
        aria-label="Loading attachments"
      >
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <AttachmentIconSkeleton
            key={index}
            wide={!embedded && !tight && index % 3 === 1}
            compact={compact}
            previewCompact={previewCompact}
          />
        ))}
      </div>
    ) : attachments.length === 0 ? (
      embedded ? null : (
        <div className="text-xs text-text-muted py-1">
          Email attachments and manual uploads appear here.
        </div>
      )
    ) : (
      <div className={tilesWrapClass}>
        {attachments.map((att) => {
              const isImage = isImageAttachment(att.mimeType, att.fileName);
              if (hideImageAttachments && isImage) return null;
              const thumbSize = previewCompact
                ? DESKTOP_PREVIEW_IMAGE_TILE
                : compact
                  ? "h-10 w-10"
                  : "h-12 w-12";
              const thumbRadius = previewCompact
                ? "rounded-lg"
                : compact
                  ? "rounded-md"
                  : "rounded-lg";

              if (isImage) {
                return (
                  <div key={att.id} className="group relative shrink-0">
                    <button
                      type="button"
                      onClick={() => openPreview(att)}
                      className={cn(
                        "relative overflow-hidden border border-[var(--note-canvas-border,rgba(24,24,27,0.12))] bg-white hover:border-neon-purple-dark/35 shadow-sm transition-colors",
                        thumbSize,
                        thumbRadius,
                      )}
                      title={`${att.fileName}${att.sizeBytes > 0 ? ` · ${formatBytes(att.sizeBytes)}` : ""}`}
                    >
                      {att.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={att.previewUrl}
                          alt={att.fileName}
                          className="h-full w-full object-cover"
                          decoding="async"
                          loading="eager"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-text-muted">
                          <ImageIcon
                            className={
                              previewCompact
                                ? DESKTOP_PREVIEW_IMAGE_FALLBACK_ICON
                                : compact
                                  ? "h-4 w-4"
                                  : "h-5 w-5"
                            }
                          />
                        </div>
                      )}
                      <AttachmentImageSizeBadge
                        sizeBytes={att.sizeBytes}
                        className={previewCompact ? "text-[9px] px-1 py-0.5" : undefined}
                      />
                    </button>
                    {!readOnly && (
                      <AttachmentRemoveButton
                        compact={compact}
                        fileName={att.fileName}
                        onRemove={() => setPendingDelete(att)}
                      />
                    )}
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
                    previewCompact
                      ? DESKTOP_PREVIEW_FILE_TILE
                      : compact
                        ? "h-10 w-[6.75rem] rounded-md"
                        : "h-12 w-[7.75rem] rounded-lg",
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
                        previewCompact
                          ? DESKTOP_PREVIEW_FILE_RAIL
                          : compact
                            ? "w-8"
                            : "w-9",
                        fileStyle.railClass,
                      )}
                      aria-label={fileStyle.label}
                    >
                      <AttachmentFileTypeIcon kind={fileKind} className={iconSizeClass} />
                    </div>
                    <div
                      className={cn(
                        "flex min-w-0 flex-1 flex-col justify-center",
                        previewCompact
                          ? "px-2 py-1"
                          : compact
                            ? "px-1 py-0.5"
                            : "px-1.5 py-1",
                      )}
                    >
                      <span
                        className={cn(
                          "truncate font-medium leading-tight text-[var(--note-canvas-text,#18181b)]",
                          previewCompact
                            ? "text-[11px]"
                            : compact
                              ? "text-[9px]"
                              : "text-[10px]",
                        )}
                      >
                        {att.fileName}
                      </span>
                      <div
                        className={cn(
                          "truncate leading-tight text-[var(--note-canvas-text-muted,#71717a)]",
                          previewCompact
                            ? "text-[10px]"
                            : compact
                              ? "text-[8px]"
                              : "text-[9px]",
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
                  {!readOnly && (
                    <AttachmentRemoveButton
                      compact={compact}
                      fileName={att.fileName}
                      onRemove={() => setPendingDelete(att)}
                    />
                  )}
                </div>
              );
            })}
      </div>
    );

  return (
    <>
      <div
        className={cn(
          embedded
            ? cn(
                "note-attachments-embedded border-b border-[var(--note-canvas-border,rgba(24,24,27,0.1))] bg-[var(--note-canvas-bg,#f8f8f6)]",
                previewCompact && "note-attachments-embedded--preview",
                tight
                  ? previewCompact
                    ? "px-3 py-1.5"
                    : "note-attachments-embedded--compact px-3 py-1"
                  : "px-3 py-2 md:px-4",
              )
            : "border-t border-[var(--note-canvas-border,rgba(24,24,27,0.1))] px-4 md:px-6 py-4 space-y-3",
        )}
        onDoubleClick={readOnly ? (e) => e.stopPropagation() : undefined}
      >
        {embedded ? (
          <div
            className={cn(
              "note-attachments-inline-row flex flex-wrap items-center min-w-0",
              tileGap,
            )}
          >
            {attachmentsLabel}
            {attachmentTiles}
            {uploadControl}
            {previewCompact && loading && knownCount > 0 && (
              <Loader2
                className="h-3.5 w-3.5 shrink-0 animate-spin text-neon-purple-dark/70"
                aria-hidden
              />
            )}
          </div>
        ) : (
          <>
            <div
              className={cn(
                "flex items-center justify-between gap-2",
                compact ? "mb-1" : "mb-2",
              )}
            >
              {attachmentsLabel}
              {uploadControl}
            </div>
            {attachmentTiles}
            {!compact && loading && skeletonCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-text-muted mt-2">
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                <span>
                  {displayCount != null && displayCount > 0
                    ? `Loading ${displayCount} attachment${displayCount === 1 ? "" : "s"}…`
                    : "Loading attachments…"}
                </span>
              </div>
            )}
          </>
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