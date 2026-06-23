"use client";

import React, { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2,
  Play,
  Printer,
  RotateCcw,
  FastForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Meeting, WorkspaceMember } from "@/types";
import {
  canCompleteMeeting,
  canReopenMeeting,
  canStartMeeting,
  getMeetingDurationMinutes,
  meetingStatusLabel,
} from "@/lib/meetings/meetingLifecycle";
import { getMemberDisplayName } from "@/lib/assignee";

interface MeetingHeaderProps {
  meeting: Meeting;
  members: WorkspaceMember[];
  currentUserId?: string;
  onUpdateMeeting: (id: string, updates: Partial<Meeting>) => void;
  onStart: () => void;
  onComplete: () => void;
  onReopen: () => void;
  onStartNext: () => void;
  onPrint: () => void;
}

export function MeetingHeader({
  meeting,
  members,
  currentUserId,
  onUpdateMeeting,
  onStart,
  onComplete,
  onReopen,
  onStartNext,
  onPrint,
}: MeetingHeaderProps) {
  const [title, setTitle] = useState(meeting.title);
  const duration = getMeetingDurationMinutes(meeting);

  useEffect(() => {
    setTitle(meeting.title);
  }, [meeting.id, meeting.title]);

  const toggleAttendee = (userId: string) => {
    const ids = new Set(meeting.attendeeIds);
    if (ids.has(userId)) ids.delete(userId);
    else ids.add(userId);
    onUpdateMeeting(meeting.id, { attendeeIds: [...ids] });
  };

  return (
    <header className="meetings-header shrink-0 border-b border-border-glass px-4 py-3 space-y-3 bg-bg">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== meeting.title) {
                onUpdateMeeting(meeting.id, { title: title.trim() });
              }
            }}
            disabled={meeting.status === "completed"}
            className="w-full bg-transparent text-xl font-bold focus:outline-none text-text-primary disabled:opacity-80"
          />
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-text-muted">
            <span
              className={cn(
                "px-2 py-0.5 rounded-md font-medium border",
                meeting.status === "in_progress" && "border-emerald-400/40 text-emerald-400/90 bg-emerald-400/10",
                meeting.status === "completed" && "border-border-glass text-text-muted",
                (meeting.status === "draft" || meeting.status === "scheduled") &&
                  "border-neon-purple/30 text-neon-purple-tint bg-neon-purple/10",
              )}
            >
              {meetingStatusLabel(meeting.status)}
            </span>
            {meeting.scheduledAt && (
              <span>{format(parseISO(meeting.scheduledAt), "MMM d, yyyy h:mm a")}</span>
            )}
            {meeting.status === "in_progress" && duration != null && (
              <span>{duration} min elapsed</span>
            )}
          </div>
        </div>

        <div className="meetings-header-actions flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-border-glass hover:bg-surface-hover text-text-secondary"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          {canStartMeeting(meeting) && (
            <button type="button" onClick={onStart} className="btn btn-primary text-sm py-2 px-3 inline-flex items-center gap-1.5">
              <Play className="h-4 w-4" />
              Start meeting
            </button>
          )}
          {canCompleteMeeting(meeting) && (
            <button
              type="button"
              onClick={onComplete}
              className="btn btn-primary text-sm py-2 px-3 inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Complete
            </button>
          )}
          {canReopenMeeting(meeting) && (
            <>
              <button
                type="button"
                onClick={onReopen}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-border-glass hover:bg-surface-hover text-text-secondary"
              >
                <RotateCcw className="h-4 w-4" />
                Reopen
              </button>
              <button
                type="button"
                onClick={onStartNext}
                className="btn btn-primary text-sm py-2 px-3 inline-flex items-center gap-1.5"
              >
                <FastForward className="h-4 w-4" />
                Next meeting
              </button>
            </>
          )}
        </div>
      </div>

      {meeting.status !== "completed" && members.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => {
            const active = meeting.attendeeIds.includes(m.userId);
            const label = getMemberDisplayName(m, currentUserId);
            return (
              <button
                key={m.userId}
                type="button"
                onClick={() => toggleAttendee(m.userId)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium border transition",
                  active
                    ? "bg-neon-purple/15 border-neon-purple/30 text-neon-purple-tint"
                    : "border-border-glass text-text-muted hover:bg-surface-hover",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}