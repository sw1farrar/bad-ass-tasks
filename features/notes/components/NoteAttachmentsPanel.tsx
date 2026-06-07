"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Paperclip,
  Upload,
  Trash2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { Note } from "@/types";
import { FilePreviewModal, type FilePreviewTarget } from "@/components/FilePreviewModal";
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
  return (
    mimeType.includes("wordprocessingml") ||
    mimeType === "application/msword" ||
    /\.docx?$/i.test(fileName)
  );
}

function isExcelAttachment(mimeType: string, fileName: string): boolean {
  return (
    mimeType.includes("spreadsheetml") ||
    mimeType.includes("spreadsheet") ||
    mimeType === "application/vnd.ms-excel" ||
    /\.xlsx?$/i.test(fileName)
  );
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
  generic: { railClass: "bg-[#3f3f46]", label: "File" },
};

function AttachmentFileTypeIcon({ kind }: { kind: AttachmentFileKind }) {
  if (kind === "word") {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
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
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
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
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
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

  return <FileText className="h-6 w-6 text-white/90" aria-hidden="true" />;
}

interface NoteAttachmentsPanelProps {
  selectedNote: Note;
  /** Render as footer inside the note editor card */
  embedded?: boolean;
  onCountChange?: (noteId: string, count: number) => void;
}

export function NoteAttachmentsPanel({
  selectedNote,
  embedded = false,
  onCountChange,
}: NoteAttachmentsPanelProps) {
  const [attachments, setAttachments] = useState<NoteAttachmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<FilePreviewTarget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NoteAttachmentRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [selectedNote.id, onCountChange]);

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
    });
  };

  if (!isSupabaseConfigured()) return null;

  if (!embedded && !loading && attachments.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          embedded
            ? "border-t border-white/10 bg-[#111114]/50 px-3 py-4 md:px-4"
            : "border-t border-white/10 px-4 md:px-6 py-4 space-y-3",
        )}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#71717a]">
            <Paperclip className="h-3.5 w-3.5 text-[#c084fc]" />
            Attachments
            {attachments.length > 0 && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-[#a1a1aa]">
                {attachments.length}
              </span>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#e5e5e7] hover:bg-white/10 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Attach file
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-xs text-[#71717a] py-1">Loading attachments…</div>
        ) : attachments.length === 0 ? (
          embedded ? null : (
            <div className="text-xs text-[#71717a] py-1">
              Email attachments and manual uploads appear here.
            </div>
          )
        ) : (
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => {
              const isImage = isImageAttachment(att.mimeType, att.fileName);

              if (isImage) {
                return (
                  <div key={att.id} className="group relative shrink-0">
                    <button
                      type="button"
                      onClick={() => openPreview(att)}
                      className="relative h-20 w-20 overflow-hidden rounded-xl border border-white/10 bg-black/30 hover:border-[#c084fc]/40 transition-colors"
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
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(att)}
                      className="absolute -right-1 -top-1 rounded-full bg-[#111114] p-1 text-[#71717a] opacity-0 shadow border border-white/10 hover:text-red-400 group-hover:opacity-100 transition-opacity"
                      aria-label={`Delete ${att.fileName}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              }

              const fileKind = getAttachmentFileKind(att.mimeType, att.fileName);
              const fileStyle = ATTACHMENT_FILE_STYLES[fileKind];
              return (
                <div
                  key={att.id}
                  className="group relative flex h-20 w-36 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#18181b]"
                >
                  <button
                    type="button"
                    onClick={() => openPreview(att)}
                    className="flex min-w-0 flex-1 text-left hover:opacity-95"
                    title={att.fileName}
                  >
                    <div
                      className={cn(
                        "flex w-14 shrink-0 items-center justify-center",
                        fileStyle.railClass,
                      )}
                      aria-label={fileStyle.label}
                    >
                      <AttachmentFileTypeIcon kind={fileKind} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-2">
                      <span className="truncate text-xs font-medium text-[#e5e5e7]">{att.fileName}</span>
                      <div className="mt-0.5 truncate text-[10px] text-[#71717a]">
                        {formatBytes(att.sizeBytes)}
                        {att.source === "email" && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[#a1a1aa]">
                            <Mail className="h-3 w-3" /> Email
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(att)}
                    className="absolute -right-1 -top-1 rounded-full bg-[#111114] p-1 text-[#71717a] opacity-0 shadow border border-white/10 hover:text-red-400 group-hover:opacity-100 transition-opacity"
                    aria-label={`Delete ${att.fileName}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

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