"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { filterNotebooksBySearch } from "@/lib/notebooks/notebookFilters";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import type {
  Meeting,
  MeetingAgendaEntry,
  MeetingAgendaItem,
  Note,
  Notebook,
  NotebookCompetitor,
  NotebookCompetitorNote,
  NotebookCustomer,
  NotebookCustomerNote,
  NotebookInvestment,
  NotebookInvestmentNote,
  NotebookTask,
  NotebookTaskProgress,
  NotesPageMode,
  WorkspaceMember,
} from "@/types";
import {
  filterMeetingsBySearch,
  sortAgendaItems,
  sortMeetings,
} from "@/lib/meetings/meetingFilters";
import {
  buildDestructiveConfirmContent,
  formatNotebookDeleteDetails,
  type NotebookDeleteSummary,
  type PendingDestructiveDelete,
} from "@/lib/notebooks/destructiveConfirm";
import {
  CreateMeetingModal,
  MeetingRail,
  MeetingStream,
  MeetingWorkspace,
  NotesMeetingsToggle,
} from "@/features/meetings";
import { NotebookRail } from "./components/NotebookRail";
import { NotebookStream } from "./components/NotebookStream";
import { NotebookContentArea } from "./components/NotebookContentArea";
import "../files/files-workspace.css";
import "./notebooks-workspace.css";
import "../meetings/meetings-workspace.css";

const EMPTY_DOC = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

