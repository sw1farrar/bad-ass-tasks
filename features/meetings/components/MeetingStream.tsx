"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import { Archive, ArchiveRestore, Calendar, Copy, Trash2 } from "lucide-react";
import { hasMeetingBeenCarriedForward } from "@/lib/meetings/carryOver";
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
  onCopy?: (id: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  isArchivedView?: boolean;
  emptyMessage?: string;
}

export function MeetingStream({
  meetings,
  agendaItems,
  selectedId,
  onSelect,
  onDelete,
  onCopy,
  onArchive,
  onUnarchive,
  isArchivedView = false,
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
      aria-label={isArchivedView ? "Archived meetings" : "Meetings"}
    >
      {groups.map((group) => (
        <div key={group.label} className="mb-2">
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-faint">
            {group.label}
          </div>
          {group.meetings.map((meeting) => {
            const isSelected = meeting.id === selectedId;
            const openCount = countOpenAgendaItems(meeting.id, agendaItems);
            const carryCount = hasMeetingBeenCarriedForward(meeting.id, meetings)
              ? 0
              : countContinuedItems(meeting.id, agendaItems);
            const dateLabel = meeting.scheduledAt
              ? format(parseISO(meeting.scheduledAt), "MMM d, yyyy")
              : "No date";

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
                    {meeting.description?.trim() && (
                      <div className="mt-0.5 text-xs text-text-muted truncate">
                        {meeting.description.trim()}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span className={!meeting.scheduledAt ? "text-text-faint" : undefined}>
                        {dateLabel}
                      </span>
                      {openCount > 0 && meeting.status !== "completed" && (
                        <span className="text-neon-purple-tint">{openCount} open</span>
                      )}
                      {carryCount > 0 && (
                        <span className="text-amber-400/90">{carryCount} carry-over</span>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {onCopy && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopy(meeting.id);
                        }}
                        className="p-1.5 rounded-lg text-text-muted hover:text-neon-purple hover:bg-surface-hover"
                        aria-label={`Copy ${meeting.title}`}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isArchivedView ? (
                      onUnarchive && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUnarchive(meeting.id);
                          }}
                          className="p-1.5 rounded-lg text-text-muted hover:text-neon-purple hover:bg-surface-hover"
                          aria-label={`Restore ${meeting.title}`}
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        </button>
                      )
                    ) : (
                      onArchive && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onArchive(meeting.id);
                          }}
                          className="p-1.5 rounded-lg text-text-muted hover:text-neon-purple hover:bg-surface-hover"
                          aria-label={`Archive ${meeting.title}`}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(meeting.id);
                      }}
                      className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover"
                      aria-label={`Delete ${meeting.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
