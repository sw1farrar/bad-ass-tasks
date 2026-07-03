"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Copy, Download, FileText, Loader2, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/BottomSheet";
import type { Meeting, MeetingAgendaEntry, MeetingAgendaItem, WorkspaceMember } from "@/types";
import { buildMeetingAgendaHtml } from "@/lib/meetings/summaryBuilder";
import {
  buildMeetingAgendaClipboardHtml,
  buildMeetingAgendaPlainText,
  copyMeetingAgendaToClipboard,
} from "@/lib/meetings/agendaClipboard";
import { generateMeetingAgendaPdf, printMeetingAgendaPdf } from "@/lib/meetings/generateAgendaPdf";
import { MeetingAgendaPdfPreview } from "@/components/MeetingAgendaPdfPreview";
import { MeetingAgendaRichPreview } from "@/components/MeetingAgendaRichPreview";

type AgendaPreviewFormat = "pdf" | "word";

interface MeetingAgendaPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting;
  items: MeetingAgendaItem[];
  entries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  workspaceName?: string;
  currentUserId?: string;
  defaultIncludeComments?: boolean;
}

function agendaFileName(title: string): string {
  const slug = title
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${slug || "meeting"}-agenda.pdf`;
}

export function MeetingAgendaPreviewModal({
  open,
  onOpenChange,
  meeting,
  items,
  entries,
  members,
  workspaceName,
  currentUserId,
  defaultIncludeComments = false,
}: MeetingAgendaPreviewModalProps) {
  const [format, setFormat] = useState<AgendaPreviewFormat>("pdf");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [includeComments, setIncludeComments] = useState(defaultIncludeComments);

  const docInput = useMemo(
    () => ({ meeting, items, entries, members, currentUserId, includeComments }),
    [meeting, items, entries, members, currentUserId, includeComments],
  );

  const articleHtml = useMemo(
    () =>
      buildMeetingAgendaHtml({
        meeting,
        items,
        entries,
        members,
        workspaceName,
        currentUserId,
        includeComments,
      }),
    [meeting, items, entries, members, workspaceName, currentUserId, includeComments],
  );

  const clipboardHtml = useMemo(
    () => buildMeetingAgendaClipboardHtml(docInput),
    [docInput],
  );

  const plainText = useMemo(
    () => buildMeetingAgendaPlainText(docInput),
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

    setIncludeComments(defaultIncludeComments);
  }, [open, defaultIncludeComments]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    setIsGenerating(true);
    setGenerateError(null);
    setPdfBlob(null);

    void generateMeetingAgendaPdf(articleHtml, meeting.title)
      .then((blob) => {
        if (!cancelled) setPdfBlob(blob);
      })
      .catch(() => {
        if (!cancelled) {
          setGenerateError("Could not generate the agenda PDF. Try again in a moment.");
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
    link.download = agendaFileName(meeting.title);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCopy = async () => {
    setIsCopying(true);
    try {
      await copyMeetingAgendaToClipboard(clipboardHtml, plainText);
      toast.success("Agenda copied — paste into your email");
    } catch {
      toast.error("Could not copy agenda");
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
      mobileHeight="90"
      desktopMaxWidth="max-w-[46.8rem]"
      zIndex={1000}
      panelClassName="meeting-agenda-preview-modal flex flex-col"
      ariaLabel="Agenda preview"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="meeting-agenda-preview-modal__toolbar shrink-0 border-b border-border-glass bg-bg px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="agenda-preview-title" className="text-base font-semibold text-text-primary">
              Agenda preview
            </h2>
            <p className="text-xs text-text-muted truncate mt-0.5">{meeting.title}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-text-muted hover:bg-surface-hover hover:text-text-primary shrink-0"
            aria-label="Close agenda preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div
            className="flex p-1 rounded-xl bg-bg-secondary border border-border-glass gap-1"
            role="tablist"
            aria-label="Agenda format"
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

          <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-secondary select-none">
            <input
              type="checkbox"
              checked={includeComments}
              onChange={(e) => setIncludeComments(e.target.checked)}
              className="rounded border-border-glass"
            />
            Include Comments
          </label>
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
          />
        ) : (
          <MeetingAgendaRichPreview html={clipboardHtml} />
        )}
      </div>
      </div>
    </BottomSheet>
  );
}