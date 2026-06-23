"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import type { MeetingAgendaEntry, WorkspaceMember } from "@/types";
import { getMemberDisplayName } from "@/lib/assignee";

interface MeetingEntryTimelineProps {
  entries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  currentUserId?: string;
}

export function MeetingEntryTimeline({
  entries,
  members,
  currentUserId,
}: MeetingEntryTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-text-muted px-4 py-6 text-center">
        No notes yet. Capture discussion below — each entry is timestamped automatically.
      </p>
    );
  }

  return (
    <div className="meeting-entry-timeline flex flex-col gap-4 px-4 py-3">
      {entries.map((entry) => {
        const author = entry.authorId
          ? getMemberDisplayName(
              members.find((m) => m.userId === entry.authorId) ?? { userId: entry.authorId, workspaceId: "", role: "member", joinedAt: "" },
              currentUserId,
            )
          : "Note";
        return (
          <div key={entry.id} className="meeting-entry-timeline__item">
            <div className="text-xs text-text-faint mb-0.5">
              {format(parseISO(entry.createdAt), "MMM d, h:mm a")}
              <span className="mx-1.5">·</span>
              <span className="text-text-muted">{author}</span>
              {entry.isDecision && (
                <span className="ml-2 text-amber-400/90 font-medium">Decision</span>
              )}
            </div>
            <p className="text-sm text-text-primary whitespace-pre-wrap">{entry.body}</p>
          </div>
        );
      })}
    </div>
  );
}