export interface NotebooksViewProps {
  workspaceId: string;
  workspaceName?: string;
  notebooks: Notebook[];
  notes: Note[];
  meetings: Meeting[];
  meetingAgendaItems: MeetingAgendaItem[];
  meetingAgendaEntries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  currentUserId?: string;
  notesPageMode: NotesPageMode;
  selectedNotebookId: string | null;
  selectedNoteId: string | null;
  selectedNotebookTaskId: string | null;
  selectedNotebookInvestmentId: string | null;
  selectedNotebookCustomerId: string | null;
  selectedNotebookCompetitorId: string | null;
  notebookTasks: NotebookTask[];
  notebookTaskProgress: NotebookTaskProgress[];
  notebookInvestments: NotebookInvestment[];
  notebookInvestmentNotes: NotebookInvestmentNote[];
  notebookCustomers: NotebookCustomer[];
  notebookCustomerNotes: NotebookCustomerNote[];
  notebookCompetitors: NotebookCompetitor[];
  workspaceCompetitors: NotebookCompetitor[];
  notebookCompetitorNotes: NotebookCompetitorNote[];
  workspaceCompetitorNotes: NotebookCompetitorNote[];
  selectedMeetingId: string | null;
  selectedAgendaItemId: string | null;
  isLive: boolean;
  onNotesPageModeChange: (mode: NotesPageMode) => void;
  onSelectNotebook: (id: string | null) => void;
  onSelectNote: (id: string | null) => void;
  onSelectNotebookTask: (id: string | null) => void;
  onSelectNotebookInvestment: (id: string | null) => void;
  onSelectNotebookCustomer: (id: string | null) => void;
  onSelectNotebookCompetitor: (id: string | null) => void;
  onSelectMeeting: (id: string | null) => void;
  onSelectAgendaItem: (id: string | null) => void;
  onAddNotebook: (name?: string) => Promise<Notebook>;
  onUpdateNotebook: (id: string, updates: Partial<Pick<Notebook, "name" | "sortOrder">>) => Promise<unknown>;
  onDeleteNotebook: (id: string) => Promise<unknown>;
  onCreateNote: (title: string, content?: string, options?: { notebookId?: string }) => Promise<Note | null>;
  onUpdateNote: (id: string, updates: Partial<Note>) => Promise<boolean | null>;
  onDeleteNote: (id: string) => Promise<boolean | null>;
  onHydrateNote: (id: string) => Promise<Note | null>;
  onAddMeeting: (input?: {
    title?: string;
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
  onReopenAgendaItem: (id: string) => Promise<unknown>;
  onDeleteAgendaItem: (id: string) => Promise<unknown>;
  onCompleteMeeting: (id: string) => Promise<unknown>;
  onReopenMeeting: (id: string) => Promise<unknown>;
  onStartNextMeeting: (
    id: string,
    options: { includeContinued: boolean; includeOpen: boolean },
  ) => Promise<{ meeting: Meeting; agendaItems: MeetingAgendaItem[] } | undefined>;
  onSaveSummaryAsNote?: (meeting: Meeting) => Promise<void>;
  onAddNotebookTask: (title?: string) => void | Promise<unknown>;
  onToggleNotebookTask: (id: string) => void | Promise<unknown>;
  onUpdateNotebookTask: (id: string, title: string) => void | Promise<unknown>;
  onDeleteNotebookTask: (id: string) => void | Promise<unknown>;
  onAddNotebookTaskProgress: (taskId: string, body: string) => void | Promise<unknown>;
  onUpdateNotebookTaskProgress: (id: string, body: string) => void | Promise<unknown>;
  onDeleteNotebookTaskProgress: (id: string) => void | Promise<unknown>;
  onAddNotebookInvestment: (title?: string) => void | Promise<unknown>;
  onUpdateNotebookInvestment: (id: string, title: string) => void | Promise<unknown>;
  onReorderNotebookInvestments: (orderedIds: string[]) => void | Promise<unknown>;
  onDeleteNotebookInvestment: (id: string) => void | Promise<unknown>;
  onAddNotebookInvestmentNote: (investmentId: string, body: string) => void | Promise<unknown>;
  onUpdateNotebookInvestmentNote: (id: string, body: string) => void | Promise<unknown>;
  onDeleteNotebookInvestmentNote: (id: string) => void | Promise<unknown>;
  onAddNotebookCustomer: (accountName: string) => void | Promise<unknown>;
  onUpdateNotebookCustomer: (id: string, accountName: string) => void | Promise<unknown>;
  onDeleteNotebookCustomer: (id: string) => void | Promise<unknown>;
  onAddNotebookCustomerNote: (customerId: string, body: string) => void | Promise<unknown>;
  onUpdateNotebookCustomerNote: (id: string, body: string) => void | Promise<unknown>;
  onDeleteNotebookCustomerNote: (id: string) => void | Promise<unknown>;
  onAddNotebookCompetitor: (name: string, salesPotential: number) => void | Promise<unknown>;
  onUpdateNotebookCompetitor: (
    id: string,
    updates: { name?: string; salesPotential?: number },
  ) => void | Promise<unknown>;
  onDeleteNotebookCompetitor: (id: string) => void | Promise<unknown>;
  onAddNotebookCompetitorNote: (competitorId: string, body: string) => void | Promise<unknown>;
  onUpdateNotebookCompetitorNote: (id: string, body: string) => void | Promise<unknown>;
  onDeleteNotebookCompetitorNote: (id: string) => void | Promise<unknown>;
  onSetNotebookOurSales: (value: number) => void | Promise<unknown>;
  getNotebookDeleteSummary?: (notebookId: string) => NotebookDeleteSummary;
}

export function NotebooksView({
  workspaceId,
  workspaceName,
  notebooks,
  notes,
  meetings,
  meetingAgendaItems,
  meetingAgendaEntries,
  members,
  currentUserId,
  notesPageMode,
  selectedNotebookId,
  selectedNoteId,
  selectedNotebookTaskId,
  selectedNotebookInvestmentId,
  selectedNotebookCustomerId,
  selectedNotebookCompetitorId,
  notebookTasks,
  notebookTaskProgress,
  notebookInvestments,
  notebookInvestmentNotes,
  notebookCustomers,
  notebookCustomerNotes,
  notebookCompetitors,
  workspaceCompetitors,
  notebookCompetitorNotes,
  workspaceCompetitorNotes,
  selectedMeetingId,
  selectedAgendaItemId,
  isLive,
  onNotesPageModeChange,
  onSelectNotebook,
  onSelectNote,
  onSelectNotebookTask,
  onSelectNotebookInvestment,
  onSelectNotebookCustomer,
  onSelectNotebookCompetitor,
  onSelectMeeting,
  onSelectAgendaItem,
  onAddNotebook,
  onUpdateNotebook,
  onDeleteNotebook,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onHydrateNote,
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
  onReopenAgendaItem,
  onDeleteAgendaItem,
  onCompleteMeeting,
  onReopenMeeting,
  onStartNextMeeting,
  onSaveSummaryAsNote,
  onAddNotebookTask,
  onToggleNotebookTask,
  onUpdateNotebookTask,
  onDeleteNotebookTask,
  onAddNotebookTaskProgress,
  onUpdateNotebookTaskProgress,
  onDeleteNotebookTaskProgress,
  onAddNotebookInvestment,
  onUpdateNotebookInvestment,
  onReorderNotebookInvestments,
  onDeleteNotebookInvestment,
  onAddNotebookInvestmentNote,
  onUpdateNotebookInvestmentNote,
  onDeleteNotebookInvestmentNote,
  onAddNotebookCustomer,
  onUpdateNotebookCustomer,
  onDeleteNotebookCustomer,
  onAddNotebookCustomerNote,
  onUpdateNotebookCustomerNote,
  onDeleteNotebookCustomerNote,
  onAddNotebookCompetitor,
  onUpdateNotebookCompetitor,
  onDeleteNotebookCompetitor,
  onAddNotebookCompetitorNote,
  onUpdateNotebookCompetitorNote,
  onDeleteNotebookCompetitorNote,
  onSetNotebookOurSales,
  getNotebookDeleteSummary,
}: NotebooksViewProps) {
  const isMobile = useIsMobileViewport();
  const isDesktop = !isMobile;
  const isMeetingsMode = notesPageMode === "meetings";
  const [searchQuery, setSearchQuery] = useState("");
  const [meetingSearchQuery, setMeetingSearchQuery] = useState("");
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [createMeetingOpen, setCreateMeetingOpen] = useState(false);
  const [pendingDeleteMeetingId, setPendingDeleteMeetingId] = useState<string | null>(null);
  const [isDeletingMeeting, setIsDeletingMeeting] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [pendingDeleteNotebookId, setPendingDeleteNotebookId] = useState<string | null>(null);
  const [focusTitleNoteId, setFocusTitleNoteId] = useState<string | null>(null);
  const [focusRenameNotebookId, setFocusRenameNotebookId] = useState<string | null>(null);
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState<string | null>(null);
  const [isDeletingNotebook, setIsDeletingNotebook] = useState(false);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [pendingDestructiveDelete, setPendingDestructiveDelete] =
    useState<PendingDestructiveDelete | null>(null);
  const [isDeletingDestructive, setIsDeletingDestructive] = useState(false);
  const [mobileRenameEditingId, setMobileRenameEditingId] = useState<string | null>(null);
  const [mobileRenameName, setMobileRenameName] = useState("");
  const mobileRenameRef = useRef<HTMLInputElement>(null);
  const mobileRenameFocusPending = useRef(false);

  const filteredNotebooks = useMemo(
    () => filterNotebooksBySearch(notebooks, searchQuery),
    [notebooks, searchQuery],
  );

  const selectedNotebook = useMemo(
    () => notebooks.find((nb) => nb.id === selectedNotebookId) ?? null,
    [notebooks, selectedNotebookId],
  );

  const notebookNotes = useMemo(
    () => notes.filter((n) => n.notebookId === selectedNotebookId),
    [notes, selectedNotebookId],
  );

  const selectedNote = useMemo(
    () => notebookNotes.find((n) => n.id === selectedNoteId) ?? null,
    [notebookNotes, selectedNoteId],
  );

  const pendingDeleteNotebook = useMemo(
    () => notebooks.find((nb) => nb.id === pendingDeleteNotebookId) ?? null,
    [notebooks, pendingDeleteNotebookId],
  );

  const pendingDeleteNotebookNoteCount = useMemo(
    () =>
      pendingDeleteNotebookId
        ? notes.filter((n) => n.notebookId === pendingDeleteNotebookId).length
        : 0,
    [notes, pendingDeleteNotebookId],
  );

  const pendingDeleteNote = useMemo(
    () => (pendingDeleteNoteId ? notebookNotes.find((n) => n.id === pendingDeleteNoteId) : null),
    [notebookNotes, pendingDeleteNoteId],
  );

  const filteredMeetings = useMemo(
    () => sortMeetings(filterMeetingsBySearch(meetings, meetingSearchQuery)),
    [meetings, meetingSearchQuery],
  );

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === selectedMeetingId) ?? null,
    [meetings, selectedMeetingId],
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
    () => meetings.find((m) => m.id === pendingDeleteMeetingId) ?? null,
    [meetings, pendingDeleteMeetingId],
  );

