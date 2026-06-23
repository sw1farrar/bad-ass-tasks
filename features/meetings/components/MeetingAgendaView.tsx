"use client";

import React from "react";
import type { Meeting, MeetingAgendaItem, WorkspaceMember } from "@/types";
import { buildMeetingAgendaHtml } from "@/lib/meetings/summaryBuilder";

interface MeetingAgendaViewProps {
  meeting: Meeting;
  items: MeetingAgendaItem[];
  members: WorkspaceMember[];
  workspaceName?: string;
  currentUserId?: string;
}

export function MeetingAgendaView({
  meeting,
  items,
  members,
  workspaceName,
  currentUserId,
}: MeetingAgendaViewProps) {
  const html = buildMeetingAgendaHtml({
    meeting,
    items,
    members,
    workspaceName,
    currentUserId,
  });

  return (
    <div
      className="flex-1 overflow-y-auto bg-[#fafafc] dark:bg-[#1a1a1f] print:block"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}