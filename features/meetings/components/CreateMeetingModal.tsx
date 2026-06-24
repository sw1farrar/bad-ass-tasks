"use client";

import React, { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import {
  getCarryOverCandidateMeetings,
  getCarryOverSourceItems,
  type CarryOverOptions,
} from "@/lib/meetings/carryOver";
import { countContinuedItems, countOpenAgendaItems } from "@/lib/meetings/meetingFilters";
import type { Meeting, MeetingAgendaItem } from "@/types";

export interface CreateMeetingInput {
  title: string;
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
  const [title, setTitle] = useState("");
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

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
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-meeting-title"
        className="w-full max-w-lg rounded-2xl border border-border-glass bg-bg p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="create-meeting-title" className="text-lg font-semibold text-text-primary">
            New meeting
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Name your meeting, set the date, and optionally pull in open topics from a previous one.
          </p>
        </div>

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
            autoFocus
            className="w-full bg-bg-secondary border border-border-glass rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40"
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
            className="w-full bg-bg-secondary border border-border-glass rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">
            Bring in topics from a previous meeting (optional)
          </label>
          <select
            value={carryOverMeetingId}
            onChange={(e) => setCarryOverMeetingId(e.target.value)}
            className="w-full bg-bg-secondary border border-border-glass rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40"
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
                <label className="flex items-center gap-2 cursor-pointer">
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
                <label className="flex items-center gap-2 cursor-pointer">
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

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-sm text-text-secondary hover:bg-surface-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={isSubmitting}
            className="btn btn-primary px-4 py-2 text-sm inline-flex items-center gap-2"
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
      </div>
    </div>
  );
}