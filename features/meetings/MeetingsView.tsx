"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import type {
  Meeting,
  MeetingAgendaEntry,
  MeetingAgendaItem,
  WorkspaceMember,
} from "@/types";
import {
  readForcedNextMeetingId,
  resolveForcedNextMeetingId,
  writeForcedNextMeetingId,
} from "@/lib/meetings/forcedNextMeeting";
import {
  countContinuedItems,
  countOpenAgendaItems,
  filterMeetingsBySearch,
  sortAgendaItems,
  sortMeetings,
} from "@/lib/meetings/meetingFilters";
import { computeCompleteMeetingStats } from "@/lib/meetings/meetingLifecycle";
import {
  buildDestructiveConfirmContent,
  type PendingDestructiveDelete,
} from "@/lib/notebooks/destructiveConfirm";
import { CopyMeetingModal } from "./components/CopyMeetingModal";
import { CreateMeetingModal } from "./components/CreateMeetingModal";
import { MeetingRail } from "./components/MeetingRail";
import { MeetingStream } from "./components/MeetingStream";
import { MeetingWorkspace } from "./components/MeetingWorkspace";
import { StartNextMeetingModal } from "./components/StartNextMeetingModal";
import "../files/files-workspace.css";
import "./meetings-workspace.css";

export interface MeetingsViewProps {
  workspaceId: string;
  workspaceName?: string;
  meetings: Meeting[];
  archivedMeetings?: Meeting[];
  meetingAgendaItems: MeetingAgendaItem[];
  meetingAgendaEntries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  currentUserId?: string;
  selectedMeetingId: string | null;
  selectedAgendaItemId: string | null;
  onSelectMeeting: (id: string | null) => void;
  onSelectAgendaItem: (id: string | null) => void;
  onAddMeeting: (input?: {
    title?: string;
    description?: string | null;
    scheduledAt?: string | null;
    carryOverFromMeetingId?: string | null;
    carryOver?: { includeContinued: boolean; includeOpen: boolean };
  }) => Promise<{ meeting: Meeting; agendaItems: MeetingAgendaItem[] }>;
  onUpdateMeeting: (id: string, updates: Partial<Meeting>) => Promise<unknown>;
  onDeleteMeeting: (id: string) => Promise<unknown>;
  onAddAgendaItem: (meetingId: string, title?: string) => Promise<MeetingAgendaItem | undefined>;
  onUpdateAgendaItem: (id: string, updates: Partial<MeetingAgendaItem>) => Promise<unknown>;
  onReorderAgendaItems: (meetingId: string, orderedIds: string[]) => Promise<unknown>;
  onAddAgendaEntry: (agendaItemId: string, body: string) => Promise<unknown>;
  onUpdateAgendaEntry: (id: string, body: string) => void | Promise<unknown>;
  onDeleteAgendaEntry: (id: string) => void | Promise<unknown>;
  onCompleteAgendaItem: (id: string) => Promise<unknown>;
  onContinueAgendaItem: (id: string) => Promise<unknown>;
  onUnreviewAgendaItem: (id: string) => Promise<unknown>;
  onReopenAgendaItem: (id: string) => Promise<unknown>;
  onDeleteAgendaItem: (id: string) => Promise<unknown>;
  onCompleteMeeting: (id: string) => Promise<unknown>;
  onReopenMeeting: (id: string) => Promise<unknown>;
  onStartNextMeeting: (
    id: string,
    options: {
      includeContinued: boolean;
      includeOpen: boolean;
      scheduledAt: string | null;
    },
  ) => Promise<{ meeting: Meeting; agendaItems: MeetingAgendaItem[] } | undefined>;
  onDuplicateMeeting: (
    id: string,
    options: {
      title?: string;
      scheduledAt?: string | null;
      includeNotes: boolean;
      agendaItemIds?: string[];
    },
  ) => Promise<{ meeting: Meeting; agendaItems: MeetingAgendaItem[] } | undefined>;
  onSaveSummaryAsNote?: (meeting: Meeting) => Promise<void>;
}

