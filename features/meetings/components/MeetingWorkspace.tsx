"use client";

import React, { useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import type {
  Meeting,
  MeetingAgendaEntry,
  MeetingAgendaItem,
  WorkspaceMember,
} from "@/types";
import { sortMeetingEntriesNewestFirst } from "@/lib/meetings/meetingFilters";
import { MeetingHeader } from "./MeetingHeader";
import { MeetingAgendaRail } from "./MeetingAgendaRail";
import { MeetingTopicPanel } from "./MeetingTopicPanel";

import { MeetingSummaryView } from "./MeetingSummaryView";
import { MeetingAgendaPreviewModal } from "./MeetingAgendaPreviewModal";
import { MeetingSummaryPreviewModal } from "./MeetingSummaryPreviewModal";
import { CompleteMeetingModal } from "./CompleteMeetingModal";
import { StartNextMeetingModal } from "./StartNextMeetingModal";

interface MeetingWorkspaceProps {
  meeting: Meeting | null;
  meetings: Meeting[];
  agendaItems: MeetingAgendaItem[];
  agendaEntries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  workspaceName?: string;
  currentUserId?: string;
  selectedAgendaItemId: string | null;
  onSelectAgendaItem: (id: string | null) => void;
  onUpdateMeeting: (id: string, updates: Partial<Meeting>) => void | Promise<unknown>;
  onAddAgendaItem: (meetingId: string, title?: string) => void | Promise<MeetingAgendaItem | undefined>;
  onUpdateAgendaItem: (id: string, updates: Partial<MeetingAgendaItem>) => void | Promise<unknown>;
  onReorderAgendaItems: (meetingId: string, orderedIds: string[]) => void | Promise<unknown>;
  onAddEntry: (agendaItemId: string, body: string) => void | Promise<unknown>;
  onCompleteItem: (id: string) => void | Promise<unknown>;
  onContinueItem: (id: string) => void | Promise<unknown>;
  onReopenItem: (id: string) => void | Promise<unknown>;
  onRequestDeleteAgendaItem?: (id: string) => void;
  onUpdateAgendaEntry?: (id: string, body: string) => void | Promise<unknown>;
  onRequestDeleteAgendaEntry?: (id: string) => void;
  onCompleteMeeting: (id: string) => void | Promise<unknown>;
  onReopenMeeting: (id: string) => void | Promise<unknown>;
  onStartNextMeeting: (
    id: string,
    options: { includeContinued: boolean; includeOpen: boolean },
  ) => void | Promise<{ meeting: Meeting; agendaItems: MeetingAgendaItem[] } | undefined>;
  onSaveSummaryAsNote?: (meeting: Meeting) => void | Promise<void>;
}

export function MeetingWorkspace({
  meeting,
  meetings,
  agendaItems,
  agendaEntries,
  members,
  workspaceName,
  currentUserId,
  selectedAgendaItemId,
  onSelectAgendaItem,
  onUpdateMeeting,
  onAddAgendaItem,
  onUpdateAgendaItem,
  onReorderAgendaItems,
  onAddEntry,
  onCompleteItem,
  onContinueItem,
  onReopenItem,
  onRequestDeleteAgendaItem,
  onUpdateAgendaEntry,
  onRequestDeleteAgendaEntry,
  onCompleteMeeting,
  onReopenMeeting,
  onStartNextMeeting,
  onSaveSummaryAsNote,
}: MeetingWorkspaceProps) {
  const [completeOpen, setCompleteOpen] = useState(false);
  const [nextOpen, setNextOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isStartingNext, setIsStartingNext] = useState(false);
  const [agendaPreviewOpen, setAgendaPreviewOpen] = useState(false);
  const [summaryPreviewOpen, setSummaryPreviewOpen] = useState(false);
  const [agendaPreviewIncludeComments, setAgendaPreviewIncludeComments] = useState(false);

  const selectedItem = useMemo(
    () => agendaItems.find((i) => i.id === selectedAgendaItemId) ?? null,
    [agendaItems, selectedAgendaItemId],
  );

  const itemEntries = useMemo(
    () =>
      selectedAgendaItemId
        ? sortMeetingEntriesNewestFirst(
            agendaEntries.filter((e) => e.agendaItemId === selectedAgendaItemId),
          )
        : [],
    [agendaEntries, selectedAgendaItemId],
  );

  const continuedCount = agendaItems.filter((i) => i.status === "continued").length;
  const openCount = agendaItems.filter(
    (i) => i.status === "open" || i.status === "in_progress",
  ).length;

  if (!meeting) {
    return (
      <div className="files-detail-column flex flex-1 flex-col items-center justify-center min-h-0 p-8 text-center">
        <Calendar className="h-12 w-12 text-neon-purple/40 mb-4" />
        <p className="text-sm text-text-muted max-w-sm">
          Select a meeting from the list, or schedule a new one to build your agenda.
        </p>
      </div>
    );
  }

  const isCompleted = meeting.status === "completed";
  const readOnly = isCompleted;

  return (
    <div className="files-detail-column flex flex-1 flex-col min-w-0 min-h-0 h-full meetings-root">
      <MeetingHeader
        meeting={meeting}
        meetings={meetings}
        onUpdateMeeting={(id, updates) => void onUpdateMeeting(id, updates)}
        onComplete={() => setCompleteOpen(true)}
        onReopen={() => void onReopenMeeting(meeting.id)}
        onStartNext={() => setNextOpen(true)}
        onOpenAgendaPreview={() => {
          setAgendaPreviewIncludeComments(false);
          setAgendaPreviewOpen(true);
        }}
        onOpenSummaryPreview={() => setSummaryPreviewOpen(true)}
      />

      {isCompleted ? (
        <MeetingSummaryView
          meeting={meeting}
          items={agendaItems}
          entries={agendaEntries}
          members={members}
          workspaceName={workspaceName}
          currentUserId={currentUserId}
          onSaveAsNote={
            onSaveSummaryAsNote ? () => void onSaveSummaryAsNote(meeting) : undefined
          }
          onOpenAgendaPreview={() => {
            setAgendaPreviewIncludeComments(true);
            setAgendaPreviewOpen(true);
          }}
        />
      ) : (
        <div className="meetings-workspace flex flex-1 min-h-0">
          <MeetingAgendaRail
            items={agendaItems}
            members={members}
            currentUserId={currentUserId}
            selectedId={selectedAgendaItemId}
            readOnly={readOnly}
            onSelect={(id) => onSelectAgendaItem(id)}
            onAdd={(title) => {
              void Promise.resolve(onAddAgendaItem(meeting.id, title)).then((item) => {
                if (item) onSelectAgendaItem(item.id);
              });
            }}
            onReorder={(ids) => void onReorderAgendaItems(meeting.id, ids)}
          />
          <MeetingTopicPanel
            meeting={meeting}
            item={selectedItem}
            entries={itemEntries}
            members={members}
            currentUserId={currentUserId}
            readOnly={readOnly}
            onUpdateItem={(id, updates) => void onUpdateAgendaItem(id, updates)}
            onCompleteItem={(id) => void onCompleteItem(id)}
            onContinueItem={(id) => void onContinueItem(id)}
            onReopenItem={(id) => void onReopenItem(id)}
            onRequestDeleteItem={onRequestDeleteAgendaItem}
            onAddEntry={(agendaItemId, body) => void onAddEntry(agendaItemId, body)}
            onUpdateEntry={onUpdateAgendaEntry}
            onRequestDeleteEntry={onRequestDeleteAgendaEntry}
          />
        </div>
      )}

      <CompleteMeetingModal
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        items={agendaItems}
        entries={agendaEntries}
        isLoading={isCompleting}
        onConfirm={async () => {
          setIsCompleting(true);
          try {
            await onCompleteMeeting(meeting.id);
            toast.success("Meeting completed");
            setCompleteOpen(false);
          } catch {
            toast.error("Could not complete meeting");
          } finally {
            setIsCompleting(false);
          }
        }}
      />

      <MeetingAgendaPreviewModal
        open={agendaPreviewOpen}
        onOpenChange={setAgendaPreviewOpen}
        meeting={meeting}
        items={agendaItems}
        entries={agendaEntries}
        members={members}
        workspaceName={workspaceName}
        currentUserId={currentUserId}
        defaultIncludeComments={agendaPreviewIncludeComments}
      />

      <MeetingSummaryPreviewModal
        open={summaryPreviewOpen}
        onOpenChange={setSummaryPreviewOpen}
        meeting={meeting}
        items={agendaItems}
        entries={agendaEntries}
        members={members}
        workspaceName={workspaceName}
        currentUserId={currentUserId}
      />

      <StartNextMeetingModal
        open={nextOpen}
        onOpenChange={setNextOpen}
        continuedCount={continuedCount}
        openCount={openCount}
        isLoading={isStartingNext}
        onConfirm={async (options) => {
          setIsStartingNext(true);
          try {
            const next = await onStartNextMeeting(meeting.id, options);
            if (next) {
              toast.success("Next meeting created");
              setNextOpen(false);
            }
          } catch {
            toast.error("Could not create next meeting");
          } finally {
            setIsStartingNext(false);
          }
        }}
      />
    </div>
  );
}