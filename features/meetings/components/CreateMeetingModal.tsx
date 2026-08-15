"use client";

import React, { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import {
  getCarryOverCandidateMeetings,
  getCarryOverSourceItems,
  type CarryOverOptions,
} from "@/lib/meetings/carryOver";
import { countContinuedItems, countOpenAgendaItems } from "@/lib/meetings/meetingFilters";
import type { Meeting, MeetingAgendaItem } from "@/types";

export interface CreateMeetingInput {
  title: string;
  description?: string;
  scheduledAt?: string;
  carryOverFromMeetingId?: string;
  carryOver?: CarryOverOptions;
}

interface CreateMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetings: Meeting[];
  agendaItems: MeetingAgendaItem[];
  onCreate: (input: CreateMeetingInput) => void | Promise<void>;
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

export function CreateMeetingModal({
  open,
  onOpenChange,
  meetings,
  agendaItems,
  onCreate,
}: CreateMeetingModalProps) {
  const isMobile = useIsMobileViewport();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultDateLocal);
  const [carryOverMeetingId, setCarryOverMeetingId] = useState<string>("");
  const [includeContinued, setIncludeContinued] = useState(true);
  const [includeOpen, setIncludeOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  const carryOverCandidates = useMemo(
    () =>
      getCarryOverCandidateMeetings(meetings, agendaItems).sort((a, b) => {
        const aTime = a.scheduledAt ?? a.updatedAt;
        const bTime = b.scheduledAt ?? b.updatedAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      }),
    [meetings, agendaItems],
  );

  const selectedCarryMeeting = carryOverMeetingId
    ? meetings.find((m) => m.id === carryOverMeetingId) ?? null
    : null;

  const carrySourceItems = useMemo(() => {
    if (!carryOverMeetingId) return [];
    const items = agendaItems.filter((i) => i.meetingId === carryOverMeetingId);
    return getCarryOverSourceItems(items, { includeContinued, includeOpen });
  }, [agendaItems, carryOverMeetingId, includeContinued, includeOpen]);

  const continuedCount = carryOverMeetingId
    ? countContinuedItems(carryOverMeetingId, agendaItems)
    : 0;
  const openCount = carryOverMeetingId
    ? countOpenAgendaItems(carryOverMeetingId, agendaItems)
    : 0;

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setScheduledAt(defaultDateLocal());
      setCarryOverMeetingId("");
      setIncludeContinued(true);
      setIncludeOpen(true);
      setDateError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!carryOverMeetingId) return;
    if (!carryOverCandidates.some((meeting) => meeting.id === carryOverMeetingId)) {
      setCarryOverMeetingId("");
    }
  }, [carryOverMeetingId, carryOverCandidates]);

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setDateError("Enter a meeting title.");
      return;
    }
    const iso = scheduledAt ? parseScheduledDate(scheduledAt) : undefined;
    if (!scheduledAt || !iso) {
      setDateError("Enter a valid date.");
      return;
    }
    setDateError(null);
    setIsSubmitting(true);
    try {
      await onCreate({
        title: trimmedTitle,
        description: description.trim() || undefined,
        scheduledAt: iso,
        carryOverFromMeetingId: carryOverMeetingId || undefined,
        carryOver: carryOverMeetingId
          ? { includeContinued, includeOpen }
          : undefined,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => !isSubmitting && onOpenChange(false)}
      title="New meeting"
      enableDragDismiss={!isSubmitting}
      zIndex={1000}
      desktopMaxWidth="max-w-lg"
      panelClassName="create-meeting-modal"
      ariaLabel="Create meeting"
    >
      <p className="px-5 text-sm text-text-muted -mt-1 mb-4">
        Name your meeting, set the date, and optionally pull in open topics from a previous one.
      </p>

      <div className="px-5 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">Meeting title</label>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (dateError === "Enter a meeting title.") setDateError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            placeholder="Weekly team sync"
            autoFocus={!isMobile}
            enterKeyHint="next"
            className="w-full min-h-[44px] bg-bg-secondary border border-border-glass rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">Description (optional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            placeholder="What is this meeting about?"
            enterKeyHint="next"
            className="w-full min-h-[44px] bg-bg-secondary border border-border-glass rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">Date</label>
          <input
            type="date"
            value={scheduledAt}
            onChange={(e) => {
              setScheduledAt(e.target.value);
              setDateError(null);
            }}
            className="w-full min-h-[44px] bg-bg-secondary border border-border-glass rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">
            Bring in topics from a previous meeting (optional)
          </label>
          <select
            value={carryOverMeetingId}
            onChange={(e) => setCarryOverMeetingId(e.target.value)}
            className="w-full min-h-[44px] bg-bg-secondary border border-border-glass rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40"
          >
            <option value="">Start with a fresh agenda</option>
            {carryOverCandidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
                {m.scheduledAt
                  ? ` (${format(parseISO(m.scheduledAt), "MMM d, yyyy")})`
                  : ""}
              </option>
            ))}
          </select>
          {selectedCarryMeeting && (continuedCount > 0 || openCount > 0) && (
            <div className="rounded-xl border border-border-glass bg-bg-secondary/60 p-3 space-y-2 text-sm text-text-muted">
              {continuedCount > 0 && (
                <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeContinued}
                    onChange={(e) => setIncludeContinued(e.target.checked)}
                    className="rounded border-border-glass"
                  />
                  Include {continuedCount} deferred topic{continuedCount === 1 ? "" : "s"}
                </label>
              )}
              {openCount > 0 && (
                <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeOpen}
                    onChange={(e) => setIncludeOpen(e.target.checked)}
                    className="rounded border-border-glass"
                  />
                  Include {openCount} unresolved topic{openCount === 1 ? "" : "s"}
                </label>
              )}
              {carrySourceItems.length > 0 && (
                <p className="text-xs text-text-faint pt-1">
                  {carrySourceItems.length} topic{carrySourceItems.length === 1 ? "" : "s"} will be
                  added to this agenda.
                </p>
              )}
            </div>
          )}
        </div>

        {dateError && <p className="text-xs text-red-400">{dateError}</p>}
      </div>

      <div className="keyboard-stable-sheet__footer flex justify-end gap-2 px-5 pt-4 mt-4 border-t border-border-glass">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
          className="min-h-[44px] px-4 py-2 rounded-xl text-sm text-text-secondary hover:bg-surface-hover disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={isSubmitting}
          className="min-h-[44px] btn btn-primary px-4 py-2 text-sm inline-flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            "Create meeting"
          )}
        </button>
      </div>
    </BottomSheet>
  );
}