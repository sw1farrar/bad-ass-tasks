"use client";

import React from "react";
import { X } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import type {
  Meeting,
  MeetingAgendaEntry,
  MeetingAgendaItem,
  WorkspaceMember,
} from "@/types";
import { MeetingTopicPanel } from "./MeetingTopicPanel";

interface MeetingTopicModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting;
  item: MeetingAgendaItem | null;
  entries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  currentUserId?: string;
  readOnly?: boolean;
  autoSelectTitle?: boolean;
  onUpdateItem: (id: string, updates: Partial<MeetingAgendaItem>) => void;
  onCompleteItem: (id: string) => void;
  onContinueItem: (id: string) => void;
  onReopenItem: (id: string) => void;
  onRequestDeleteItem?: (id: string) => void;
  onAddEntry: (agendaItemId: string, body: string) => void | Promise<void>;
  onUpdateEntry?: (id: string, body: string) => void | Promise<unknown>;
  onRequestDeleteEntry?: (id: string) => void;
}

export function MeetingTopicModal({
  open,
  onOpenChange,
  meeting,
  item,
  entries,
  members,
  currentUserId,
  readOnly,
  autoSelectTitle = false,
  onUpdateItem,
  onCompleteItem,
  onContinueItem,
  onReopenItem,
  onRequestDeleteItem,
  onAddEntry,
  onUpdateEntry,
  onRequestDeleteEntry,
}: MeetingTopicModalProps) {
  return (
    <BottomSheet
      open={open}
      onClose={() => onOpenChange(false)}
      showClose={false}
      wrapChildrenInScroll={false}
      desktopMaxWidth="w-full max-w-3xl"
      zIndex={1000}
      panelClassName="meeting-topic-modal flex flex-col"
      ariaLabel={item?.title?.trim() || "Agenda topic"}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 shrink-0 border-b border-border-glass px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">
              Agenda topic
            </p>
            <p className="truncate text-sm font-semibold text-text-primary">
              {item?.title?.trim() || "Untitled topic"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border-glass text-text-muted hover:bg-surface-hover hover:text-text-primary"
            aria-label="Close topic"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="meeting-topic-modal__body flex min-h-0 flex-1 flex-col overflow-hidden">
          <MeetingTopicPanel
            meeting={meeting}
            item={item}
            entries={entries}
            members={members}
            currentUserId={currentUserId}
            readOnly={readOnly}
            autoSelectTitle={autoSelectTitle}
            onUpdateItem={onUpdateItem}
            onCompleteItem={onCompleteItem}
            onContinueItem={onContinueItem}
            onReopenItem={onReopenItem}
            onRequestDeleteItem={onRequestDeleteItem}
            onAddEntry={onAddEntry}
            onUpdateEntry={onUpdateEntry}
            onRequestDeleteEntry={onRequestDeleteEntry}
          />
        </div>
      </div>
    </BottomSheet>
  );
}