  const destructiveConfirm = useMemo(
    () =>
      buildDestructiveConfirmContent(pendingDestructiveDelete, {
        tasks: notebookTasks,
        taskProgress: notebookTaskProgress,
        investments: notebookInvestments,
        investmentNotes: notebookInvestmentNotes,
        customers: notebookCustomers,
        customerNotes: notebookCustomerNotes,
        competitors: notebookCompetitors,
        competitorNotes: notebookCompetitorNotes,
        agendaItems: meetingAgendaItems,
        agendaEntries: meetingAgendaEntries,
      }),
    [
      pendingDestructiveDelete,
      notebookTasks,
      notebookTaskProgress,
      notebookInvestments,
      notebookInvestmentNotes,
      notebookCustomers,
      notebookCustomerNotes,
      notebookCompetitors,
      notebookCompetitorNotes,
      meetingAgendaItems,
      meetingAgendaEntries,
    ],
  );

  const pendingNotebookDeleteDetails = useMemo(() => {
    if (!pendingDeleteNotebookId || !getNotebookDeleteSummary) return null;
    return formatNotebookDeleteDetails(getNotebookDeleteSummary(pendingDeleteNotebookId));
  }, [pendingDeleteNotebookId, getNotebookDeleteSummary]);

  const showMobileNotebookDetail = isMobile && !isMeetingsMode && !!selectedNotebookId;
  const showMobileNoteDetail = isMobile && !isMeetingsMode && !!selectedNoteId;
  const showMobileMeetingDetail = isMobile && isMeetingsMode && !!selectedMeetingId;

