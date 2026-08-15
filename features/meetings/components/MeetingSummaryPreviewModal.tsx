"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Copy, Download, FileText, Loader2, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/BottomSheet";
import type { Meeting, MeetingAgendaEntry, MeetingAgendaItem, WorkspaceMember } from "@/types";
import { buildMeetingSummaryHtml } from "@/lib/meetings/summaryBuilder";
import {
  buildMeetingSummaryClipboardHtml,
  buildMeetingSummaryPlainText,
  copyMeetingSummaryToClipboard,
} from "@/lib/meetings/summaryClipboard";
import { generateMeetingAgendaPdf, printMeetingAgendaPdf } from "@/lib/meetings/generateAgendaPdf";
import { buildMeetingSummaryPreviewDocument } from "@/lib/meetings/summaryPrintDocument";
import { MeetingAgendaPdfPreview } from "@/components/MeetingAgendaPdfPreview";
import { MeetingAgendaRichPreview } from "@/components/MeetingAgendaRichPreview";

type SummaryPreviewFormat = "pdf" | "word";

interface MeetingSummaryPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting;
  items: MeetingAgendaItem[];
  entries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  workspaceName?: string;
  currentUserId?: string;
}

function summaryFileName(title: string): string {
  const slug = title
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${slug || "meeting"}-summary.pdf`;
}

export function MeetingSummaryPreviewModal({
  open,
  onOpenChange,
  meeting,
  items,
  entries,
  members,
  workspaceName,
  currentUserId,
}: MeetingSummaryPreviewModalProps) {
  const [format, setFormat] = useState<SummaryPreviewFormat>("pdf");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const docInput = useMemo(
    () => ({ meeting, items, entries, members, currentUserId }),
    [meeting, items, entries, members, currentUserId],
  );

  const articleHtml = useMemo(
    () =>
      buildMeetingSummaryHtml({
        meeting,
        items,
        entries,
        members,
        workspaceName,
        currentUserId,
      }),
    [meeting, items, entries, members, workspaceName, currentUserId],
  );

  const clipboardHtml = useMemo(
    () => buildMeetingSummaryClipboardHtml(docInput),
    [docInput],
  );

  const plainText = useMemo(
    () => buildMeetingSummaryPlainText(docInput),
    [docInput],
  );

  useEffect(() => {
    if (!open) {
      setFormat("pdf");
      setPdfBlob(null);
      setGenerateError(null);
      setIsGenerating(false);
      setIsCopying(false);
      return;
    }

    let cancelled = false;

    setIsGenerating(true);
    setGenerateError(null);
    setPdfBlob(null);

    void generateMeetingAgendaPdf(articleHtml, meeting.title, buildMeetingSummaryPreviewDocument)
      .then((blob) => {
        if (!cancelled) setPdfBlob(blob);
      })
      .catch(() => {
        if (!cancelled) {
          setGenerateError("Could not generate the summary PDF. Try again in a moment.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsGenerating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, articleHtml, meeting.title]);

  const handlePrint = () => {
    if (!pdfBlob) return;
    printMeetingAgendaPdf(pdfBlob);
  };

  const handleDownload = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = summaryFileName(meeting.title);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCopy = async () => {
    setIsCopying(true);
    try {
      await copyMeetingSummaryToClipboard(clipboardHtml, plainText);
      toast.success("Summary copied — paste into your email");
    } catch {
      toast.error("Could not copy summary");
    } finally {
      setIsCopying(false);
    }
  };

  const pdfReady = !!pdfBlob && !isGenerating;

  return (
    <BottomSheet
      open={open}
      onClose={() => onOpenChange(false)}
      showClose={false}
      wrapChildrenInScroll={false}
      desktopMaxWidth="max-w-[46.8rem]"
      zIndex={1000}
      panelClassName="meeting-summary-preview-modal flex flex-col"
      ariaLabel="Meeting summary preview"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="meeting-summary-preview-modal__toolbar shrink-0 border-b border-border-glass bg-bg px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 id="summary-preview-title" className="text-base font-semibold text-text-primary">
                Meeting summary preview
              </h2>
              <p className="text-xs text-text-muted truncate mt-0.5">{meeting.title}</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-text-muted hover:bg-surface-hover hover:text-text-primary shrink-0"
              aria-label="Close summary preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex p-1 rounded-xl bg-bg-secondary border border-border-glass gap-1"
              role="tablist"
              aria-label="Summary format"
            >
              <button
                type="button"
                role="tab"
                aria-selected={format === "pdf"}
                onClick={() => setFormat("pdf")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-semibold transition inline-flex items-center gap-1.5",
                  format === "pdf"
                    ? "bg-neon-purple/12 text-neon-purple-tint border border-neon-purple/25"
                    : "text-text-secondary hover:text-text-primary border border-transparent",
                )}
              >
                <Printer className="h-3.5 w-3.5" />
                PDF
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={format === "word"}
                onClick={() => setFormat("word")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-semibold transition inline-flex items-center gap-1.5",
                  format === "word"
                    ? "bg-neon-purple/12 text-neon-purple-tint border border-neon-purple/25"
                    : "text-text-secondary hover:text-text-primary border border-transparent",
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                Word
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {format === "pdf" ? (
                <>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={!pdfReady}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-border-glass hover:bg-surface-hover text-text-secondary disabled:opacity-40"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={!pdfReady}
                    className="btn btn-primary text-sm py-2 px-3 inline-flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4" />
                    )}
                    Print
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  disabled={isCopying}
                  className="btn btn-primary text-sm py-2 px-3 inline-flex items-center gap-1.5 disabled:opacity-40"
                >
                  {isCopying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Copy
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {format === "pdf" ? (
            <MeetingAgendaPdfPreview
              articleHtml={articleHtml}
              title={meeting.title}
              pdfGenerating={isGenerating}
              error={generateError}
              buildPreviewDocument={buildMeetingSummaryPreviewDocument}
              previewTitle="Summary PDF preview"
            />
          ) : (
            <MeetingAgendaRichPreview html={clipboardHtml} />
          )}
        </div>
      </div>
    </BottomSheet>
  );
}