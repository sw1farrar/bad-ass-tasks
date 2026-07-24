"use client";

import React, { useEffect, useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  RotateCcw,
  FastForward,
} from "lucide-react";
import type { Meeting, MeetingAgendaItem } from "@/types";
import { collectKnownAttendeeNames } from "@/lib/meetings/attendees";
import {
  canCompleteMeeting,
  canReopenMeeting,
  canStartNextMeeting,
} from "@/lib/meetings/meetingLifecycle";
import { MeetingAttendeeEditor } from "./MeetingAttendeeEditor";

interface MeetingHeaderProps {
  meeting: Meeting;
  meetings: Meeting[];
  agendaItems: MeetingAgendaItem[];
  onUpdateMeeting: (id: string, updates: Partial<Meeting>) => void;
  onComplete: () => void;
  onReopen: () => void;
  onStartNext: () => void;
  onOpenAgendaPreview: () => void;
  onOpenSummaryPreview?: () => void;
}

export function MeetingHeader({
  meeting,
  meetings,
  agendaItems,
  onUpdateMeeting,
  onComplete,
  onReopen,
  onStartNext,
  onOpenAgendaPreview,
  onOpenSummaryPreview,
}: MeetingHeaderProps) {
  const [title, setTitle] = useState(meeting.title);
  const [description, setDescription] = useState(meeting.description ?? "");

  useEffect(() => {
    setTitle(meeting.title);
    setDescription(meeting.description ?? "");
  }, [meeting.id, meeting.title, meeting.description]);

  const attendeeSuggestions = useMemo(
    () => collectKnownAttendeeNames(meetings),
    [meetings],
  );

  const saveDescription = () => {
    const next = description.trim();
    const prev = (meeting.description ?? "").trim();
    if (next === prev) return;
    onUpdateMeeting(meeting.id, { description: next || null });
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
            aria-label="Meeting title"
          />
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-text-muted">
            {meeting.status === "completed" && (
              <span className="px-2 py-0.5 rounded-md font-medium border border-border-glass text-text-muted">
                Completed
              </span>
            )}
            {(() => {
              if (!meeting.scheduledAt) return <span>No date</span>;
              const parsed = parseISO(meeting.scheduledAt);
              if (!isValid(parsed)) return <span>No date</span>;
              return <span>{format(parsed, "MMM d, yyyy")}</span>;
            })()}
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            disabled={meeting.status === "completed"}
            placeholder="Add a short description…"
            className="mt-1.5 w-full bg-transparent text-sm text-text-secondary placeholder:text-text-faint focus:outline-none disabled:opacity-80"
            aria-label="Meeting description"
          />
          <div className="mt-2">
            <MeetingAttendeeEditor
              value={meeting.attendees ?? []}
              suggestions={attendeeSuggestions}
              disabled={meeting.status === "completed"}
              onChange={(attendees) => onUpdateMeeting(meeting.id, { attendees })}
            />
          </div>
        </div>

        <div className="meetings-header-actions flex flex-wrap items-center gap-2">
          {meeting.status === "completed" && onOpenSummaryPreview ? (
            <button
              type="button"
              onClick={onOpenSummaryPreview}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-border-glass hover:bg-surface-hover text-text-secondary"
            >
              <FileText className="h-4 w-4" />
              Meeting summary
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAgendaPreview}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-border-glass hover:bg-surface-hover text-text-secondary"
            >
              <ClipboardList className="h-4 w-4" />
              Agenda
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
              {canStartNextMeeting(meeting, meetings, agendaItems) && (
                <button
                  type="button"
                  onClick={onStartNext}
                  className="btn btn-primary text-sm py-2 px-3 inline-flex items-center gap-1.5"
                >
                  <FastForward className="h-4 w-4" />
                  Next meeting
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
