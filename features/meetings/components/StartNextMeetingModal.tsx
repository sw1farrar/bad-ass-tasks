"use client";

import React, { useEffect, useState } from "react";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import type { CarryOverOptions } from "@/lib/meetings/carryOver";
import { localDateInputValue, parseLocalDateInput } from "@/lib/meetings/meetingDates";

export type StartNextMeetingOptions = CarryOverOptions & {
  /** ISO scheduled time, or null for undated (top of Upcoming queue). */
  scheduledAt: string | null;
};

interface StartNextMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  continuedCount: number;
  openCount: number;
  isLoading?: boolean;
  /** Required after complete when carry-over items exist — cannot dismiss. */
  required?: boolean;
  onConfirm: (options: StartNextMeetingOptions) => void | Promise<void>;
}

export function StartNextMeetingModal({
  open,
  onOpenChange,
  continuedCount,
  openCount,
  isLoading,
  required = false,
  onConfirm,
}: StartNextMeetingModalProps) {
  const [includeContinued, setIncludeContinued] = useState(true);
  const [includeOpen, setIncludeOpen] = useState(true);
  const [dateLocal, setDateLocal] = useState(localDateInputValue);
  const [noDate, setNoDate] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIncludeContinued(true);
      setIncludeOpen(true);
      setDateLocal(localDateInputValue());
      setNoDate(false);
      setDateError(null);
    }
  }, [open]);

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
          ? "This meeting has items to carry forward. Create the next meeting to bring over topics and their notes history."
          : "A new meeting will be created with unresolved topics from this meeting."
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
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={noDate}
                onChange={(e) => {
                  setNoDate(e.target.checked);
                  setDateError(null);
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
        });
      }}
    />
  );
}
