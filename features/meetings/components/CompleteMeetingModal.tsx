"use client";

import React from "react";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import type { MeetingAgendaEntry, MeetingAgendaItem } from "@/types";
import { computeCompleteMeetingStats } from "@/lib/meetings/meetingLifecycle";

interface CompleteMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MeetingAgendaItem[];
  entries: MeetingAgendaEntry[];
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function CompleteMeetingModal({
  open,
  onOpenChange,
  items,
  entries,
  isLoading,
  onConfirm,
}: CompleteMeetingModalProps) {
  const decisionCount = entries.filter((e) => e.isDecision || /#decision/i.test(e.body)).length;
  const stats = computeCompleteMeetingStats(items, decisionCount);

  return (
    <ConfirmationModal
      open={open}
      onOpenChange={onOpenChange}
      title="Complete meeting?"
      description="A summary will be generated from your agenda topics and timestamped notes."
      details={
        <ul className="text-sm text-text-muted space-y-1 list-disc pl-4">
          <li>{stats.completedTopics} topic{stats.completedTopics === 1 ? "" : "s"} completed</li>
          <li>{stats.continuedTopics} to carry to next meeting</li>
          {stats.openTopics > 0 && <li>{stats.openTopics} still open</li>}
          {stats.decisionCount > 0 && <li>{stats.decisionCount} decision{stats.decisionCount === 1 ? "" : "s"} logged</li>}
        </ul>
      }
      confirmText="Complete meeting"
      isLoading={isLoading}
      onConfirm={onConfirm}
    />
  );
}