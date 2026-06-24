"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Notebook as NotebookIcon } from "lucide-react";
import type {
  Note,
  Notebook,
  NotebookCompetitor,
  NotebookCustomer,
  NotebookCustomerNote,
  NotebookInvestment,
  NotebookInvestmentNote,
  NotebookTask,
  NotebookTaskProgress,
  WorkspaceMember,
} from "@/types";
import { filterNotebookNotesBySearch } from "@/lib/notebooks/notebookFilters";
import { DEFAULT_NOTEBOOK_SECTION_TAB } from "@/lib/notebooks/notebookSections";
import { NotebookDetailHeader } from "./NotebookDetailHeader";
import { NotebookNotesPanel } from "./NotebookNotesPanel";
import { NotebookSectionMenu, type NotebookSectionTab } from "./NotebookSectionMenu";
import { NotebookTasksPanel } from "./NotebookTasksPanel";
import { NotebookInvestmentsPanel } from "./NotebookInvestmentsPanel";
import { NotebookCustomersPanel } from "./NotebookCustomersPanel";
import { NotebookCompetitorsPanel } from "./NotebookCompetitorsPanel";

interface NotebookContentAreaProps {
  notebook: Notebook | null;
  showNotebookHeader?: boolean;
  showSectionMenu?: boolean;
  notes: Note[];
  tasks: NotebookTask[];
  taskProgress: NotebookTaskProgress[];
  investments: NotebookInvestment[];
  investmentNotes: NotebookInvestmentNote[];
  customers: NotebookCustomer[];
  customerNotes: NotebookCustomerNote[];
  competitors: NotebookCompetitor[];
  members: WorkspaceMember[];
  currentUserId?: string;
  selectedNoteId: string | null;
  selectedNote: Note | null;
  selectedTaskId: string | null;
  selectedInvestmentId: string | null;
  selectedCustomerId: string | null;
  isLive: boolean;
  isCreatingNote?: boolean;
  onSelectNote: (id: string) => void;
  onSelectTask: (id: string | null) => void;
  onSelectInvestment: (id: string | null) => void;
  onSelectCustomer: (id: string | null) => void;
  onCreateNote: () => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => Promise<boolean | null>;
  onDeleteNote: (id: string) => Promise<boolean | null>;
  onHydrateNote: (id: string) => Promise<Note | null>;
  onUpdateNotebook: (id: string, updates: Partial<Pick<Notebook, "name" | "sortOrder">>) => void;
  onRequestDeleteNotebook: () => void;
  onRequestDeleteNote?: (id: string) => void;
  onAddNotebookTask: (title?: string) => void | Promise<unknown>;
  onToggleNotebookTask: (id: string) => void | Promise<unknown>;
  onUpdateNotebookTask: (id: string, title: string) => void | Promise<unknown>;
  onRequestDeleteNotebookTask: (id: string) => void;
  onAddNotebookTaskProgress: (taskId: string, body: string) => void | Promise<unknown>;
  onUpdateNotebookTaskProgress: (id: string, body: string) => void | Promise<unknown>;
  onRequestDeleteNotebookTaskProgress: (id: string) => void;
  onAddNotebookInvestment: (title?: string) => void | Promise<unknown>;
  onUpdateNotebookInvestment: (id: string, title: string) => void | Promise<unknown>;
  onReorderNotebookInvestments: (orderedIds: string[]) => void | Promise<unknown>;
  onRequestDeleteNotebookInvestment: (id: string) => void;
  onAddNotebookInvestmentNote: (investmentId: string, body: string) => void | Promise<unknown>;
  onUpdateNotebookInvestmentNote: (id: string, body: string) => void | Promise<unknown>;
  onRequestDeleteNotebookInvestmentNote: (id: string) => void;
  onAddNotebookCustomer: (accountName: string) => void | Promise<unknown>;
  onUpdateNotebookCustomer: (id: string, accountName: string) => void | Promise<unknown>;
  onRequestDeleteNotebookCustomer: (id: string) => void;
  onAddNotebookCustomerNote: (customerId: string, body: string) => void | Promise<unknown>;
  onUpdateNotebookCustomerNote: (id: string, body: string) => void | Promise<unknown>;
  onRequestDeleteNotebookCustomerNote: (id: string) => void;
  onAddNotebookCompetitor: (name: string, salesPotential: number) => void | Promise<unknown>;
  onUpdateNotebookCompetitor: (
    id: string,
    updates: { name?: string; salesPotential?: number },
  ) => void | Promise<unknown>;
  onRequestDeleteNotebookCompetitor: (id: string) => void;
  onSetNotebookOurSales: (value: number) => void | Promise<unknown>;
  focusTitleNoteId?: string | null;
  onTitleFocusConsumed?: () => void;
  focusRenameNotebook?: boolean;
  onNotebookRenameFocusConsumed?: () => void;
}

