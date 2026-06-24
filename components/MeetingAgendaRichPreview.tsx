"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface MeetingAgendaRichPreviewProps {
  html: string;
  className?: string;
}

export function MeetingAgendaRichPreview({ html, className }: MeetingAgendaRichPreviewProps) {
  return (
    <div
      className={cn(
        "meeting-agenda-rich-preview flex flex-1 min-h-0 flex-col bg-[#e8e8e6] p-4 sm:p-6",
        className,
      )}
    >
      <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-black/10 bg-white shadow-lg shadow-black/15">
          <div
            className="meeting-agenda-rich-preview__page px-8 py-8 sm:px-10 sm:py-10 text-black"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}