  const handleAddNotebook = useCallback(async () => {
    setIsCreatingNotebook(true);
    try {
      const nb = await onAddNotebook("Untitled notebook");
      onSelectNotebook(nb.id);
      setMobileRenameName(nb.name);
      if (isMobile) {
        setMobileRenameEditingId(nb.id);
        mobileRenameFocusPending.current = true;
      } else {
        setFocusRenameNotebookId(nb.id);
      }
    } catch {
      toast.error("Could not create notebook");
    } finally {
      setIsCreatingNotebook(false);
    }
  }, [isMobile, onAddNotebook, onSelectNotebook]);

  const handleCreateNote = useCallback(async () => {
    if (!selectedNotebookId) return;
    setIsCreatingNote(true);
    try {
      const created = await onCreateNote("Untitled note", EMPTY_DOC, {
        notebookId: selectedNotebookId,
      });
      if (created) {
        onSelectNote(created.id);
        setFocusTitleNoteId(created.id);
      } else {
        toast.error("Could not create note");
      }
    } finally {
      setIsCreatingNote(false);
    }
  }, [selectedNotebookId, onCreateNote, onSelectNote]);

  const isMobileRenaming =
    isMobile && mobileRenameEditingId === selectedNotebookId && !!selectedNotebook;

  useEffect(() => {
    if (!mobileRenameFocusPending.current || !isMobileRenaming) return;
    const frame = requestAnimationFrame(() => {
      const input = mobileRenameRef.current;
      if (!input) return;
      input.focus();
      input.select();
      mobileRenameFocusPending.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [isMobileRenaming, selectedNotebookId]);

  const commitMobileRename = useCallback(() => {
    if (!selectedNotebookId) return;
    const name = mobileRenameName.trim();
    if (name) void onUpdateNotebook(selectedNotebookId, { name });
    setMobileRenameEditingId(null);
  }, [mobileRenameName, onUpdateNotebook, selectedNotebookId]);

  const handleConfirmDestructiveDelete = useCallback(async () => {
    if (!pendingDestructiveDelete) return;
    setIsDeletingDestructive(true);
    try {
      switch (pendingDestructiveDelete.kind) {
        case "task":
          await onDeleteNotebookTask(pendingDestructiveDelete.id);
          toast.success("Task deleted");
          break;
        case "taskProgress":
          await onDeleteNotebookTaskProgress(pendingDestructiveDelete.id);
          toast.success("Progress note deleted");
          break;
        case "investment":
          await onDeleteNotebookInvestment(pendingDestructiveDelete.id);
          toast.success("Investment deleted");
          break;
        case "investmentNote":
          await onDeleteNotebookInvestmentNote(pendingDestructiveDelete.id);
          toast.success("Note deleted");
          break;
        case "customer":
          await onDeleteNotebookCustomer(pendingDestructiveDelete.id);
          toast.success("Customer deleted");
          break;
        case "customerNote":
          await onDeleteNotebookCustomerNote(pendingDestructiveDelete.id);
          toast.success("Note deleted");
          break;
        case "competitor":
          await onDeleteNotebookCompetitor(pendingDestructiveDelete.id);
          toast.success("Competitor deleted");
          break;
        case "competitorNote":
          await onDeleteNotebookCompetitorNote(pendingDestructiveDelete.id);
          toast.success("Note deleted");
          break;
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
  }, [
    pendingDestructiveDelete,
    onDeleteNotebookTask,
    onDeleteNotebookTaskProgress,
    onDeleteNotebookInvestment,
    onDeleteNotebookInvestmentNote,
    onDeleteNotebookCustomer,
    onDeleteNotebookCustomerNote,
    onDeleteNotebookCompetitor,
    onDeleteNotebookCompetitorNote,
    onDeleteAgendaItem,
    onDeleteAgendaEntry,
  ]);

  const handleDeleteNotebook = useCallback(async () => {
    if (!pendingDeleteNotebookId) return;
    setIsDeletingNotebook(true);
    try {
      await onDeleteNotebook(pendingDeleteNotebookId);
      onSelectNotebook(null);
      onSelectNote(null);
      toast.success("Notebook deleted");
    } catch {
      toast.error("Could not delete notebook");
    } finally {
      setIsDeletingNotebook(false);
      setPendingDeleteNotebookId(null);
    }
  }, [pendingDeleteNotebookId, onDeleteNotebook, onSelectNotebook, onSelectNote]);

  const startMobileNotebookRename = useCallback(() => {
    if (!selectedNotebookId || !selectedNotebook) return;
    setMobileRenameEditingId(selectedNotebookId);
    setMobileRenameName(selectedNotebook.name);
    mobileRenameFocusPending.current = true;
  }, [selectedNotebook, selectedNotebookId]);

  const handleAddMeeting = useCallback(async (input: {
    title: string;
    scheduledAt?: string;
    carryOverFromMeetingId?: string;
    carryOver?: { includeContinued: boolean; includeOpen: boolean };
  }) => {
    setIsCreatingMeeting(true);
    try {
      const { meeting, agendaItems: createdItems } = await onAddMeeting({
        title: input.title,
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

  const meetingList = (
    <MeetingStream
      meetings={filteredMeetings}
      agendaItems={meetingAgendaItems}
      selectedId={selectedMeetingId}
      onSelect={(id) => onSelectMeeting(id)}
      onDelete={(id) => setPendingDeleteMeetingId(id)}
      emptyMessage={
        meetingSearchQuery.trim() ? "No meetings match your search." : undefined
      }
    />
  );

  const notebookList = (
    <NotebookStream
      notebooks={filteredNotebooks}
      selectedId={selectedNotebookId}
      onSelect={onSelectNotebook}
      onRename={(id, name) => void onUpdateNotebook(id, { name })}
      onDelete={(id) => setPendingDeleteNotebookId(id)}

      emptyMessage={
        searchQuery.trim() ? "No notebooks match your search." : undefined
      }
    />
  );

  return (
    <div
      className={cn(
        "notebooks-root files-root flex flex-col md:flex-row h-full min-h-0 overflow-hidden max-w-full min-w-0",
        showMobileNotebookDetail && "files-mobile-detail",
        showMobileMeetingDetail && "files-mobile-detail",
        showMobileNoteDetail && "notebooks-mobile-note-detail",
      )}
      data-workspace-id={workspaceId}
    >
      {isMeetingsMode ? (
        <MeetingRail
          isDesktop={isDesktop}
          notesPageMode={notesPageMode}
          onNotesPageModeChange={(mode) => {
            setCreateMeetingOpen(false);
            onNotesPageModeChange(mode);
          }}
          onNewMeeting={() => setCreateMeetingOpen(true)}
          isCreating={isCreatingMeeting}
          searchQuery={meetingSearchQuery}
          onSearchQueryChange={setMeetingSearchQuery}
          listContent={isDesktop ? meetingList : undefined}
        />
      ) : (
        <NotebookRail
          isDesktop={isDesktop}
          notesPageMode={notesPageMode}
          onNotesPageModeChange={onNotesPageModeChange}
          onNewNotebook={() => void handleAddNotebook()}
          isCreating={isCreatingNotebook}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          listContent={isDesktop ? notebookList : undefined}
        />
      )}

      {!isDesktop && !showMobileNotebookDetail && !showMobileMeetingDetail && (
        <div className="files-list-column w-full min-w-0 max-w-full flex flex-1 flex-col min-h-0 border-r border-border-glass bg-bg box-border">
          <div className="px-4 pt-3 pb-2 border-b border-border-glass">
            <NotesMeetingsToggle
              mode={notesPageMode}
              onModeChange={(mode) => {
                setCreateMeetingOpen(false);
                onNotesPageModeChange(mode);
              }}
            />
          </div>
          <div className="files-list-toolbar files-mobile-toolbar-row border-b border-border-glass min-w-0 max-w-full box-border">
            <div className="files-mobile-toolbar-row__left flex flex-1 min-w-0 items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint pointer-events-none" />
                <input
                  type="search"
                  value={isMeetingsMode ? meetingSearchQuery : searchQuery}
                  onChange={(e) =>
                    isMeetingsMode
                      ? setMeetingSearchQuery(e.target.value)
                      : setSearchQuery(e.target.value)
                  }
                  placeholder={isMeetingsMode ? "Search meetings…" : "Search notebooks…"}
                  className="files-mobile-search-input w-full min-w-0 bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint min-h-[44px]"
                  aria-label={isMeetingsMode ? "Search meetings" : "Search notebooks"}
                />
              </div>
            </div>
            <div className="files-mobile-toolbar-row__actions flex items-center shrink-0">
              <button
                type="button"
                onClick={() =>
                  isMeetingsMode ? setCreateMeetingOpen(true) : void handleAddNotebook()
                }
                disabled={isMeetingsMode ? isCreatingMeeting : isCreatingNotebook}
                className="files-mobile-add-note-btn flex items-center justify-center rounded-xl border border-neon-purple/30 bg-neon-purple/10 min-h-[44px] min-w-[44px] text-neon-purple-tint"
                aria-label={isMeetingsMode ? "Schedule meeting" : "Add notebook"}
              >
                {(isMeetingsMode ? isCreatingMeeting : isCreatingNotebook) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          {isMeetingsMode ? meetingList : notebookList}
        </div>
      )}

      {showMobileMeetingDetail && (
        <>
          <div className="files-mobile-back-bar">
            <button
              type="button"
              onClick={() => onSelectMeeting(null)}
              className="flex items-center rounded-xl px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary min-h-[44px]"
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
              className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover shrink-0"
              aria-label={`Delete ${selectedMeeting?.title || "meeting"}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="px-4 py-2 border-b border-border-glass shrink-0">
            <NotesMeetingsToggle
              mode={notesPageMode}
              onModeChange={(mode) => {
                setCreateMeetingOpen(false);
                onNotesPageModeChange(mode);
              }}
            />
          </div>
        </>
      )}

      {showMobileNotebookDetail && !showMobileNoteDetail && (
        <>
        <div className="files-mobile-back-bar">
          <button
            type="button"
            onClick={() => onSelectNotebook(null)}
            className="flex items-center rounded-xl px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary min-h-[44px]"
            aria-label="Close notebook"
          >
            Close
          </button>
          {isMobileRenaming ? (
            <input
              ref={mobileRenameRef}
              value={mobileRenameName}
              onChange={(e) => setMobileRenameName(e.target.value)}
              onBlur={() => commitMobileRename()}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitMobileRename();
                if (e.key === "Escape") {
                  setMobileRenameName(selectedNotebook?.name || "");
                  setMobileRenameEditingId(null);
                }
              }}
              className="min-w-0 flex-1 bg-bg-secondary border border-neon-purple/30 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none"
              aria-label="Rename notebook"
            />
          ) : (
            <button
              type="button"
              onClick={startMobileNotebookRename}
              className="min-w-0 flex-1 text-left text-sm font-semibold truncate text-text-primary px-1 rounded-lg hover:bg-surface-hover py-1"
              aria-label={`Rename ${selectedNotebook?.name || "notebook"}`}
            >
              {selectedNotebook?.name || "Notebook"}
            </button>
          )}
          <button
            type="button"
            onClick={() => selectedNotebookId && setPendingDeleteNotebookId(selectedNotebookId)}
            className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover shrink-0"
            aria-label={`Delete ${selectedNotebook?.name || "notebook"}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-2 border-b border-border-glass shrink-0">
          <NotesMeetingsToggle
            mode={notesPageMode}
            onModeChange={onNotesPageModeChange}
          />
        </div>
        </>
      )}

      {showMobileNoteDetail && (
        <div className="files-mobile-back-bar">
          <button
            type="button"
            onClick={() => onSelectNote(null)}
            className="flex items-center rounded-xl px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary min-h-[44px]"
            aria-label="Back to notes"
          >
            Back
          </button>
          <div className="min-w-0 flex-1 text-sm font-semibold truncate text-text-primary px-1">
            {selectedNote?.title || "Note"}
          </div>
        </div>
      )}

      {isMeetingsMode && (!isMobile || showMobileMeetingDetail) && (
        <MeetingWorkspace
          meeting={selectedMeeting}
          meetings={meetings}
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
          onReopenItem={onReopenAgendaItem}
          onRequestDeleteAgendaItem={(id) =>
            setPendingDestructiveDelete({ kind: "agendaItem", id })
          }
          onUpdateAgendaEntry={onUpdateAgendaEntry}
          onRequestDeleteAgendaEntry={(id) =>
            setPendingDestructiveDelete({ kind: "agendaEntry", id })
          }
          onCompleteMeeting={onCompleteMeeting}
          onReopenMeeting={onReopenMeeting}
          onStartNextMeeting={async (id, options) => {
            const result = await onStartNextMeeting(id, options);
            if (result) {
              onSelectMeeting(result.meeting.id);
              const firstItem = [...result.agendaItems].sort((a, b) => a.sortOrder - b.sortOrder)[0];
              if (firstItem) onSelectAgendaItem(firstItem.id);
            }
            return result;
          }}
          onSaveSummaryAsNote={onSaveSummaryAsNote}

        />
      )}

      {!isMeetingsMode && (!isMobile || showMobileNotebookDetail) && (
        <NotebookContentArea
          notebook={isMobile && !showMobileNotebookDetail ? null : selectedNotebook}
          showNotebookHeader={!isMobile}
          showSectionMenu={!showMobileNoteDetail}
          notes={notebookNotes}
          tasks={notebookTasks}
          taskProgress={notebookTaskProgress}
          investments={notebookInvestments}
          investmentNotes={notebookInvestmentNotes}
          customers={notebookCustomers}
          customerNotes={notebookCustomerNotes}
          competitors={notebookCompetitors}
          workspaceCompetitors={workspaceCompetitors}
          competitorNotes={notebookCompetitorNotes}
          workspaceCompetitorNotes={workspaceCompetitorNotes}
          allNotebooks={notebooks}
          workspaceName={workspaceName}
          members={members}
          currentUserId={currentUserId}
          selectedNoteId={selectedNoteId}
          selectedNote={selectedNote}
          selectedTaskId={selectedNotebookTaskId}
          selectedInvestmentId={selectedNotebookInvestmentId}
          selectedCustomerId={selectedNotebookCustomerId}
          selectedCompetitorId={selectedNotebookCompetitorId}
          isLive={isLive}
          isCreatingNote={isCreatingNote}
          onSelectNote={(id) => {
            onSelectNote(id);
          }}
          onSelectTask={onSelectNotebookTask}
          onSelectInvestment={onSelectNotebookInvestment}
          onSelectCustomer={onSelectNotebookCustomer}
          onSelectCompetitor={onSelectNotebookCompetitor}
          onCreateNote={() => void handleCreateNote()}
          onUpdateNote={onUpdateNote}
          onUpdateNotebook={(id, updates) => void onUpdateNotebook(id, updates)}
          onRequestDeleteNotebook={() => {
            if (selectedNotebookId) setPendingDeleteNotebookId(selectedNotebookId);
          }}
          onRequestDeleteNote={(id) => setPendingDeleteNoteId(id)}
          onDeleteNote={onDeleteNote}
          onHydrateNote={onHydrateNote}
          onAddNotebookTask={(title) =>
            selectedNotebookId ? onAddNotebookTask(title) : undefined
          }
          onToggleNotebookTask={onToggleNotebookTask}
          onUpdateNotebookTask={onUpdateNotebookTask}
          onRequestDeleteNotebookTask={(id) =>
            setPendingDestructiveDelete({ kind: "task", id })
          }
          onAddNotebookTaskProgress={onAddNotebookTaskProgress}
          onUpdateNotebookTaskProgress={onUpdateNotebookTaskProgress}
          onRequestDeleteNotebookTaskProgress={(id) =>
            setPendingDestructiveDelete({ kind: "taskProgress", id })
          }
          onAddNotebookInvestment={(title) =>
            selectedNotebookId ? onAddNotebookInvestment(title) : undefined
          }
          onUpdateNotebookInvestment={onUpdateNotebookInvestment}
          onReorderNotebookInvestments={onReorderNotebookInvestments}
          onRequestDeleteNotebookInvestment={(id) =>
            setPendingDestructiveDelete({ kind: "investment", id })
          }
          onAddNotebookInvestmentNote={onAddNotebookInvestmentNote}
          onUpdateNotebookInvestmentNote={onUpdateNotebookInvestmentNote}
          onRequestDeleteNotebookInvestmentNote={(id) =>
            setPendingDestructiveDelete({ kind: "investmentNote", id })
          }
          onAddNotebookCustomer={onAddNotebookCustomer}
          onUpdateNotebookCustomer={onUpdateNotebookCustomer}
          onRequestDeleteNotebookCustomer={(id) =>
            setPendingDestructiveDelete({ kind: "customer", id })
          }
          onAddNotebookCustomerNote={onAddNotebookCustomerNote}
          onUpdateNotebookCustomerNote={onUpdateNotebookCustomerNote}
          onRequestDeleteNotebookCustomerNote={(id) =>
            setPendingDestructiveDelete({ kind: "customerNote", id })
          }
          onAddNotebookCompetitor={(name, sales) =>
            selectedNotebookId ? onAddNotebookCompetitor(name, sales) : undefined
          }
          onUpdateNotebookCompetitor={onUpdateNotebookCompetitor}
          onRequestDeleteNotebookCompetitor={(id) =>
            setPendingDestructiveDelete({ kind: "competitor", id })
          }
          onAddNotebookCompetitorNote={onAddNotebookCompetitorNote}
          onUpdateNotebookCompetitorNote={onUpdateNotebookCompetitorNote}
          onRequestDeleteNotebookCompetitorNote={(id) =>
            setPendingDestructiveDelete({ kind: "competitorNote", id })
          }
          onSetNotebookOurSales={(value) =>
            selectedNotebookId ? onSetNotebookOurSales(value) : undefined
          }
          focusTitleNoteId={focusTitleNoteId}
          onTitleFocusConsumed={() => setFocusTitleNoteId(null)}
          focusRenameNotebook={!isMobile && focusRenameNotebookId === selectedNotebookId}
          onNotebookRenameFocusConsumed={() => setFocusRenameNotebookId(null)}
        />
      )}

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

      <ConfirmationModal
        open={!!pendingDeleteNoteId}
        onOpenChange={(open) => !open && !isDeletingNote && setPendingDeleteNoteId(null)}
        title="Delete note?"
        highlight={pendingDeleteNote?.title?.trim() || "Untitled note"}
        description="This note and its attachments will be permanently deleted. This action cannot be undone."
        confirmText="Delete note"
        variant="destructive"
        isLoading={isDeletingNote}
        onConfirm={async () => {
          if (!pendingDeleteNoteId) return;
          setIsDeletingNote(true);
          try {
            const ok = await onDeleteNote(pendingDeleteNoteId);
            if (ok) {
              onSelectNote(null);
              toast.success("Note deleted");
            } else {
              toast.error("Could not delete note");
            }
          } finally {
            setIsDeletingNote(false);
            setPendingDeleteNoteId(null);
          }
        }}
      />

      <CreateMeetingModal
        open={createMeetingOpen}
        onOpenChange={setCreateMeetingOpen}
        meetings={meetings}
        agendaItems={meetingAgendaItems}
        onCreate={handleAddMeeting}
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

      <ConfirmationModal
        open={!!pendingDeleteNotebookId}
        onOpenChange={(open) => !open && !isDeletingNotebook && setPendingDeleteNotebookId(null)}
        title="Delete notebook?"
        highlight={pendingDeleteNotebook?.name?.trim() || "Untitled notebook"}
        description="This notebook and all of its notes, tasks, customers, investments, and competitors will be permanently deleted."
        details={
          pendingNotebookDeleteDetails ? (
            <p className="text-sm text-text-muted">{pendingNotebookDeleteDetails}</p>
          ) : pendingDeleteNotebookNoteCount > 0 ? (
            <p className="text-sm text-text-muted">
              Includes {pendingDeleteNotebookNoteCount} note
              {pendingDeleteNotebookNoteCount === 1 ? "" : "s"} plus all section data.
            </p>
          ) : (
            <p className="text-sm text-text-muted">All section data will also be deleted.</p>
          )
        }
        confirmText="Delete notebook"
        variant="destructive"
        isLoading={isDeletingNotebook}
        onConfirm={() => void handleDeleteNotebook()}
      />
    </div>
  );
}