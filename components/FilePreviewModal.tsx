"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, FileText, Loader2 } from "lucide-react";
import { ImagePreviewModal } from "@/features/notes/editor/components/ImagePreviewModal";
import { cn } from "@/lib/utils";

export type FilePreviewTarget = {
  url: string;
  fileName: string;
  mimeType?: string;
};

interface FilePreviewModalProps {
  file: FilePreviewTarget | null;
  onClose: () => void;
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

function OfficePreview({ file }: { file: FilePreviewTarget }) {
  const [html, setHtml] = useState<string | null>(null);
  const [tableHtml, setTableHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setHtml(null);
      setTableHtml(null);

      try {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error("fetch_failed");
        const buffer = await response.arrayBuffer();

        if (isDocxMime(file.mimeType, file.fileName)) {
          const mammoth = await import("mammoth");
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
          if (!cancelled) setHtml(result.value);
        } else if (isXlsxMime(file.mimeType, file.fileName)) {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(buffer, { type: "array" });
          const firstSheet = workbook.SheetNames[0];
          if (!firstSheet) throw new Error("no_sheet");
          const sheet = workbook.Sheets[firstSheet];
          const table = XLSX.utils.sheet_to_html(sheet, { editable: false });
          if (!cancelled) setTableHtml(table);
        }
      } catch {
        if (!cancelled) setError("Preview unavailable. Download the file instead.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [file.url, file.mimeType, file.fileName]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-[#71717a]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Preparing preview…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-8 text-center text-sm text-[#71717a]">
        {error}
      </div>
    );
  }

  if (html) {
    return (
      <div
        className="prose max-w-4xl mx-auto h-full overflow-y-auto bg-white p-6 text-[#18181b] prose-headings:text-[#18181b] prose-p:text-[#27272a] prose-strong:text-[#18181b]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (tableHtml) {
    return (
      <div
        className="h-full overflow-auto bg-white p-4 text-[#18181b] [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#e4e4e7] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[#e4e4e7] [&_th]:bg-[#f4f4f5] [&_th]:px-2 [&_th]:py-1"
        dangerouslySetInnerHTML={{ __html: tableHtml }}
      />
    );
  }

  return null;
}

export function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!file) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [file, close]);

  if (!mounted || !file) return null;

  if (isImageMime(file.mimeType, file.fileName)) {
    return <ImagePreviewModal src={file.url} alt={file.fileName} onClose={close} />;
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

  return createPortal(
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
          <div className="absolute inset-0 bg-[#050508]/95 backdrop-blur-2xl" onClick={close} />
          <div className="relative z-10 flex h-full w-full flex-col p-4 md:p-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-white/80 min-w-0">
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

            <div
              className={cn(
                "flex-1 overflow-hidden rounded-2xl border",
                showOffice ? "border-black/10 bg-white" : "border-white/10 bg-black/30",
              )}
            >
              {showPdf ? (
                <iframe
                  title={file.fileName}
                  src={file.url}
                  className="h-full w-full rounded-2xl bg-white"
                />
              ) : showOffice ? (
                <OfficePreview file={file} />
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
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}