export function NotebookContentArea({
  notebook,
  showNotebookHeader = true,
  showSectionMenu = true,
  notes,
  tasks,
  taskProgress,
  investments,
  investmentNotes,
  customers,
  customerNotes,
  competitors,
  members,
  currentUserId,
  selectedNoteId,
  selectedNote,
  selectedTaskId,
  selectedInvestmentId,
  selectedCustomerId,
  isLive,
  isCreatingNote,
  onSelectNote,
  onSelectTask,
  onSelectInvestment,
  onSelectCustomer,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onHydrateNote,
  onUpdateNotebook,
  onRequestDeleteNotebook,
  onRequestDeleteNote,
  onAddNotebookTask,
  onToggleNotebookTask,
  onUpdateNotebookTask,
  onRequestDeleteNotebookTask,
  onAddNotebookTaskProgress,
  onUpdateNotebookTaskProgress,
  onRequestDeleteNotebookTaskProgress,
  onAddNotebookInvestment,
  onUpdateNotebookInvestment,
  onReorderNotebookInvestments,
  onRequestDeleteNotebookInvestment,
  onAddNotebookInvestmentNote,
  onUpdateNotebookInvestmentNote,
  onRequestDeleteNotebookInvestmentNote,
  onAddNotebookCustomer,
  onUpdateNotebookCustomer,
  onRequestDeleteNotebookCustomer,
  onAddNotebookCustomerNote,
  onUpdateNotebookCustomerNote,
  onRequestDeleteNotebookCustomerNote,
  onAddNotebookCompetitor,
  onUpdateNotebookCompetitor,
  onRequestDeleteNotebookCompetitor,
  onSetNotebookOurSales,
  focusTitleNoteId,
  onTitleFocusConsumed,
  focusRenameNotebook,
  onNotebookRenameFocusConsumed,
}: NotebookContentAreaProps) {
  const [activeTab, setActiveTab] = useState<NotebookSectionTab>(DEFAULT_NOTEBOOK_SECTION_TAB);
  const [noteSearchQuery, setNoteSearchQuery] = useState("");

  useEffect(() => {
    setActiveTab(DEFAULT_NOTEBOOK_SECTION_TAB);
    setNoteSearchQuery("");
  }, [notebook?.id]);

  const filteredNotes = useMemo(
    () => (notebook ? filterNotebookNotesBySearch(notes, noteSearchQuery) : []),
    [notebook, notes, noteSearchQuery],
  );

  if (!notebook) {
    return (
      <div className="files-detail-column flex flex-1 flex-col items-center justify-center min-h-0 p-8 text-center">
        <NotebookIcon className="h-12 w-12 text-neon-purple/40 mb-4" />
        <p className="text-sm text-text-muted max-w-sm">
          Select a notebook from the list, or add a new one to start taking notes.
        </p>
      </div>
    );
  }

  return (
    <div className="files-detail-column flex flex-1 flex-col min-w-0 min-h-0 h-full">
      {showNotebookHeader && (
        <NotebookDetailHeader
          notebook={notebook}
          onRename={(name) => onUpdateNotebook(notebook.id, { name })}
          onDelete={onRequestDeleteNotebook}
          focusRename={focusRenameNotebook}
          onFocusRenameConsumed={onNotebookRenameFocusConsumed}
        />
      )}

      {showSectionMenu && (
        <NotebookSectionMenu activeTab={activeTab} onTabChange={setActiveTab} />
      )}

      {activeTab === "notes" && (
        <NotebookNotesPanel
          notes={filteredNotes}
          selectedNoteId={selectedNoteId}
          selectedNote={selectedNote}
          isLive={isLive}
          isCreatingNote={isCreatingNote}
          noteSearchQuery={noteSearchQuery}
          onNoteSearchQueryChange={setNoteSearchQuery}
          onSelectNote={onSelectNote}
          onCreateNote={() => {
            setNoteSearchQuery("");
            onCreateNote();
          }}
          onUpdateNote={onUpdateNote}
          onDeleteNote={onDeleteNote}
          onHydrateNote={onHydrateNote}
          onRequestDeleteNote={onRequestDeleteNote}
          focusTitleNoteId={focusTitleNoteId}
          onTitleFocusConsumed={onTitleFocusConsumed}
        />
      )}

      {activeTab === "tasks" && (
        <NotebookTasksPanel
          tasks={tasks}
          progress={taskProgress}
          members={members}
          currentUserId={currentUserId}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          onAddTask={onAddNotebookTask}
          onToggleTask={onToggleNotebookTask}
          onUpdateTask={onUpdateNotebookTask}
          onRequestDeleteTask={onRequestDeleteNotebookTask}
          onAddProgress={onAddNotebookTaskProgress}
          onUpdateProgress={onUpdateNotebookTaskProgress}
          onRequestDeleteProgress={onRequestDeleteNotebookTaskProgress}
        />
      )}

      {activeTab === "investments" && (
        <NotebookInvestmentsPanel
          investments={investments}
          notes={investmentNotes}
          members={members}
          currentUserId={currentUserId}
          selectedInvestmentId={selectedInvestmentId}
          onSelectInvestment={onSelectInvestment}
          onAdd={onAddNotebookInvestment}
          onUpdate={onUpdateNotebookInvestment}
          onReorder={(orderedIds) => onReorderNotebookInvestments(orderedIds)}
          onRequestDelete={onRequestDeleteNotebookInvestment}
          onAddNote={onAddNotebookInvestmentNote}
          onUpdateNote={onUpdateNotebookInvestmentNote}
          onRequestDeleteNote={onRequestDeleteNotebookInvestmentNote}
        />
      )}

      {activeTab === "customers" && (
        <NotebookCustomersPanel
          customers={customers}
          notes={customerNotes}
          members={members}
          currentUserId={currentUserId}
          selectedCustomerId={selectedCustomerId}
          onSelectCustomer={onSelectCustomer}
          onAddCustomer={onAddNotebookCustomer}
          onUpdateCustomer={onUpdateNotebookCustomer}
          onRequestDeleteCustomer={onRequestDeleteNotebookCustomer}
          onAddNote={onAddNotebookCustomerNote}
          onUpdateNote={onUpdateNotebookCustomerNote}
          onRequestDeleteNote={onRequestDeleteNotebookCustomerNote}
        />
      )}

      {activeTab === "competitors" && (
        <NotebookCompetitorsPanel
          competitors={competitors}
          ourSales={notebook.ourSales ?? 0}
          onOurSalesChange={onSetNotebookOurSales}
          onAdd={onAddNotebookCompetitor}
          onUpdate={onUpdateNotebookCompetitor}
          onRequestDelete={onRequestDeleteNotebookCompetitor}
        />
      )}
    </div>
  );
}