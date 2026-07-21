"use client";

import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  MessageSquareText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MeetingAgendaItem, WorkspaceMember } from "@/types";
import { getAgendaItemOwnerLabel } from "@/lib/meetings/agendaOwners";
import { isAgendaItemReviewed } from "@/lib/meetings/agendaReviewed";

interface MeetingAgendaTileProps {
  item: MeetingAgendaItem;
  members: WorkspaceMember[];
  currentUserId?: string;
  entryCount?: number;
  column: "active" | "completed";
  readOnly?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onOpen: () => void;
  onMove: () => void;
  onToggleReviewed?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function MeetingAgendaTile({
  item,
  members,
  currentUserId,
  entryCount = 0,
  column,
  readOnly,
  canMoveUp,
  canMoveDown,
  onOpen,
  onMove,
  onToggleReviewed,
  onMoveUp,
  onMoveDown,
}: MeetingAgendaTileProps) {
  const owner = getAgendaItemOwnerLabel(item, members, currentUserId);
  const talkingPoints = item.description?.trim() ?? "";
  const isReviewed = isAgendaItemReviewed(item);
  const isCompletedColumn = column === "completed";
  const showReorder =
    !readOnly && !isCompletedColumn && (!!onMoveUp || !!onMoveDown);
  const showReviewedToggle =
    !readOnly && column === "active" && !!onToggleReviewed;

  return (
    <div
      className={cn(
        "meeting-agenda-tile group relative flex items-stretch gap-0 rounded-2xl border text-left transition",
        isCompletedColumn
          ? "meeting-agenda-tile--completed border-border-glass bg-bg-secondary/60"
          : isReviewed
            ? "meeting-agenda-tile--reviewed border-amber-400/30 bg-amber-400/[0.06]"
            : "border-border-glass bg-bg-secondary/80 hover:border-neon-purple/35 hover:bg-neon-purple/[0.06]",
      )}
    >
      {showReorder && (
        <div className="meeting-agenda-tile__reorder flex flex-col items-center justify-center gap-0.5 shrink-0 border-r border-border-glass px-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp?.();
            }}
            disabled={!canMoveUp}
            className="p-1 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary disabled:opacity-30"
            aria-label="Move topic up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown?.();
            }}
            disabled={!canMoveDown}
            className="p-1 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary disabled:opacity-30"
            aria-label="Move topic down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {!readOnly && isCompletedColumn && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMove();
          }}
          className="flex w-11 shrink-0 items-center justify-center border-r border-border-glass text-text-muted transition hover:bg-neon-purple/10 hover:text-neon-purple-tint"
          aria-label="Move back to active"
          title="Move back to active"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
        </button>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col gap-2 px-4 py-3.5 text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple/40"
      >
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 text-sm font-semibold leading-snug text-text-primary",
              isCompletedColumn && "text-text-secondary line-through decoration-text-faint",
            )}
          >
            {item.title.trim() || "Untitled topic"}
          </span>
          {isReviewed && (
            <span className="shrink-0 rounded-md border border-amber-400/35 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400/90">
              Reviewed
            </span>
          )}
        </div>

        {(owner || entryCount > 0) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
            {owner ? <span className="truncate">{owner}</span> : null}
            {entryCount > 0 ? (
              <span className="inline-flex items-center gap-1 shrink-0">
                <MessageSquareText className="h-3 w-3" />
                {entryCount}
              </span>
            ) : null}
          </div>
        )}

        {talkingPoints ? (
          <p className="line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-text-secondary">
            {talkingPoints}
          </p>
        ) : null}
      </button>

      {!readOnly && column === "active" && (
        <div className="meeting-agenda-tile__actions flex shrink-0 self-stretch">
          {showReviewedToggle && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleReviewed();
              }}
              className={cn(
                "flex w-11 items-center justify-center border-l border-border-glass transition",
                isReviewed
                  ? "bg-amber-400/15 text-amber-400 hover:bg-amber-400/25"
                  : "text-amber-400/70 hover:bg-amber-400/10 hover:text-amber-400",
              )}
              aria-label={isReviewed ? "Mark unreviewed" : "Mark reviewed"}
              aria-pressed={isReviewed}
              title={isReviewed ? "Mark unreviewed" : "Mark reviewed"}
            >
              <BadgeCheck className="h-4 w-4" strokeWidth={2.25} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMove();
            }}
            className="flex w-11 items-center justify-center border-l border-border-glass text-emerald-400/80 transition hover:bg-emerald-400/10 hover:text-emerald-400"
            aria-label="Mark completed"
            title="Mark completed"
          >
            <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
      )}
    </div>
  );
}
