"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import {
  DUPLICATE_MEETING_TITLE,
  type DuplicateMeetingOptions,
} from "@/lib/meetings/duplicateMeeting";
import { sortAgendaItems } from "@/lib/meetings/meetingFilters";
import type { MeetingAgendaEntry, MeetingAgendaItem } from "@/types";

interface CopyMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceTitle: string;
  agendaItems: MeetingAgendaItem[];
  agendaEntries: MeetingAgendaEntry[];
  isLoading?: boolean;
  onConfirm: (options: DuplicateMeetingOptions) => void | Promise<void>;
}

function defaultDateLocal(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseScheduledDate(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function CopyMeetingModal({
  open,
  onOpenChange,
  sourceTitle,
  agendaItems,
  agendaEntries,
  isLoading,
  onConfirm,
}: CopyMeetingModalProps) {
  const sortedItems = useMemo(() => sortAgendaItems(agendaItems), [agendaItems]);
  const [title, setTitle] = useState(DUPLICATE_MEETING_TITLE);
  const [scheduledAt, setScheduledAt] = useState(defaultDateLocal);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [includeNotes, setIncludeNotes] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(DUPLICATE_MEETING_TITLE);
    setScheduledAt(defaultDateLocal());
    setSelectedIds(new Set(sortedItems.map((item) => item.id)));
    setIncludeNotes(false);
    setTitleError(null);
    setDateError(null);
  }, [open, sortedItems]);

  const selectedNoteCount = useMemo(() => {
    if (selectedIds.size === 0) return 0;
    return agendaEntries.filter((entry) => selectedIds.has(entry.agendaItemId)).length;
  }, [agendaEntries, selectedIds]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = sortedItems.length > 0 && selectedIds.size === sortedItems.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(sortedItems.map((item) => item.id)));
  };

  return (
    <ConfirmationModal
      open={open}
      onOpenChange={onOpenChange}
      title="Copy to new meeting?"
      description="Pick a title, date, and which agenda topics to include. Topics start open so you can run them again."
      highlight={sourceTitle}
      details={
        <div className="space-y-3 text-sm text-text-muted">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted" htmlFor="copy-meeting-title">
              New meeting title
            </label>
            <input
              id="copy-meeting-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(null);
              }}
              placeholder={DUPLICATE_MEETING_TITLE}
              className="w-full min-h-[44px] bg-bg-secondary border border-border-glass rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-neon-purple/40"
              disabled={isLoading}
            />
            {titleError && <p className="text-xs text-red-400">{titleError}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted" htmlFor="copy-meeting-date">
              Date
            </label>
            <input
              id="copy-meeting-date"
              type="date"
              value={scheduledAt}
              onChange={(e) => {
                setScheduledAt(e.target.value);
                if (dateError) setDateError(null);
              }}
              className="w-full min-h-[44px] bg-bg-secondary border border-border-glass rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-neon-purple/40"
              disabled={isLoading}
            />
            {dateError && <p className="text-xs text-red-400">{dateError}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-text-muted">Agenda topics</span>
              {sortedItems.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-medium text-neon-purple-tint hover:underline"
                  disabled={isLoading}
                >
                  {allSelected ? "Uncheck all" : "Check all"}
                </button>
              )}
            </div>
            {sortedItems.length === 0 ? (
              <p className="text-xs text-text-faint">This meeting has no agenda topics.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-border-glass bg-bg-secondary/60 divide-y divide-border-glass">
                {sortedItems.map((item) => {
                  const checked = selectedIds.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-surface-hover/50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(item.id)}
                        className="mt-0.5 rounded border-border-glass"
                        disabled={isLoading}
                      />
                      <span className="min-w-0 flex-1 text-sm text-text-primary leading-snug">
                        {item.title || "Untitled topic"}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-text-faint">
              {selectedIds.size} of {sortedItems.length} topic
              {sortedItems.length === 1 ? "" : "s"} selected
            </p>
          </div>

          {selectedNoteCount > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
                className="rounded border-border-glass"
                disabled={isLoading}
              />
              Include {selectedNoteCount} note{selectedNoteCount === 1 ? "" : "s"} for selected topics
            </label>
          )}
        </div>
      }
      confirmText="Copy meeting"
      isLoading={isLoading}
      onConfirm={async () => {
        const trimmed = title.trim();
        if (!trimmed) {
          setTitleError("Enter a meeting title.");
          throw new Error("Meeting title required");
        }
        const iso = scheduledAt ? parseScheduledDate(scheduledAt) : undefined;
        if (!scheduledAt || !iso) {
          setDateError("Enter a valid date.");
          throw new Error("Meeting date required");
        }
        await onConfirm({
          title: trimmed,
          scheduledAt: iso,
          includeNotes: selectedNoteCount > 0 ? includeNotes : false,
          agendaItemIds: Array.from(selectedIds),
        });
      }}
    />
  );
}
