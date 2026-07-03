"use client";

import React, { useEffect, useState } from "react";
import { ArrowRightCircle, CheckCircle2, ChevronLeft, RotateCcw, Trash2 } from "lucide-react";
import { MeetingResponsiblePicker } from "@/components/MeetingResponsiblePicker";
import type { Meeting, MeetingAgendaEntry, MeetingAgendaItem, WorkspaceMember } from "@/types";
import { MeetingEntryTimeline } from "./MeetingEntryTimeline";
import { MeetingEntryComposer } from "./MeetingEntryComposer";

interface MeetingTopicPanelProps {
  meeting: Meeting;
  item: MeetingAgendaItem | null;
  entries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  currentUserId?: string;
  readOnly?: boolean;
  onUpdateItem: (id: string, updates: Partial<MeetingAgendaItem>) => void;
  onCompleteItem: (id: string) => void;
  onContinueItem: (id: string) => void;
  onReopenItem: (id: string) => void;
  onRequestDeleteItem?: (id: string) => void;
  onAddEntry: (agendaItemId: string, body: string) => void | Promise<void>;
  onUpdateEntry?: (id: string, body: string) => void | Promise<unknown>;
  onRequestDeleteEntry?: (id: string) => void;
  onBackToAgenda?: () => void;
}

export function MeetingTopicPanel({
  meeting,
  item,
  entries,
  members,
  currentUserId,
  readOnly,
  onUpdateItem,
  onCompleteItem,
  onContinueItem,
  onReopenItem,
  onRequestDeleteItem,
  onAddEntry,
  onUpdateEntry,
  onRequestDeleteEntry,
  onBackToAgenda,
}: MeetingTopicPanelProps) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");

  useEffect(() => {
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
  }, [item?.id, item?.title, item?.description]);

  if (!item) {
    return (
      <div className="meetings-topic-panel flex items-center justify-center text-sm text-text-muted p-8">
        Select a topic from the agenda, or add one to begin.
      </div>
    );
  }

  const isCompleted = meeting.status === "completed";
  const topicLocked =
    item.status === "completed" || item.status === "continued" || isCompleted;
  const canTakeNotes = !readOnly && !isCompleted && item.status === "open";
  const canEditMeta = !readOnly && !isCompleted && item.status !== "completed";

  return (
    <div className="meetings-topic-panel flex flex-col min-h-0">
      <div className="shrink-0 px-4 py-3 border-b border-border-glass space-y-3">
        {onBackToAgenda ? (
          <button
            type="button"
            onClick={onBackToAgenda}
            className="flex items-center gap-1 min-h-[44px] text-sm font-medium text-neon-purple-tint -ml-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Agenda
          </button>
        ) : null}
        <div className="flex items-start gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== item.title) {
                onUpdateItem(item.id, { title: title.trim() });
              }
            }}
            disabled={!canEditMeta && isCompleted}
            className="flex-1 min-w-0 bg-transparent text-lg font-semibold focus:outline-none text-text-primary disabled:opacity-70"
            aria-label="Topic title"
          />
          {onRequestDeleteItem && !readOnly && !isCompleted && (
            <button
              type="button"
              onClick={() => onRequestDeleteItem(item.id)}
              className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover shrink-0"
              aria-label="Delete topic"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            const next = description.trim();
            if (next !== (item.description ?? "")) {
              onUpdateItem(item.id, { description: next || null });
            }
          }}
          disabled={!canEditMeta && isCompleted}
          placeholder="Talking points or context for this topic…"
          rows={2}
          className="w-full resize-none bg-bg-secondary border border-border-glass rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint disabled:opacity-70"
          aria-label="Topic description"
        />

        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && !isCompleted ? (
            <MeetingResponsiblePicker
              members={members}
              currentUserId={currentUserId}
              ownerId={item.ownerId}
              ownerName={item.ownerName}
              onChange={({ ownerId, ownerName }) =>
                onUpdateItem(item.id, { ownerId, ownerName })
              }
              compact
              disabled={topicLocked}
            />
          ) : null}
          {!readOnly && !isCompleted && item.status === "open" && (
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => onCompleteItem(item.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-400/90 hover:bg-emerald-400/10"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Complete
              </button>
              <button
                type="button"
                onClick={() => onContinueItem(item.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-400/90 hover:bg-amber-400/10"
              >
                <ArrowRightCircle className="h-3.5 w-3.5" />
                Defer
              </button>
            </div>
          )}
          {!readOnly && !isCompleted && (item.status === "completed" || item.status === "continued") && (
            <button
              type="button"
              onClick={() => onReopenItem(item.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-hover ml-auto"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reopen
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <MeetingEntryTimeline
          entries={entries}
          members={members}
          currentUserId={currentUserId}
          canCompose={canTakeNotes}
          onUpdateEntry={canTakeNotes ? onUpdateEntry : undefined}
          onRequestDeleteEntry={canTakeNotes ? onRequestDeleteEntry : undefined}
        />
      </div>

      {canTakeNotes && (
        <MeetingEntryComposer onSubmit={(body) => onAddEntry(item.id, body)} />
      )}
    </div>
  );
}