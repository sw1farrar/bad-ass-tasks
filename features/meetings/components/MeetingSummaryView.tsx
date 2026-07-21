"use client";

import React from "react";
import { ClipboardList, Copy, FileText } from "lucide-react";
import { toast } from "sonner";
import type { Meeting, MeetingAgendaEntry, MeetingAgendaItem, WorkspaceMember } from "@/types";
import { buildMeetingSummaryHtml, buildMeetingSummaryMarkdown } from "@/lib/meetings/summaryBuilder";

interface MeetingSummaryViewProps {
  meeting: Meeting;
  items: MeetingAgendaItem[];
  entries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  workspaceName?: string;
  currentUserId?: string;
  onSaveAsNote?: () => void;
  onOpenAgendaPreview?: () => void;
}

export function MeetingSummaryView({
  meeting,
  items,
  entries,
  members,
  currentUserId,
  onSaveAsNote,
  onOpenAgendaPreview,
}: MeetingSummaryViewProps) {
  const html = buildMeetingSummaryHtml({
    meeting,
    items,
    entries,
    members,
    currentUserId,
  });

  const handleCopy = async () => {
    const md = buildMeetingSummaryMarkdown({
      meeting,
      items,
      entries,
      members,
      currentUserId,
    });
    try {
      await navigator.clipboard.writeText(md);
      toast.success("Summary copied as markdown");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="meeting-summary-view flex flex-col min-h-0 flex-1 w-full">
      <div className="meeting-summary-view__toolbar shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border-glass">
        {onOpenAgendaPreview && (
          <button
            type="button"
            onClick={onOpenAgendaPreview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border-glass hover:bg-surface-hover text-text-secondary"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Agenda
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border-glass hover:bg-surface-hover text-text-secondary"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy markdown
        </button>
        {onSaveAsNote && (
          <button
            type="button"
            onClick={onSaveAsNote}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border-glass hover:bg-surface-hover text-text-secondary"
          >
            <FileText className="h-3.5 w-3.5" />
            Save as note
          </button>
        )}
      </div>
      <div
        className="meeting-summary-view__canvas"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}