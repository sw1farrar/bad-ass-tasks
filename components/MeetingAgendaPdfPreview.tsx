"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildMeetingAgendaPreviewDocument,
  MEETING_AGENDA_PRINT_WIDTH_PX,
  MEETING_PRINT_PAGE_CLASS,
} from "@/lib/meetings/agendaPrintDocument";

const PREVIEW_MAX_HEIGHT_PX = 630;

interface MeetingAgendaPdfPreviewProps {
  articleHtml: string;
  title: string;
  pdfGenerating?: boolean;
  error?: string | null;
  className?: string;
  buildPreviewDocument?: (articleHtml: string, title: string) => string;
  previewTitle?: string;
}

export function MeetingAgendaPdfPreview({
  articleHtml,
  title,
  pdfGenerating,
  error,
  className,
  buildPreviewDocument = buildMeetingAgendaPreviewDocument,
  previewTitle = "Agenda PDF preview",
}: MeetingAgendaPdfPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState(0);
  const [scale, setScale] = useState(1);

  const previewDocument = useMemo(
    () => buildPreviewDocument(articleHtml, title),
    [articleHtml, title, buildPreviewDocument],
  );

  const updatePreviewLayout = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc?.documentElement && !doc?.body) return;

    const page = doc.querySelector(`.${MEETING_PRINT_PAGE_CLASS}`) as HTMLElement | null;
    const height = Math.max(
      page?.scrollHeight ?? 0,
      doc.documentElement?.scrollHeight ?? 0,
      doc.body?.scrollHeight ?? 0,
      1,
    );
    setPageHeight(height);

    const scroll = scrollRef.current;
    if (scroll && scroll.clientWidth > 0) {
      setScale(Math.min(1, scroll.clientWidth / MEETING_AGENDA_PRINT_WIDTH_PX));
    }
  }, []);

  useEffect(() => {
    setPageHeight(0);

    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      updatePreviewLayout();
      window.requestAnimationFrame(() => updatePreviewLayout());
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [previewDocument, updatePreviewLayout]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    let frame = 0;
    const scheduleLayout = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => updatePreviewLayout());
    };

    const observer = new ResizeObserver(scheduleLayout);
    observer.observe(scroll);
    scheduleLayout();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [updatePreviewLayout, previewDocument]);

  return (
    <div
      className={cn(
        "meeting-agenda-pdf-preview flex flex-1 min-h-0 flex-col bg-[#e8e8e6] p-4 sm:p-6",
        className,
      )}
    >
      <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-1 flex-col min-h-0 overflow-hidden">
        {pdfGenerating && (
          <p className="mb-2 shrink-0 flex items-center gap-2 text-xs text-text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-neon-purple-tint" />
            Preparing PDF for download and print…
          </p>
        )}

        <div
          ref={scrollRef}
          className="meeting-agenda-pdf-preview__scroll h-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-black/10 bg-white shadow-lg shadow-black/15"
          style={{ maxHeight: PREVIEW_MAX_HEIGHT_PX }}
        >
          {error ? (
            <div className="flex min-h-[200px] items-center justify-center px-4 py-8">
              <div className="max-w-lg rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-6 text-center text-sm text-red-300">
                {error}
              </div>
            </div>
          ) : (
            <div
              className="mx-auto"
              style={{
                width: MEETING_AGENDA_PRINT_WIDTH_PX * scale,
                height: pageHeight > 0 ? pageHeight * scale : undefined,
                minHeight: pageHeight > 0 ? undefined : 200,
              }}
            >
              <iframe
                key={previewDocument}
                ref={iframeRef}
                title={previewTitle}
                srcDoc={previewDocument}
                sandbox="allow-same-origin"
                scrolling="no"
                className="pointer-events-none block border-0 bg-white"
                style={{
                  width: MEETING_AGENDA_PRINT_WIDTH_PX,
                  height: pageHeight > 0 ? pageHeight : 1,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}