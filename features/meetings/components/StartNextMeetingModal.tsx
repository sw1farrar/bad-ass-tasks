"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import {
  buildNextMeetingTitle,
  type CarryOverOptions,
} from "@/lib/meetings/carryOver";
import { localDateInputValue, parseLocalDateInput } from "@/lib/meetings/meetingDates";
import type { Meeting } from "@/types";

export type StartNextMeetingOptions = CarryOverOptions & {
  /** ISO scheduled time, or null for undated (top of Upcoming queue). */
  scheduledAt: string | null;
  /** Final title for the new meeting (user may edit the suggestion). */
  title: string;
};

interface StartNextMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  continuedCount: number;
  openCount: number;
  isLoading?: boolean;
  /** Required after complete when carry-over items exist — cannot dismiss. */
  required?: boolean;
  /** Source meeting used to suggest the next title. */
  previousMeeting?: Meeting | null;
  onConfirm: (options: StartNextMeetingOptions) => void | Promise<void>;
}

export function StartNextMeetingModal({
  open,
  onOpenChange,
  continuedCount,
  openCount,
  isLoading,
  required = false,
  previousMeeting = null,
  onConfirm,
}: StartNextMeetingModalProps) {
  const [includeContinued, setIncludeContinued] = useState(true);
  const [includeOpen, setIncludeOpen] = useState(true);
  const [dateLocal, setDateLocal] = useState("");
  // Undated by default — only set a date when the user explicitly picks one.
  const [noDate, setNoDate] = useState(true);
  const [dateError, setDateError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  const scheduledPreview = useMemo((): string | null => {
    if (noDate) return null;
    return parseLocalDateInput(dateLocal);
  }, [noDate, dateLocal]);

  const suggestedTitle = useMemo(() => {
    if (!previousMeeting) return "Next meeting";
    return buildNextMeetingTitle(previousMeeting, scheduledPreview);
  }, [previousMeeting, scheduledPreview]);

  useEffect(() => {
    if (!open) return;
    setIncludeContinued(true);
    setIncludeOpen(true);
    setDateLocal("");
    setNoDate(true);
    setDateError(null);
    setTitleError(null);
    setTitleTouched(false);
    setTitle(
      previousMeeting ? buildNextMeetingTitle(previousMeeting, null) : "Next meeting",
    );
  }, [open, previousMeeting]);

  // Keep suggested title in sync with date until the user edits the name.
  useEffect(() => {
    if (!open || titleTouched) return;
    setTitle(suggestedTitle);
  }, [open, suggestedTitle, titleTouched]);

  const carryTotal = continuedCount + openCount;
  const selectionEmpty =
    !required &&
    (!includeContinued || continuedCount === 0) &&
    (!includeOpen || openCount === 0);

  return (
    <ConfirmationModal
      open={open}
      onOpenChange={onOpenChange}
      title={required ? "Create next meeting" : "Start next meeting?"}
      description={
        required
          ? "This meeting has items to carry forward. Create the next meeting to bring over topics and their notes history. The completed meeting will be archived."
          : "A new meeting will be created with unresolved topics from this meeting. The completed meeting will be archived."
      }
      preventDismiss={required}
      details={
        <div className="space-y-3 text-sm text-text-muted">
          {!required && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeContinued}
                  onChange={(e) => setIncludeContinued(e.target.checked)}
                  className="rounded border-border-glass"
                />
                Include {continuedCount} deferred topic{continuedCount === 1 ? "" : "s"}
              </label>
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
              {selectionEmpty && (
                <p className="text-xs text-[var(--priority-p0)]">
                  Select at least one topic group to carry forward.
                </p>
              )}
            </div>
          )}
          {required && (
            <p>
              {carryTotal} topic{carryTotal === 1 ? "" : "s"} and notes will move to the next
              meeting.
            </p>
          )}
          <div className="space-y-2 pt-1 border-t border-border-glass">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-text-secondary">Meeting name</span>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleTouched(true);
                  setTitleError(null);
                }}
                placeholder={suggestedTitle}
                maxLength={200}
                className="w-full rounded-xl border border-border-glass bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-purple/40 min-h-[44px]"
                autoFocus
              />
              {titleError && <p className="text-xs text-[var(--priority-p0)]">{titleError}</p>}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={noDate}
                onChange={(e) => {
                  const next = e.target.checked;
                  setNoDate(next);
                  setDateError(null);
                  if (!next && !dateLocal) {
                    setDateLocal(localDateInputValue());
                  }
                }}
                className="rounded border-border-glass"
              />
              No date — add to top of Upcoming
            </label>
            {!noDate && (
              <label className="block space-y-1">
                <span className="text-xs font-medium text-text-secondary">Meeting date</span>
                <input
                  type="date"
                  value={dateLocal}
                  onChange={(e) => {
                    setDateLocal(e.target.value);
                    setDateError(null);
                  }}
                  className="w-full rounded-xl border border-border-glass bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-purple/40 min-h-[44px]"
                />
              </label>
            )}
            {dateError && <p className="text-xs text-[var(--priority-p0)]">{dateError}</p>}
          </div>
        </div>
      }
      confirmText="Create next meeting"
      isLoading={isLoading}
      onConfirm={async () => {
        if (selectionEmpty) {
          throw new Error("No topics selected to carry forward");
        }
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
          setTitleError("Enter a name for the next meeting.");
          throw new Error("Missing meeting title");
        }
        let scheduledAt: string | null = null;
        if (!noDate) {
          const iso = parseLocalDateInput(dateLocal);
          if (!iso) {
            setDateError("Enter a valid date, or choose No date.");
            throw new Error("Invalid meeting date");
          }
          scheduledAt = iso;
        }
        await onConfirm({
          includeContinued: required ? true : includeContinued,
          includeOpen: required ? true : includeOpen,
          scheduledAt,
          title: trimmedTitle,
        });
      }}
    />
  );
}