export function MeetingsView({
  workspaceId,
  workspaceName,
  meetings,
  archivedMeetings = [],
  meetingAgendaItems,
  meetingAgendaEntries,
  members,
  currentUserId,
  selectedMeetingId,
  selectedAgendaItemId,
  onSelectMeeting,
  onSelectAgendaItem,
  onAddMeeting,
  onUpdateMeeting,
  onDeleteMeeting,
  onAddAgendaItem,
  onUpdateAgendaItem,
  onReorderAgendaItems,
  onAddAgendaEntry,
  onUpdateAgendaEntry,
  onDeleteAgendaEntry,
  onCompleteAgendaItem,
  onContinueAgendaItem,
  onUnreviewAgendaItem,
  onReopenAgendaItem,
  onDeleteAgendaItem,
  onCompleteMeeting,
  onReopenMeeting,
  onStartNextMeeting,
  onDuplicateMeeting,
  onSaveSummaryAsNote,
}: MeetingsViewProps) {
  const isMobile = useIsMobileViewport();
  const isDesktop = !isMobile;
  const [libraryView, setLibraryView] = useState<"active" | "archived">("active");
  const [meetingSearchQuery, setMeetingSearchQuery] = useState("");
  const isArchivedView = libraryView === "archived";
  const sourceMeetings = isArchivedView ? archivedMeetings : meetings;

  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [createMeetingOpen, setCreateMeetingOpen] = useState(false);
  /** Survives unmount + refresh until carry-over is created or no longer needed. */
  const [forcedNextMeetingId, setForcedNextMeetingId] = useState<string | null>(() =>
    readForcedNextMeetingId(workspaceId),
  );
  const [isStartingForcedNext, setIsStartingForcedNext] = useState(false);

  useEffect(() => {
    setForcedNextMeetingId(readForcedNextMeetingId(workspaceId));
  }, [workspaceId]);

  useEffect(() => {
    setForcedNextMeetingId((current) =>
      resolveForcedNextMeetingId(
        workspaceId,
        current ?? readForcedNextMeetingId(workspaceId),
        [...meetings, ...archivedMeetings],
        meetingAgendaItems,
      ),
    );
  }, [workspaceId, meetings, archivedMeetings, meetingAgendaItems]);
  const [pendingDeleteMeetingId, setPendingDeleteMeetingId] = useState<string | null>(null);
  const [pendingCopyMeetingId, setPendingCopyMeetingId] = useState<string | null>(null);
  const [isCopyingMeeting, setIsCopyingMeeting] = useState(false);
  const [isDeletingMeeting, setIsDeletingMeeting] = useState(false);
  const [pendingDestructiveDelete, setPendingDestructiveDelete] =
    useState<PendingDestructiveDelete | null>(null);
  const [isDeletingDestructive, setIsDeletingDestructive] = useState(false);

  const filteredMeetings = useMemo(
    () =>
      sortMeetings(
        filterMeetingsBySearch(sourceMeetings, meetingSearchQuery, {
          agendaItems: meetingAgendaItems,
          agendaEntries: meetingAgendaEntries,
        }),
      ),
    [sourceMeetings, meetingSearchQuery, meetingAgendaItems, meetingAgendaEntries],
  );

  const selectedMeeting = useMemo(
    () =>
      [...meetings, ...archivedMeetings].find((m) => m.id === selectedMeetingId) ?? null,
    [meetings, archivedMeetings, selectedMeetingId],
  );

  const selectedMeetingAgendaItems = useMemo(() => {
    if (!selectedMeetingId) return [];
    return sortAgendaItems(
      meetingAgendaItems.filter((i) => i.meetingId === selectedMeetingId),
    );
  }, [meetingAgendaItems, selectedMeetingId]);

  const selectedMeetingEntries = useMemo(() => {
    const itemIds = new Set(selectedMeetingAgendaItems.map((i) => i.id));
    return meetingAgendaEntries.filter((e) => itemIds.has(e.agendaItemId));
  }, [meetingAgendaEntries, selectedMeetingAgendaItems]);

  const pendingDeleteMeeting = useMemo(
    () =>
      [...meetings, ...archivedMeetings].find((m) => m.id === pendingDeleteMeetingId) ?? null,
    [meetings, archivedMeetings, pendingDeleteMeetingId],
  );

  const pendingCopyMeeting = useMemo(
    () =>
      [...meetings, ...archivedMeetings].find((m) => m.id === pendingCopyMeetingId) ?? null,
    [meetings, archivedMeetings, pendingCopyMeetingId],
  );

  const pendingCopyAgendaItems = useMemo(() => {
    if (!pendingCopyMeetingId) return [];
    return sortAgendaItems(
      meetingAgendaItems.filter((i) => i.meetingId === pendingCopyMeetingId),
    );
  }, [meetingAgendaItems, pendingCopyMeetingId]);

  const pendingCopyAgendaEntries = useMemo(() => {
    if (!pendingCopyMeetingId) return [];
    const itemIds = new Set(pendingCopyAgendaItems.map((i) => i.id));
    return meetingAgendaEntries.filter((e) => itemIds.has(e.agendaItemId));
  }, [meetingAgendaEntries, pendingCopyAgendaItems, pendingCopyMeetingId]);

  const destructiveConfirm = useMemo(
    () =>
      buildDestructiveConfirmContent(pendingDestructiveDelete, {
        tasks: [],
        taskProgress: [],
        investments: [],
        investmentNotes: [],
        customers: [],
        customerNotes: [],
        competitors: [],
        competitorNotes: [],
        agendaItems: meetingAgendaItems,
        agendaEntries: meetingAgendaEntries,
      }),
    [pendingDestructiveDelete, meetingAgendaItems, meetingAgendaEntries],
  );

  const showMobileMeetingDetail = isMobile && !!selectedMeetingId;

  const forcedNextContinuedCount = forcedNextMeetingId
    ? countContinuedItems(forcedNextMeetingId, meetingAgendaItems)
    : 0;
  const forcedNextOpenCount = forcedNextMeetingId
    ? countOpenAgendaItems(forcedNextMeetingId, meetingAgendaItems)
    : 0;

  const handleCompleteMeeting = useCallback(
    async (id: string) => {
      const items = meetingAgendaItems.filter((item) => item.meetingId === id);
      const stats = computeCompleteMeetingStats(items, 0);
      await onCompleteMeeting(id);
      if (stats.continuedTopics > 0) {
        writeForcedNextMeetingId(workspaceId, id);
        setForcedNextMeetingId(id);
      }
    },
    [meetingAgendaItems, onCompleteMeeting, workspaceId],
  );

  const handleStartNextMeeting = useCallback(
    async (
      id: string,
      options: {
        includeContinued: boolean;
        includeOpen: boolean;
        scheduledAt: string | null;
      },
    ) => {
      const result = await onStartNextMeeting(id, options);
      if (result) {
        writeForcedNextMeetingId(workspaceId, null);
        setForcedNextMeetingId((current) => (current === id ? null : current));
        onSelectMeeting(result.meeting.id);
        const firstItem = [...result.agendaItems].sort((a, b) => a.sortOrder - b.sortOrder)[0];
        if (firstItem) onSelectAgendaItem(firstItem.id);
      }
      return result;
    },
    [onStartNextMeeting, onSelectMeeting, onSelectAgendaItem, workspaceId],
  );

  const handleAddMeeting = useCallback(async (input: {
    title: string;
    description?: string;
    scheduledAt?: string;
    carryOverFromMeetingId?: string;
    carryOver?: { includeContinued: boolean; includeOpen: boolean };
  }) => {
    setIsCreatingMeeting(true);
    try {
      const { meeting, agendaItems: createdItems } = await onAddMeeting({
        title: input.title,
        description: input.description ?? null,
        scheduledAt: input.scheduledAt ?? null,
        carryOverFromMeetingId: input.carryOverFromMeetingId ?? null,
        carryOver: input.carryOver,
      });
      onSelectMeeting(meeting.id);
      const firstItem = [...createdItems].sort((a, b) => a.sortOrder - b.sortOrder)[0];
      if (firstItem) onSelectAgendaItem(firstItem.id);
      toast.success("Meeting scheduled");
    } catch {
      toast.error("Could not create meeting");
      throw new Error("create meeting failed");
    } finally {
      setIsCreatingMeeting(false);
      setCreateMeetingOpen(false);
    }
  }, [onAddMeeting, onSelectMeeting, onSelectAgendaItem]);

  const handleDuplicateMeeting = useCallback(async (options: {
    title?: string;
    scheduledAt?: string | null;
    includeNotes: boolean;
    agendaItemIds?: string[];
  }) => {
    if (!pendingCopyMeetingId) return;
    setIsCopyingMeeting(true);
    try {
      const result = await onDuplicateMeeting(pendingCopyMeetingId, options);
      if (!result) throw new Error("copy meeting failed");
      onSelectMeeting(result.meeting.id);
      const firstItem = [...result.agendaItems].sort((a, b) => a.sortOrder - b.sortOrder)[0];
      if (firstItem) onSelectAgendaItem(firstItem.id);
      toast.success(
        options.includeNotes ? "Meeting copied with notes" : "Meeting copied",
      );
      setPendingCopyMeetingId(null);
    } catch {
      toast.error("Could not copy meeting");
    } finally {
      setIsCopyingMeeting(false);
    }
  }, [pendingCopyMeetingId, onDuplicateMeeting, onSelectMeeting, onSelectAgendaItem]);

  const handleConfirmDestructiveDelete = useCallback(async () => {
    if (!pendingDestructiveDelete) return;
    setIsDeletingDestructive(true);
    try {
      switch (pendingDestructiveDelete.kind) {
        case "agendaItem":
          await onDeleteAgendaItem(pendingDestructiveDelete.id);
          toast.success("Topic deleted");
          break;
        case "agendaEntry":
          await onDeleteAgendaEntry(pendingDestructiveDelete.id);
          toast.success("Note deleted");
          break;
        default:
          break;
      }
    } catch {
      toast.error("Could not complete delete");
    } finally {
      setIsDeletingDestructive(false);
      setPendingDestructiveDelete(null);
    }
  }, [pendingDestructiveDelete, onDeleteAgendaItem, onDeleteAgendaEntry]);

  const meetingList = (
    <MeetingStream
      meetings={filteredMeetings}
      agendaItems={meetingAgendaItems}
      selectedId={selectedMeetingId}
      onSelect={(id) => onSelectMeeting(id)}
      onDelete={(id) => setPendingDeleteMeetingId(id)}
      onCopy={(id) => setPendingCopyMeetingId(id)}
      onArchive={
        isArchivedView
          ? undefined
          : (id) => {
              void onUpdateMeeting(id, { archived: true });
              toast.success("Meeting archived");
            }
      }
      onUnarchive={
        isArchivedView
          ? (id) => {
              void onUpdateMeeting(id, { archived: false });
              toast.success("Meeting restored");
            }
          : undefined
      }
      isArchivedView={isArchivedView}
      emptyMessage={
        meetingSearchQuery.trim()
          ? "No meetings match your search."
          : isArchivedView
            ? "No archived meetings."
            : undefined
      }
    />
  );

  return (
    <div
      className={cn(
        "files-root meetings-root flex flex-col md:flex-row h-full min-h-0 overflow-hidden max-w-full min-w-0",
        showMobileMeetingDetail && "files-mobile-detail",
      )}
      data-workspace-id={workspaceId}
    >
      <MeetingRail
        isDesktop={isDesktop}
        onNewMeeting={() => setCreateMeetingOpen(true)}
        isCreating={isCreatingMeeting}
        searchQuery={meetingSearchQuery}
        onSearchQueryChange={setMeetingSearchQuery}
        libraryView={libraryView}
        onLibraryViewChange={setLibraryView}
        archivedCount={archivedMeetings.length}
        listContent={isDesktop ? meetingList : undefined}
      />

      {!isDesktop && !showMobileMeetingDetail && (
        <div className="files-list-column w-full min-w-0 max-w-full flex flex-1 flex-col min-h-0 border-r border-border-glass bg-bg box-border">
          <div className="files-list-toolbar files-mobile-toolbar-row border-b border-border-glass min-w-0 max-w-full box-border">
            <div className="files-mobile-toolbar-row__left flex flex-1 min-w-0 items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint pointer-events-none" />
                <input
                  type="search"
                  value={meetingSearchQuery}
                  onChange={(e) => setMeetingSearchQuery(e.target.value)}
                  placeholder={isArchivedView ? "Search archived…" : "Search meetings…"}
                  className="files-mobile-search-input w-full min-w-0 bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint min-h-[44px]"
                  aria-label={
                    isArchivedView ? "Search archived meetings" : "Search meetings"
                  }
                />
              </div>
            </div>
            <div className="files-mobile-toolbar-row__actions flex items-center gap-1.5 shrink-0">
              {!isArchivedView && (
                <button
                  type="button"
                  onClick={() => setCreateMeetingOpen(true)}
                  disabled={isCreatingMeeting}
                  className="files-mobile-add-note-btn flex items-center justify-center rounded-xl border border-neon-purple/30 bg-neon-purple/10 min-h-[44px] min-w-[44px] text-neon-purple-tint"
                  aria-label="New meeting"
                >
                  {isCreatingMeeting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setLibraryView((view) => (view === "active" ? "archived" : "active"))
                }
                className={cn(
                  "flex items-center justify-center rounded-xl border min-h-[44px] min-w-[44px] transition",
                  isArchivedView
                    ? "border-neon-purple/40 bg-neon-purple/15 text-neon-purple-tint"
                    : "border-border-glass bg-bg-secondary text-text-muted",
                )}
                aria-pressed={isArchivedView}
                aria-label={
                  isArchivedView
                    ? "Back to active meetings"
                    : "View archived meetings"
                }
              >
                {isArchivedView ? (
                  <ArchiveRestore className="h-4 w-4" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          {meetingList}
        </div>
      )}

      {showMobileMeetingDetail && (
        <div className="files-mobile-back-bar">
          <button
            type="button"
            onClick={() => {
              if (forcedNextMeetingId) return;
              onSelectMeeting(null);
            }}
            disabled={!!forcedNextMeetingId}
            className="flex items-center rounded-xl px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary min-h-[44px] disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Back to meetings"
          >
            Back
          </button>
          <div className="min-w-0 flex-1 text-sm font-semibold truncate text-text-primary px-1">
            {selectedMeeting?.title || "Meeting"}
          </div>
          <button
            type="button"
            onClick={() => selectedMeetingId && setPendingDeleteMeetingId(selectedMeetingId)}
            disabled={!!forcedNextMeetingId}
            className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover shrink-0 disabled:opacity-40 disabled:pointer-events-none"
            aria-label={`Delete ${selectedMeeting?.title || "meeting"}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {(!isMobile || showMobileMeetingDetail) && (
        <MeetingWorkspace
          meeting={selectedMeeting}
          meetings={[...meetings, ...archivedMeetings]}
          agendaItems={selectedMeetingAgendaItems}
          agendaEntries={selectedMeetingEntries}
          members={members}
          workspaceName={workspaceName}
          currentUserId={currentUserId}
          selectedAgendaItemId={selectedAgendaItemId}
          onSelectAgendaItem={onSelectAgendaItem}
          onUpdateMeeting={onUpdateMeeting}
          onAddAgendaItem={onAddAgendaItem}
          onUpdateAgendaItem={onUpdateAgendaItem}
          onReorderAgendaItems={onReorderAgendaItems}
          onAddEntry={onAddAgendaEntry}
          onCompleteItem={onCompleteAgendaItem}
          onContinueItem={onContinueAgendaItem}
          onUnreviewItem={onUnreviewAgendaItem}
          onReopenItem={onReopenAgendaItem}
          onRequestDeleteAgendaItem={(id) =>
            setPendingDestructiveDelete({ kind: "agendaItem", id })
          }
          onUpdateAgendaEntry={onUpdateAgendaEntry}
          onRequestDeleteAgendaEntry={(id) =>
            setPendingDestructiveDelete({ kind: "agendaEntry", id })
          }
          onCompleteMeeting={handleCompleteMeeting}
          onReopenMeeting={onReopenMeeting}
          onStartNextMeeting={handleStartNextMeeting}
          suppressNextMeetingModal={!!forcedNextMeetingId}
          onSaveSummaryAsNote={onSaveSummaryAsNote}
        />
      )}

      <StartNextMeetingModal
        open={!!forcedNextMeetingId}
        onOpenChange={(open) => {
          if (!open) return;
        }}
        continuedCount={forcedNextContinuedCount}
        openCount={forcedNextOpenCount}
        isLoading={isStartingForcedNext}
        required
        onConfirm={async (options) => {
          if (!forcedNextMeetingId) return;
          setIsStartingForcedNext(true);
          try {
            const next = await handleStartNextMeeting(forcedNextMeetingId, options);
            if (!next) throw new Error("Next meeting was not created");
            toast.success("Next meeting created");
          } catch {
            toast.error("Could not create next meeting");
            throw new Error("Could not create next meeting");
          } finally {
            setIsStartingForcedNext(false);
          }
        }}
      />

      <ConfirmationModal
        open={!!pendingDestructiveDelete && !!destructiveConfirm}
        onOpenChange={(open) =>
          !open && !isDeletingDestructive && setPendingDestructiveDelete(null)
        }
        title={destructiveConfirm?.title ?? "Delete?"}
        highlight={destructiveConfirm?.highlight}
        description={destructiveConfirm?.description}
        confirmText={destructiveConfirm?.confirmText ?? "Delete"}
        variant="destructive"
        isLoading={isDeletingDestructive}
        onConfirm={() => void handleConfirmDestructiveDelete()}
      />

      <CreateMeetingModal
        open={createMeetingOpen}
        onOpenChange={setCreateMeetingOpen}
        meetings={meetings}
        agendaItems={meetingAgendaItems}
        onCreate={handleAddMeeting}
      />

      <CopyMeetingModal
        open={!!pendingCopyMeetingId}
        onOpenChange={(open) => !open && !isCopyingMeeting && setPendingCopyMeetingId(null)}
        sourceTitle={pendingCopyMeeting?.title?.trim() || "Untitled meeting"}
        agendaItems={pendingCopyAgendaItems}
        agendaEntries={pendingCopyAgendaEntries}
        isLoading={isCopyingMeeting}
        onConfirm={handleDuplicateMeeting}
      />

      <ConfirmationModal
        open={!!pendingDeleteMeetingId}
        onOpenChange={(open) => !open && !isDeletingMeeting && setPendingDeleteMeetingId(null)}
        title="Delete meeting?"
        highlight={pendingDeleteMeeting?.title?.trim() || "Untitled meeting"}
        description="This meeting and all agenda topics and notes will be permanently deleted."
        confirmText="Delete meeting"
        variant="destructive"
        isLoading={isDeletingMeeting}
        onConfirm={async () => {
          if (!pendingDeleteMeetingId) return;
          setIsDeletingMeeting(true);
          try {
            await onDeleteMeeting(pendingDeleteMeetingId);
            onSelectMeeting(null);
            toast.success("Meeting deleted");
          } catch {
            toast.error("Could not delete meeting");
          } finally {
            setIsDeletingMeeting(false);
            setPendingDeleteMeetingId(null);
          }
        }}
      />
    </div>
  );
}
