"use client";

import React, { useEffect, useState } from "react";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import type { CarryOverOptions } from "@/lib/meetings/carryOver";

interface StartNextMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  continuedCount: number;
  openCount: number;
  isLoading?: boolean;
  onConfirm: (options: CarryOverOptions) => void | Promise<void>;
}

export function StartNextMeetingModal({
  open,
  onOpenChange,
  continuedCount,
  openCount,
  isLoading,
  onConfirm,
}: StartNextMeetingModalProps) {
  const [includeContinued, setIncludeContinued] = useState(true);
  const [includeOpen, setIncludeOpen] = useState(true);

  useEffect(() => {
    if (open) {
      setIncludeContinued(true);
      setIncludeOpen(true);
    }
  }, [open]);

  return (
    <ConfirmationModal
      open={open}
      onOpenChange={onOpenChange}
      title="Start next meeting?"
      description="A new meeting will be created with unresolved topics from this meeting."
      details={
        <div className="space-y-2 text-sm text-text-muted">
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
        </div>
      }
      confirmText="Start next meeting"
      isLoading={isLoading}
      onConfirm={() => onConfirm({ includeContinued, includeOpen })}
    />
  );
}