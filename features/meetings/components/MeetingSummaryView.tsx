"use client";

import React from "react";
import { Copy, FileText } from "lucide-react";
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
}

export function MeetingSummaryView({
  meeting,
  items,
  entries,
  members,
  workspaceName,
  currentUserId,
  onSaveAsNote,
}: MeetingSummaryViewProps) {
  const html =
    meeting.summaryHtml ??
    buildMeetingSummaryHtml({
      meeting,
      items,
      entries,
      members,
      workspaceName,
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
    <div className="flex flex-col min-h-0 flex-1">
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border-glass">
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
        className="flex-1 overflow-y-auto bg-[#fafafc] dark:bg-[#1a1a1f]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}