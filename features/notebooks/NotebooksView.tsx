"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { filterNotebooksBySearch } from "@/lib/notebooks/notebookFilters";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import type {
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
  WorkspaceMember,
} from "@/types";
import {
  buildDestructiveConfirmContent,
  formatNotebookDeleteDetails,
  type NotebookDeleteSummary,
  type PendingDestructiveDelete,
} from "@/lib/notebooks/destructiveConfirm";
import { NotebookRail } from "./components/NotebookRail";
import { NotebookStream } from "./components/NotebookStream";
import { NotebookContentArea } from "./components/NotebookContentArea";
import { EditNotebookModal } from "./components/EditNotebookModal";
import "../files/files-workspace.css";
import "./notebooks-workspace.css";

const EMPTY_DOC = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

export interface NotebooksViewProps {
  workspaceId: string;
  workspaceName?: string;
  notebooks: Notebook[];
  archivedNotebooks?: Notebook[];
  notes: Note[];
  members: WorkspaceMember[];
  currentUserId?: string;
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
  isLive: boolean;
  onSelectNotebook: (id: string | null) => void;
  onSelectNote: (id: string | null) => void;
  onSelectNotebookTask: (id: string | null) => void;
  onSelectNotebookInvestment: (id: string | null) => void;
  onSelectNotebookCustomer: (id: string | null) => void;
  onSelectNotebookCompetitor: (id: string | null) => void;
  onAddNotebook: (name?: string) => Promise<Notebook>;
  onUpdateNotebook: (
    id: string,
    updates: Partial<Pick<Notebook, "name" | "sortOrder" | "enabledSections" | "archived">>,
  ) => Promise<unknown>;
  onDeleteNotebook: (id: string) => Promise<unknown>;
  onCreateNote: (title: string, content?: string, options?: { notebookId?: string }) => Promise<Note | null>;
  onUpdateNote: (id: string, updates: Partial<Note>) => Promise<boolean | null>;
  onDeleteNote: (id: string) => Promise<boolean | null>;
  onHydrateNote: (id: string) => Promise<Note | null>;
  onAddNotebookTask: (title?: string) => void | Promise<unknown>;
  onToggleNotebookTask: (id: string) => void | Promise<unknown>;
  onUpdateNotebookTask: (id: string, title: string) => void | Promise<unknown>;
  onSetNotebookTaskShowOnWorkspace: (id: string, showOnWorkspace: boolean) => void | Promise<unknown>;
  onDeleteNotebookTask: (id: string) => void | Promise<unknown>;
  onAddNotebookTaskProgress: (taskId: string, body: string) => void | Promise<unknown>;
  onUpdateNotebookTaskProgress: (id: string, body: string) => void | Promise<unknown>;
  onDeleteNotebookTaskProgress: (id: string) => void | Promise<unknown>;
  onAddNotebookInvestment: (title?: string) => void | Promise<unknown>;
  onToggleNotebookInvestment: (id: string) => void | Promise<unknown>;
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
  archivedNotebooks = [],
  notes,
  members,
  currentUserId,
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
  isLive,
  onSelectNotebook,
  onSelectNote,
  onSelectNotebookTask,
  onSelectNotebookInvestment,
  onSelectNotebookCustomer,
  onSelectNotebookCompetitor,
  onAddNotebook,
  onUpdateNotebook,
  onDeleteNotebook,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onHydrateNote,
  onAddNotebookTask,
  onToggleNotebookTask,
  onUpdateNotebookTask,
  onSetNotebookTaskShowOnWorkspace,
  onDeleteNotebookTask,
  onAddNotebookTaskProgress,
  onUpdateNotebookTaskProgress,
  onDeleteNotebookTaskProgress,
  onAddNotebookInvestment,
  onToggleNotebookInvestment,
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
  const [libraryView, setLibraryView] = useState<"active" | "archived">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const isArchivedView = libraryView === "archived";

  const sourceNotebooks = isArchivedView ? archivedNotebooks : notebooks;
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [pendingDeleteNotebookId, setPendingDeleteNotebookId] = useState<string | null>(null);
  const [focusTitleNoteId, setFocusTitleNoteId] = useState<string | null>(null);
  const [editNotebookId, setEditNotebookId] = useState<string | null>(null);
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState<string | null>(null);
  const [isDeletingNotebook, setIsDeletingNotebook] = useState(false);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [pendingDestructiveDelete, setPendingDestructiveDelete] =
    useState<PendingDestructiveDelete | null>(null);
  const [isDeletingDestructive, setIsDeletingDestructive] = useState(false);

  const editingNotebook = useMemo(
    () => notebooks.find((nb) => nb.id === editNotebookId) ?? null,
    [notebooks, editNotebookId],
  );

  const filteredNotebooks = useMemo(
    () => filterNotebooksBySearch(sourceNotebooks, searchQuery),
    [sourceNotebooks, searchQuery],
  );

