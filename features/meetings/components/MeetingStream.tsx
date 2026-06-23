"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import { Calendar, Circle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Meeting, MeetingAgendaItem } from "@/types";
import {
  countContinuedItems,
  countOpenAgendaItems,
  groupMeetingsByStatus,
} from "@/lib/meetings/meetingFilters";

interface MeetingStreamProps {
  meetings: Meeting[];
  agendaItems: MeetingAgendaItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  emptyMessage?: string;
}

export function MeetingStream({
  meetings,
  agendaItems,
  selectedId,
  onSelect,
  onDelete,
  emptyMessage = "No meetings yet. Schedule one to get started.",
}: MeetingStreamProps) {
  const groups = groupMeetingsByStatus(meetings);

  if (meetings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] text-center text-sm text-text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className="files-list-scroll flex-1 min-w-0 overflow-y-auto overflow-x-hidden"
      role="listbox"
      aria-label="Meetings"
    >
      {groups.map((group) => (
        <div key={group.label} className="mb-2">
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-faint flex items-center gap-2">
            {group.status === "live" && (
              <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400 animate-pulse" />
            )}
            {group.label}
          </div>
          {group.meetings.map((meeting) => {
            const isSelected = meeting.id === selectedId;
            const openCount = countOpenAgendaItems(meeting.id, agendaItems);
            const carryCount = countContinuedItems(meeting.id, agendaItems);
            const dateLabel = meeting.scheduledAt
              ? format(parseISO(meeting.scheduledAt), "MMM d, yyyy")
              : format(parseISO(meeting.createdAt), "MMM d, yyyy");

            return (
              <div
                key={meeting.id}
                role="option"
                aria-selected={isSelected}
                className={cn(
                  "files-list-item w-full text-left px-3 md:px-4 py-3 transition relative group",
                  isSelected && "files-list-item--selected",
                  !isSelected && "hover:bg-surface-hover",
                )}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelect(meeting.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="font-medium text-sm truncate text-text-primary">
                      {meeting.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>{dateLabel}</span>
                      {openCount > 0 && meeting.status !== "completed" && (
                        <span className="text-neon-purple-tint">{openCount} open</span>
                      )}
                      {carryCount > 0 && (
                        <span className="text-amber-400/90">{carryCount} carry-over</span>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(meeting.id);
                    }}
                    className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0"
                    aria-label={`Delete ${meeting.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}