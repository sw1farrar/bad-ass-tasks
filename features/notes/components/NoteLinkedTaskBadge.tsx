"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { NoteLinkedTaskStats } from "../lib/noteLinkedTaskStats";

interface NoteLinkedTaskBadgeProps {
  stats: NoteLinkedTaskStats;
  /** Compact style for the sidebar list; default is slightly larger for the note header. */
  compact?: boolean;
  className?: string;
}

export function NoteLinkedTaskBadge({ stats, compact = false, className }: NoteLinkedTaskBadgeProps) {
  if (stats.total === 0) return null;

  const label = stats.hasOverdue
    ? stats.overdue === 1 && stats.open === 1
      ? "1 overdue"
      : stats.overdue === stats.open
        ? `${stats.overdue} overdue`
        : `${stats.open} open · ${stats.overdue} overdue`
    : stats.hasOpen
      ? stats.open === 1
        ? "1 open"
        : `${stats.open} open`
      : compact
        ? `${stats.total}`
        : stats.total === 1
          ? "1 linked"
          : `${stats.total} linked`;

  const variant = stats.hasOverdue ? "overdue" : stats.hasOpen ? "open" : "complete";

  return (
    <span
      className={cn(
        "note-linked-task-badge",
        compact && "note-linked-task-badge--compact",
        `note-linked-task-badge--${variant}`,
        className,
      )}
      title={
        stats.hasOverdue
          ? `${stats.overdue} overdue linked task${stats.overdue === 1 ? "" : "s"}`
          : stats.hasOpen
            ? `${stats.open} open linked task${stats.open === 1 ? "" : "s"}`
            : `${stats.total} linked task${stats.total === 1 ? "" : "s"} (all complete)`
      }
    >
      {compact && <span className="note-linked-task-badge__icon" aria-hidden="true">↔</span>}
      {label}
    </span>
  );
}