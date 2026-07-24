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
import { MeetingAgendaBoard } from "./MeetingAgendaBoard";
import { MeetingTopicModal } from "./MeetingTopicModal";
import { MeetingSummaryView } from "./MeetingSummaryView";
import { MeetingAgendaPreviewModal } from "./MeetingAgendaPreviewModal";
import { MeetingSummaryPreviewModal } from "./MeetingSummaryPreviewModal";
import { CompleteMeetingModal } from "./CompleteMeetingModal";
import {
  StartNextMeetingModal,
  type StartNextMeetingOptions,
} from "./StartNextMeetingModal";

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
  onUnreviewItem: (id: string) => void | Promise<unknown>;
  onReopenItem: (id: string) => void | Promise<unknown>;
  onRequestDeleteAgendaItem?: (id: string) => void;
  onUpdateAgendaEntry?: (id: string, body: string) => void | Promise<unknown>;
  onRequestDeleteAgendaEntry?: (id: string) => void;
  onCompleteMeeting: (id: string) => void | Promise<unknown>;
  onReopenMeeting: (id: string) => void | Promise<unknown>;
  onStartNextMeeting: (
    id: string,
    options: StartNextMeetingOptions,
  ) => void | Promise<{ meeting: Meeting; agendaItems: MeetingAgendaItem[] } | undefined>;
  /** When true, hide the in-workspace next-meeting modal (parent owns the required flow). */
  suppressNextMeetingModal?: boolean;
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
  onUnreviewItem,
  onReopenItem,
  onRequestDeleteAgendaItem,
  onUpdateAgendaEntry,
  onRequestDeleteAgendaEntry,
  onCompleteMeeting,
  onReopenMeeting,
  onStartNextMeeting,
  suppressNextMeetingModal = false,
  onSaveSummaryAsNote,
}: MeetingWorkspaceProps) {
  const [completeOpen, setCompleteOpen] = useState(false);
  const [nextOpen, setNextOpen] = useState(false);
  const [nextSourceMeetingId, setNextSourceMeetingId] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isStartingNext, setIsStartingNext] = useState(false);
  const [agendaPreviewOpen, setAgendaPreviewOpen] = useState(false);
  const [summaryPreviewOpen, setSummaryPreviewOpen] = useState(false);
  const [agendaPreviewIncludeComments, setAgendaPreviewIncludeComments] = useState(false);
  const [autoSelectTitle, setAutoSelectTitle] = useState(false);

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
  const topicModalOpen = !!selectedAgendaItemId && !!selectedItem;

  const closeTopicModal = () => {
    setAutoSelectTitle(false);
    onSelectAgendaItem(null);
  };

  const handleCompleteItem = async (id: string) => {
    await onCompleteItem(id);
    onSelectAgendaItem(null);
  };

  const handleContinueItem = async (id: string) => {
    await onContinueItem(id);
    onSelectAgendaItem(null);
  };

  const handleUnreviewItem = async (id: string) => {
    await onUnreviewItem(id);
  };

  const handleReopenItem = async (id: string) => {
    await onReopenItem(id);
  };

  return (
    <div className="files-detail-column flex flex-1 flex-col min-w-0 min-h-0 h-full meetings-root">
      <MeetingHeader
        meeting={meeting}
        meetings={meetings}
        agendaItems={agendaItems}
        onUpdateMeeting={(id, updates) => void onUpdateMeeting(id, updates)}
        onComplete={() => setCompleteOpen(true)}
        onReopen={() => void onReopenMeeting(meeting.id)}
        onStartNext={() => {
          setNextSourceMeetingId(meeting.id);
          setNextOpen(true);
        }}
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
        <MeetingAgendaBoard
          items={agendaItems}
          entries={agendaEntries}
          members={members}
          currentUserId={currentUserId}
          readOnly={readOnly}
          onSelect={(id) => {
            setAutoSelectTitle(false);
            onSelectAgendaItem(id);
          }}
          onAdd={(title, options) => {
            const openInModal = options?.openInModal !== false;
            if (openInModal) setAutoSelectTitle(true);
            else setAutoSelectTitle(false);
            void Promise.resolve(onAddAgendaItem(meeting.id, title)).then((item) => {
              if (item && openInModal) onSelectAgendaItem(item.id);
            });
          }}
          onReorder={(ids) => void onReorderAgendaItems(meeting.id, ids)}
          onCompleteItem={(id) => void handleCompleteItem(id)}
          onContinueItem={(id) => void handleContinueItem(id)}
          onUnreviewItem={(id) => void handleUnreviewItem(id)}
          onReopenItem={(id) => void handleReopenItem(id)}
        />
      )}

      <MeetingTopicModal
        open={topicModalOpen}
        onOpenChange={(open) => {
          if (!open) closeTopicModal();
        }}
        meeting={meeting}
        item={selectedItem}
        entries={itemEntries}
        members={members}
        currentUserId={currentUserId}
        readOnly={readOnly}
        autoSelectTitle={autoSelectTitle}
        onUpdateItem={(id, updates) => void onUpdateAgendaItem(id, updates)}
        onCompleteItem={(id) => void handleCompleteItem(id)}
        onContinueItem={(id) => void handleContinueItem(id)}
        onReopenItem={(id) => {
          // In the topic modal, Reopen on a reviewed/active topic means unreview.
          if (selectedItem && selectedItem.status !== "completed") {
            void handleUnreviewItem(id);
            return;
          }
          void handleReopenItem(id);
        }}
        onRequestDeleteItem={
          onRequestDeleteAgendaItem
            ? (id) => {
                onRequestDeleteAgendaItem(id);
                closeTopicModal();
              }
            : undefined
        }
        onAddEntry={(agendaItemId, body) => void onAddEntry(agendaItemId, body)}
        onUpdateEntry={onUpdateAgendaEntry}
        onRequestDeleteEntry={onRequestDeleteAgendaEntry}
      />

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

      {!suppressNextMeetingModal && (
        <StartNextMeetingModal
          open={nextOpen}
          onOpenChange={(open) => {
            setNextOpen(open);
            if (!open) setNextSourceMeetingId(null);
          }}
          continuedCount={continuedCount}
          openCount={openCount}
          isLoading={isStartingNext}
          onConfirm={async (options) => {
            const sourceId = nextSourceMeetingId ?? meeting.id;
            setIsStartingNext(true);
            try {
              const next = await onStartNextMeeting(sourceId, options);
              if (next) {
                toast.success("Next meeting created");
                setNextOpen(false);
                setNextSourceMeetingId(null);
              } else {
                throw new Error("Next meeting was not created");
              }
            } catch {
              toast.error("Could not create next meeting");
              throw new Error("Could not create next meeting");
            } finally {
              setIsStartingNext(false);
            }
          }}
        />
      )}
    </div>
  );
}
