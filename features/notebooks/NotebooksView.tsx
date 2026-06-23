"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { filterNotebooksBySearch } from "@/lib/notebooks/notebookFilters";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import type { Note, Notebook } from "@/types";
import { NotebookRail } from "./components/NotebookRail";
import { NotebookStream } from "./components/NotebookStream";
import { NotebookContentArea } from "./components/NotebookContentArea";
import "../files/files-workspace.css";
import "./notebooks-workspace.css";

const EMPTY_DOC = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

export interface NotebooksViewProps {
  workspaceId: string;
  notebooks: Notebook[];
  notes: Note[];
  selectedNotebookId: string | null;
  selectedNoteId: string | null;
  isLive: boolean;
  onSelectNotebook: (id: string | null) => void;
  onSelectNote: (id: string | null) => void;
  onAddNotebook: (name?: string) => Promise<Notebook>;
  onUpdateNotebook: (id: string, updates: Partial<Pick<Notebook, "name" | "sortOrder">>) => Promise<unknown>;
  onDeleteNotebook: (id: string) => Promise<unknown>;
  onCreateNote: (title: string, content?: string, options?: { notebookId?: string }) => Promise<Note | null>;
  onUpdateNote: (id: string, updates: Partial<Note>) => Promise<boolean | null>;
  onDeleteNote: (id: string) => Promise<boolean | null>;
  onHydrateNote: (id: string) => Promise<Note | null>;
}

export function NotebooksView({
  workspaceId,
  notebooks,
  notes,
  selectedNotebookId,
  selectedNoteId,
  isLive,
  onSelectNotebook,
  onSelectNote,
  onAddNotebook,
  onUpdateNotebook,
  onDeleteNotebook,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onHydrateNote,
}: NotebooksViewProps) {
  const isMobile = useIsMobileViewport();
  const isDesktop = !isMobile;
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [pendingDeleteNotebookId, setPendingDeleteNotebookId] = useState<string | null>(null);
  const [focusTitleNoteId, setFocusTitleNoteId] = useState<string | null>(null);
  const [focusRenameNotebookId, setFocusRenameNotebookId] = useState<string | null>(null);
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState<string | null>(null);
  const [isDeletingNotebook, setIsDeletingNotebook] = useState(false);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
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

  const showMobileNotebookDetail = isMobile && !!selectedNotebookId;
  const showMobileNoteDetail = isMobile && !!selectedNoteId;

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
                  placeholder="Search notebooks…"
                  className="files-mobile-search-input w-full min-w-0 bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint min-h-[44px]"
                  aria-label="Search notebooks"
                />
              </div>
            </div>
            <div className="files-mobile-toolbar-row__actions flex items-center shrink-0">
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
                  <Plus className="h-4 w-4" />
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
          {isMobileRenaming ? (
            <input
              ref={mobileRenameRef}
              value={mobileRenameName}
              onChange={(e) => setMobileRenameName(e.target.value)}
              onBlur={() => commitMobileRename()}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitMobileRename();
                if (e.key === "Escape") setMobileRenameName(selectedNotebook?.name || "");
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
          selectedNoteId={selectedNoteId}
          selectedNote={selectedNote}
          isLive={isLive}
          isCreatingNote={isCreatingNote}
          onSelectNote={(id) => {
            onSelectNote(id);
          }}
          onCreateNote={() => void handleCreateNote()}
          onUpdateNote={onUpdateNote}
          onUpdateNotebook={(id, updates) => void onUpdateNotebook(id, updates)}
          onRequestDeleteNotebook={() => {
            if (selectedNotebookId) setPendingDeleteNotebookId(selectedNotebookId);
          }}
          onRequestDeleteNote={(id) => setPendingDeleteNoteId(id)}
          onDeleteNote={onDeleteNote}
          onHydrateNote={onHydrateNote}
          focusTitleNoteId={focusTitleNoteId}
          onTitleFocusConsumed={() => setFocusTitleNoteId(null)}
          focusRenameNotebook={!isMobile && focusRenameNotebookId === selectedNotebookId}
          onNotebookRenameFocusConsumed={() => setFocusRenameNotebookId(null)}
        />
      )}

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
        description="This notebook and all of its notes will be permanently deleted. This action cannot be undone."
        details={
          pendingDeleteNotebookNoteCount > 0 ? (
            <p className="text-sm text-text-muted">
              {pendingDeleteNotebookNoteCount} note
              {pendingDeleteNotebookNoteCount === 1 ? "" : "s"} will also be deleted.
            </p>
          ) : undefined
        }
        confirmText="Delete notebook"
        variant="destructive"
        isLoading={isDeletingNotebook}
        onConfirm={() => void handleDeleteNotebook()}
      />
    </div>
  );
}