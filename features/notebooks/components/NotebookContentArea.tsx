"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Notebook as NotebookIcon } from "lucide-react";
import type { Note, Notebook, NotebookTask, NotebookTaskProgress, WorkspaceMember } from "@/types";
import { filterNotebookNotesBySearch } from "@/lib/notebooks/notebookFilters";
import {
  DEFAULT_NOTEBOOK_SECTION_TAB,
  resolveNotebookEnabledSections,
} from "@/lib/notebooks/notebookSections";
import { getEnabledNotebookSections } from "@/lib/workspace/workspaceSettings";
import { useTaskStore } from "@/store/useTaskStore";
import { NotebookDetailHeader } from "./NotebookDetailHeader";
import { NotebookNotesPanel } from "./NotebookNotesPanel";
import { NotebookSectionMenu } from "./NotebookSectionMenu";
import { NotebookTasksPanel } from "./NotebookTasksPanel";

interface NotebookContentAreaProps {
  notebook: Notebook | null;
  showNotebookHeader?: boolean;
  showSectionMenu?: boolean;
  notes: Note[];
  tasks: NotebookTask[];
  taskProgress: NotebookTaskProgress[];
  members: WorkspaceMember[];
  currentUserId?: string;
  selectedNoteId: string | null;
  selectedNote: Note | null;
  selectedTaskId: string | null;
  isLive: boolean;
  isCreatingNote?: boolean;
  onSelectNote: (id: string) => void;
  onSelectTask: (id: string | null) => void;
  onCreateNote: () => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => Promise<boolean | null>;
  onDeleteNote: (id: string) => Promise<boolean | null>;
  onHydrateNote: (id: string) => Promise<Note | null>;
  onEditNotebook: () => void;
  onRequestDeleteNotebook: () => void;
  onRequestDeleteNote?: (id: string) => void;
  onAddNotebookTask: (title?: string) => void | Promise<unknown>;
  onToggleNotebookTask: (id: string) => void | Promise<unknown>;
  onUpdateNotebookTask: (id: string, title: string) => void | Promise<unknown>;
  onSetNotebookTaskShowOnWorkspace: (id: string, showOnWorkspace: boolean) => void | Promise<unknown>;
  onRequestDeleteNotebookTask: (id: string) => void;
  onAddNotebookTaskProgress: (taskId: string, body: string) => void | Promise<unknown>;
  onUpdateNotebookTaskProgress: (id: string, body: string) => void | Promise<unknown>;
  onRequestDeleteNotebookTaskProgress: (id: string) => void;
  focusTitleNoteId?: string | null;
  onTitleFocusConsumed?: () => void;
}

export function NotebookContentArea({
  notebook,
  showNotebookHeader = true,
  showSectionMenu = true,
  notes,
  tasks,
  taskProgress,
  members,
  currentUserId,
  selectedNoteId,
  selectedNote,
  selectedTaskId,
  isLive,
  isCreatingNote,
  onSelectNote,
  onSelectTask,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onHydrateNote,
  onEditNotebook,
  onRequestDeleteNotebook,
  onRequestDeleteNote,
  onAddNotebookTask,
  onToggleNotebookTask,
  onUpdateNotebookTask,
  onSetNotebookTaskShowOnWorkspace,
  onRequestDeleteNotebookTask,
  onAddNotebookTaskProgress,
  onUpdateNotebookTaskProgress,
  onRequestDeleteNotebookTaskProgress,
  focusTitleNoteId,
  onTitleFocusConsumed,
}: NotebookContentAreaProps) {
  const workspaceSettings = useTaskStore((s) => s.currentWorkspace.settings);
  const activeTab = useTaskStore((s) => s.selectedNotebookSectionTab);
  const setActiveTab = useTaskStore((s) => s.setSelectedNotebookSectionTab);
  const enabledTabs = useMemo(
    () => getEnabledNotebookSections(workspaceSettings),
    [workspaceSettings],
  );
  const [noteSearchQuery, setNoteSearchQuery] = useState("");

  const enabledSections = useMemo(
    () => (notebook ? resolveNotebookEnabledSections(notebook) : []),
    [notebook],
  );

  useEffect(() => {
    setNoteSearchQuery("");
    if (!notebook) return;
    if (!enabledSections.includes(activeTab)) {
      setActiveTab(enabledSections[0] ?? DEFAULT_NOTEBOOK_SECTION_TAB);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebook?.id, enabledSections, notebook]);

  useEffect(() => {
    if (!enabledSections.includes(activeTab)) {
      setActiveTab(enabledSections[0] ?? DEFAULT_NOTEBOOK_SECTION_TAB);
    }
  }, [activeTab, enabledSections]);

  useEffect(() => {
    if (enabledTabs.length === 0) return;
    if (!enabledTabs.includes(activeTab)) {
      setActiveTab(enabledTabs[0]);
    }
  }, [activeTab, enabledTabs, setActiveTab]);

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
          onEdit={onEditNotebook}
          onDelete={onRequestDeleteNotebook}
        />
      )}

      {showSectionMenu && (
        <NotebookSectionMenu
          notebook={notebook}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          enabledTabs={enabledTabs}
        />
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
          onSetShowOnWorkspace={onSetNotebookTaskShowOnWorkspace}
          onRequestDeleteTask={onRequestDeleteNotebookTask}
          onAddProgress={onAddNotebookTaskProgress}
          onUpdateProgress={onUpdateNotebookTaskProgress}
          onRequestDeleteProgress={onRequestDeleteNotebookTaskProgress}
        />
      )}
    </div>
  );
}
