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
import { MeetingHeader } from "./MeetingHeader";
import { MeetingAgendaRail } from "./MeetingAgendaRail";
import { MeetingTopicPanel } from "./MeetingTopicPanel";
import { MeetingSidebar } from "./MeetingSidebar";
import { MeetingSummaryView } from "./MeetingSummaryView";
import { MeetingAgendaView } from "./MeetingAgendaView";
import { CompleteMeetingModal } from "./CompleteMeetingModal";
import { StartNextMeetingModal } from "./StartNextMeetingModal";

interface MeetingWorkspaceProps {
  meeting: Meeting | null;
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
  onStartMeeting: (id: string) => void | Promise<unknown>;
  onCompleteMeeting: (id: string) => void | Promise<unknown>;
  onReopenMeeting: (id: string) => void | Promise<unknown>;
  onStartNextMeeting: (id: string, options: { includeContinued: boolean; includeOpen: boolean }) => void | Promise<Meeting | undefined>;
  onSaveSummaryAsNote?: (meeting: Meeting) => void | Promise<void>;
  showSidebar?: boolean;
}

export function MeetingWorkspace({
  meeting,
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
  onStartMeeting,
  onCompleteMeeting,
  onReopenMeeting,
  onStartNextMeeting,
  onSaveSummaryAsNote,
  showSidebar = true,
}: MeetingWorkspaceProps) {
  const [completeOpen, setCompleteOpen] = useState(false);
  const [nextOpen, setNextOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isStartingNext, setIsStartingNext] = useState(false);
  const [viewMode, setViewMode] = useState<"live" | "agenda" | "summary">("live");

  const selectedItem = useMemo(
    () => agendaItems.find((i) => i.id === selectedAgendaItemId) ?? null,
    [agendaItems, selectedAgendaItemId],
  );

  const itemEntries = useMemo(
    () =>
      selectedAgendaItemId
        ? agendaEntries.filter((e) => e.agendaItemId === selectedAgendaItemId)
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

  const handlePrint = () => {
    if (isCompleted) setViewMode("summary");
    else setViewMode("agenda");
    requestAnimationFrame(() => window.print());
  };

  return (
    <div className="files-detail-column flex flex-1 flex-col min-w-0 min-h-0 h-full meetings-root">
      <MeetingHeader
        meeting={meeting}
        members={members}
        currentUserId={currentUserId}
        onUpdateMeeting={(id, updates) => void onUpdateMeeting(id, updates)}
        onStart={() => void onStartMeeting(meeting.id)}
        onComplete={() => setCompleteOpen(true)}
        onReopen={() => {
          void Promise.resolve(onReopenMeeting(meeting.id)).then(() => setViewMode("live"));
        }}
        onStartNext={() => setNextOpen(true)}
        onPrint={handlePrint}
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
        />
      ) : viewMode === "agenda" ? (
        <MeetingAgendaView
          meeting={meeting}
          items={agendaItems}
          members={members}
          workspaceName={workspaceName}
          currentUserId={currentUserId}
        />
      ) : (
        <div className="meetings-workspace flex flex-1 min-h-0">
          <MeetingAgendaRail
            items={agendaItems}
            selectedId={selectedAgendaItemId}
            readOnly={readOnly}
            onSelect={(id) => onSelectAgendaItem(id)}
            onAdd={() => {
              void Promise.resolve(onAddAgendaItem(meeting.id)).then((item) => {
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
            onAddEntry={(agendaItemId, body) => void onAddEntry(agendaItemId, body)}
          />
          {showSidebar && (
            <MeetingSidebar
              items={agendaItems}
              entries={agendaEntries}
              members={members}
              currentUserId={currentUserId}
            />
          )}
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
            setViewMode("summary");
            toast.success("Meeting completed");
            setCompleteOpen(false);
          } catch {
            toast.error("Could not complete meeting");
          } finally {
            setIsCompleting(false);
          }
        }}
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