  const selectedNotebook = useMemo(
    () =>
      [...notebooks, ...archivedNotebooks].find((nb) => nb.id === selectedNotebookId) ?? null,
    [notebooks, archivedNotebooks, selectedNotebookId],
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
    () =>
      [...notebooks, ...archivedNotebooks].find((nb) => nb.id === pendingDeleteNotebookId) ?? null,
    [notebooks, archivedNotebooks, pendingDeleteNotebookId],
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
        agendaItems: [],
        agendaEntries: [],
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
    ],
  );

  const pendingNotebookDeleteDetails = useMemo(() => {
    if (!pendingDeleteNotebookId || !getNotebookDeleteSummary) return null;
    return formatNotebookDeleteDetails(getNotebookDeleteSummary(pendingDeleteNotebookId));
  }, [pendingDeleteNotebookId, getNotebookDeleteSummary]);

  const showMobileNotebookDetail = isMobile && !!selectedNotebookId;
  const showMobileNoteDetail = isMobile && !!selectedNoteId;

  const handleAddNotebook = useCallback(async () => {
    setIsCreatingNotebook(true);
    try {
      const nb = await onAddNotebook("Untitled notebook");
      onSelectNotebook(nb.id);
      setEditNotebookId(nb.id);
    } catch {
      toast.error("Could not create notebook");
    } finally {
      setIsCreatingNotebook(false);
    }
  }, [onAddNotebook, onSelectNotebook]);

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

  const handleSaveNotebookEdit = useCallback(
    async (id: string, updates: Partial<Pick<Notebook, "name" | "enabledSections">>) => {
      await onUpdateNotebook(id, updates);
      toast.success("Notebook updated");
    },
    [onUpdateNotebook],
  );

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

  const openNotebookEditor = useCallback((id: string) => {
    setEditNotebookId(id);
  }, []);

  const notebookList = (
    <NotebookStream
      notebooks={filteredNotebooks}
      selectedId={selectedNotebookId}
      onSelect={onSelectNotebook}
      onEdit={openNotebookEditor}
      onDelete={(id) => setPendingDeleteNotebookId(id)}
      onArchive={
        isArchivedView
          ? undefined
          : (id) => {
              void onUpdateNotebook(id, { archived: true });
              toast.success("Notebook archived");
            }
      }
      onUnarchive={
        isArchivedView
          ? (id) => {
              void onUpdateNotebook(id, { archived: false });
              toast.success("Notebook restored");
            }
          : undefined
      }
      isArchivedView={isArchivedView}
      emptyMessage={
        searchQuery.trim()
          ? "No notebooks match your search."
          : isArchivedView
            ? "No archived notebooks."
            : undefined
      }
    />
  );

  return (
    <div
      className={cn(
        "notebooks-root files-root flex flex-col md:flex-row h-full min-h-0 overflow-hidden max-w-full min-w-0",
        showMobileNotebookDetail && "files-mobile-detail",
        showMobileNoteDetail && "notebooks-mobile-note-detail",
      )}
      data-workspace-id={workspaceId}
    >
      <NotebookRail
        isDesktop={isDesktop}
        onNewNotebook={() => void handleAddNotebook()}
        isCreating={isCreatingNotebook}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        libraryView={libraryView}
        onLibraryViewChange={setLibraryView}
        archivedCount={archivedNotebooks.length}
        listContent={isDesktop ? notebookList : undefined}
      />

      {!isDesktop && !showMobileNotebookDetail && (
        <div className="files-list-column w-full min-w-0 max-w-full flex flex-1 flex-col min-h-0 border-r border-border-glass bg-bg box-border">
          <div className="files-list-toolbar files-mobile-toolbar-row border-b border-border-glass min-w-0 max-w-full box-border">
            <div className="files-mobile-toolbar-row__left flex flex-1 min-w-0 items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isArchivedView ? "Search archived…" : "Search notebooks…"}
                  className="files-mobile-search-input w-full min-w-0 bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint min-h-[44px]"
                  aria-label={
                    isArchivedView ? "Search archived notebooks" : "Search notebooks"
                  }
                />
              </div>
            </div>
            <div className="files-mobile-toolbar-row__actions flex items-center gap-1.5 shrink-0">
              {!isArchivedView && (
                <button
                  type="button"
                  onClick={() => void handleAddNotebook()}
                  disabled={isCreatingNotebook}
                  className="files-mobile-add-note-btn flex items-center justify-center rounded-xl border border-neon-purple/30 bg-neon-purple/10 min-h-[44px] min-w-[44px] text-neon-purple-tint"
                  aria-label="Add notebook"
                >
                  {isCreatingNotebook ? (
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
                  isArchivedView ? "Back to active notebooks" : "View archived notebooks"
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
          {notebookList}
        </div>
      )}

      {showMobileNotebookDetail && !showMobileNoteDetail && (
        <div className="files-mobile-back-bar">
          <button
            type="button"
            onClick={() => onSelectNotebook(null)}
            className="flex items-center rounded-xl px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary min-h-[44px]"
            aria-label="Close notebook"
          >
            Close
          </button>
          <div className="min-w-0 flex-1 text-sm font-semibold truncate text-text-primary px-1">
            {selectedNotebook?.name || "Notebook"}
          </div>
          <button
            type="button"
            onClick={() => selectedNotebookId && openNotebookEditor(selectedNotebookId)}
            className="p-2 rounded-lg text-text-muted hover:text-neon-purple hover:bg-surface-hover shrink-0"
            aria-label={`Edit ${selectedNotebook?.name || "notebook"}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => selectedNotebookId && setPendingDeleteNotebookId(selectedNotebookId)}
            className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover shrink-0"
            aria-label={`Delete ${selectedNotebook?.name || "notebook"}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
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

      {(!isMobile || showMobileNotebookDetail) && (
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
          onEditNotebook={() => {
            if (selectedNotebookId) openNotebookEditor(selectedNotebookId);
          }}
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
          onSetNotebookTaskShowOnWorkspace={onSetNotebookTaskShowOnWorkspace}
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
          onToggleNotebookInvestment={onToggleNotebookInvestment}
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
        />
      )}

      <EditNotebookModal
        open={!!editNotebookId && !!editingNotebook}
        notebook={editingNotebook}
        onOpenChange={(open) => {
          if (!open) setEditNotebookId(null);
        }}
        onSave={handleSaveNotebookEdit}
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
