"use client";

import React, { useEffect, useState } from "react";
import { ArrowRightCircle, CheckCircle2, RotateCcw } from "lucide-react";
import { TaskAssigneePicker } from "@/components/TaskAssigneePicker";
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
  onAddEntry: (agendaItemId: string, body: string) => void | Promise<void>;
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
  onAddEntry,
}: MeetingTopicPanelProps) {
  const [title, setTitle] = useState(item?.title ?? "");

  useEffect(() => {
    setTitle(item?.title ?? "");
  }, [item?.id, item?.title]);

  if (!item) {
    return (
      <div className="meetings-topic-panel flex items-center justify-center text-sm text-text-muted p-8">
        Select a topic from the agenda, or add one to begin.
      </div>
    );
  }

  const isCompleted = meeting.status === "completed";
  const topicLocked = item.status === "completed" || isCompleted;

  return (
    <div className="meetings-topic-panel flex flex-col min-h-0">
      <div className="shrink-0 px-4 py-3 border-b border-border-glass space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title !== item.title) {
              onUpdateItem(item.id, { title: title.trim() });
            }
          }}
          disabled={readOnly || topicLocked}
          className="w-full bg-transparent text-lg font-semibold focus:outline-none text-text-primary disabled:opacity-70"
          aria-label="Topic title"
        />

        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && !topicLocked ? (
            <TaskAssigneePicker
              members={members}
              currentUserId={currentUserId}
              value={item.ownerId ?? null}
              onChange={(ownerId) => onUpdateItem(item.id, { ownerId })}
              compact
            />
          ) : null}
          {!readOnly && !isCompleted && (
            <div className="flex items-center gap-1 ml-auto">
              {item.status === "completed" || item.status === "continued" ? (
                <button
                  type="button"
                  onClick={() => onReopenItem(item.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-hover"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reopen
                </button>
              ) : (
                <>
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
                    Next meeting
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <MeetingEntryTimeline entries={entries} members={members} currentUserId={currentUserId} />
      </div>

      {!readOnly && !topicLocked && meeting.status === "in_progress" && (
        <MeetingEntryComposer onSubmit={(body) => onAddEntry(item.id, body)} />
      )}
    </div>
  );
}