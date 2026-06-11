"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Loader2, Plus, Search } from "lucide-react";
import { NotesView } from "@/features/notes/NotesView";
import type { Note, FileRecordType } from "@/types";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { cn } from "@/lib/utils";
import {
  collectWorkspaceTags,
  filterByAllTags,
  filterFiledNotes,
  filterPendingReview,
  isPendingReview,
  sortFiledNotes,
} from "@/lib/files/fileFilters";
import type { FilesSearchScope } from "@/lib/files/searchFilesInWorkspace";
import { useTaskStore } from "@/store/useTaskStore";
import { useFilesSearch } from "./hooks/useFilesSearch";
import { TagRail, type FilesBrowseFilter } from "./components/TagRail";
import { TagMultiSelect } from "./components/TagMultiSelect";
import { FileStream } from "./components/FileStream";
import { ReviewPanel } from "./components/ReviewPanel";
import {
  ApproveFileModal,
  type ApproveFileResult,
} from "./components/ApproveFileModal";
import {
  CaptureFileModal,
  type CaptureFileInput,
} from "./components/CaptureFileModal";
import { useNoteAttachmentCounts } from "@/features/notes/hooks";
import { patchNoteAttachmentCount } from "@/features/notes/hooks/useNoteAttachmentCounts";
import { uploadFilesToNote } from "@/lib/files/uploadNoteAttachments";
import { prefetchNoteAttachments } from "@/lib/notes/noteAttachmentListCache";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import "./files-workspace.css";

type FilesViewProps = Omit<React.ComponentProps<typeof NotesView>, "workspaceId"> & {
  workspaceId: string;
  onApproveFile: (
    id: string,
    input: { title: string; tags: string[]; memo: string; recordType: FileRecordType },
  ) => Promise<void>;
  /** Open Review drawer once (e.g. from Home). */
  openReviewOnMount?: boolean;
  onOpenReviewConsumed?: () => void;
  /** Open the Review approve modal for this note once (e.g. Home workspace tile). */
  openReviewNoteIdOnMount?: string | null;
  onOpenReviewNoteConsumed?: () => void;
  /** Open the capture modal instead of instant blank file. */
  onOpenCapture?: () => void;
};

export function FilesView({
  onApproveFile,
  workspaceId,
  notes,
  onCreateNote,
  openReviewOnMount,
  onOpenReviewConsumed,
  openReviewNoteIdOnMount,
  onOpenReviewNoteConsumed,
  onOpenCapture,
  ...notesProps
}: FilesViewProps) {
  const isMobile = useIsMobileViewport();
  const isDesktop = !isMobile;
  const selectedNoteId = notesProps.selectedNoteId;
  const onSelectNote = notesProps.onSelectNote;
  const showMobileDetail = isMobile && !!selectedNoteId;

  const pendingFiles = useMemo(() => sortFiledNotes(filterPendingReview(notes)), [notes]);
  const filedFiles = useMemo(() => sortFiledNotes(filterFiledNotes(notes)), [notes]);
  const workspaceTags = useMemo(
    () => collectWorkspaceTags([...filedFiles, ...pendingFiles]),
    [filedFiles, pendingFiles],
  );

  const [filter, setFilter] = useState<FilesBrowseFilter>({ kind: "all" });
  const filterChosenByUser = useRef(false);
  const [approveTarget, setApproveTarget] = useState<Note | null>(null);
  const [reviewPaused, setReviewPaused] = useState(false);
  const [fileEditorNote, setFileEditorNote] = useState<Note | null>(null);
  const hydrateNoteDetail = useTaskStore((s) => s.hydrateNoteDetail);

  const searchScope: FilesSearchScope = filter.kind === "review" ? "review" : "filed";

  const {
    searchQuery,
    setSearchQuery,
    resultIds: searchResultIds,
    isRemoteSearching,
    clearSearch,
  } = useFilesSearch({ notes, workspaceId, scope: searchScope });

  const tasksById = useMemo(
    () => new Map(notesProps.tasks.map((t) => [t.id, t])),
    [notesProps.tasks],
  );

  const {
    counts: attachmentCounts,
    loading: attachmentCountsLoading,
    setNoteCount,
  } = useNoteAttachmentCounts(workspaceId);

  const selectedFile = useMemo(
    () => (selectedNoteId ? notes.find((n) => n.id === selectedNoteId) : null),
    [notes, selectedNoteId],
  );

  useEffect(() => {
    if (!selectedNoteId) return;
    void hydrateNoteDetail(selectedNoteId);
  }, [selectedNoteId, hydrateNoteDetail]);

  useEffect(() => {
    if (!selectedNoteId) return;
    if ((attachmentCounts[selectedNoteId] ?? 0) > 0) {
      prefetchNoteAttachments(selectedNoteId);
    }
  }, [selectedNoteId, attachmentCounts]);

  useEffect(() => {
    if (!approveTarget) return;
    const fresh = notes.find((n) => n.id === approveTarget.id);
    if (fresh) setApproveTarget(fresh);
  }, [notes, approveTarget?.id]);

  useEffect(() => {
    if (openReviewOnMount) {
      setFilter({ kind: "review" });
      filterChosenByUser.current = true;
      onOpenReviewConsumed?.();
    }
  }, [openReviewOnMount, onOpenReviewConsumed]);

  useEffect(() => {
    if (!openReviewNoteIdOnMount) return;
    const file = notes.find((n) => n.id === openReviewNoteIdOnMount);
    if (!file) {
      if (notes.length > 0) onOpenReviewNoteConsumed?.();
      return;
    }
    if (!isPendingReview(file)) {
      onOpenReviewNoteConsumed?.();
      return;
    }
    setFilter({ kind: "review" });
    filterChosenByUser.current = true;
    setFileEditorNote(null);
    setReviewPaused(false);
    setApproveTarget(file);
    onSelectNote(openReviewNoteIdOnMount);
    onOpenReviewNoteConsumed?.();
  }, [openReviewNoteIdOnMount, notes, onSelectNote, onOpenReviewNoteConsumed]);

  useEffect(() => {
    if (filterChosenByUser.current || openReviewOnMount) return;
    if (pendingFiles.length > 0) {
      setFilter({ kind: "review" });
      filterChosenByUser.current = true;
    }
  }, [pendingFiles.length, openReviewOnMount]);

  const handleFilterChange = useCallback(
    (next: FilesBrowseFilter) => {
      filterChosenByUser.current = true;
      setFilter(next);
      clearSearch();
    },
    [clearSearch],
  );

  const handleTagFilterChange = useCallback(
    (nextTags: string[]) => {
      filterChosenByUser.current = true;
      clearSearch();
      if (nextTags.length === 0) {
        setFilter({ kind: "all" });
        return;
      }
      setFilter({ kind: "tags", tags: nextTags });
    },
    [clearSearch],
  );

  const selectedFilterTags = filter.kind === "tags" ? filter.tags : [];

  const streamedFiles = useMemo(() => {
    if (searchResultIds) {
      const byId = new Map(notes.map((n) => [n.id, n]));
      let results = searchResultIds.map((id) => byId.get(id)).filter(Boolean) as Note[];

      if (filter.kind === "untagged") {
        results = results.filter(
          (n) => (n.tags ?? []).filter((t) => t !== "from-email").length === 0,
        );
      } else if (filter.kind === "tags") {
        results = filterByAllTags(results, filter.tags);
      }

      return results;
    }

    if (filter.kind === "review") return pendingFiles;

    let list = filedFiles;
    if (filter.kind === "untagged") {
      list = list.filter(
        (n) => (n.tags ?? []).filter((t) => t !== "from-email").length === 0,
      );
    } else if (filter.kind === "tags") {
      list = filterByAllTags(list, filter.tags);
    }
    return list;
  }, [searchResultIds, filter, pendingFiles, filedFiles, notes]);

  const resolveNoteById = useCallback(
    (id: string) => notes.find((n) => n.id === id) ?? null,
    [notes],
  );

  const openReview = useCallback(
    (id: string) => {
      const file = resolveNoteById(id);
      if (!file) return;
      setFileEditorNote(null);
      setReviewPaused(false);
      setApproveTarget(file);
      onSelectNote(id);
    },
    [resolveNoteById, onSelectNote],
  );

  const openFileEditor = useCallback(
    (id: string) => {
      void hydrateNoteDetail(id).then((file) => {
        if (!file) return;
        setFileEditorNote(file);
        onSelectNote(id);
      });
    },
    [hydrateNoteDetail, onSelectNote],
  );

  const openReviewEditor = useCallback(() => {
    const targetId = approveTarget?.id;
    if (!targetId) return;
    const fresh = resolveNoteById(targetId);
    if (!fresh) return;
    setReviewPaused(true);
    setFileEditorNote(fresh);
  }, [approveTarget?.id, resolveNoteById]);

  const handleFileEditorClose = useCallback(() => {
    const preservedId = fileEditorNote?.id ?? null;
    setFileEditorNote(null);
    setReviewPaused(false);
    if (preservedId) onSelectNote(preservedId);
  }, [fileEditorNote, onSelectNote]);

  const handleSaveFileEdit = useCallback(
    async (noteId: string, input: CaptureFileInput) => {
      await notesProps.onUpdateNote(noteId, {
        title: input.title,
        content: input.content,
        tags: input.tags,
        memo: input.memo || null,
        recordType: input.recordType,
      });

      if (input.attachments.length > 0 && isSupabaseConfigured() && workspaceId) {
        const uploaded = await uploadFilesToNote(noteId, input.attachments);
        if (uploaded > 0) {
          const prior = attachmentCounts[noteId] ?? 0;
          patchNoteAttachmentCount(workspaceId, noteId, prior + uploaded);
        }
      }
    },
    [notesProps, workspaceId, attachmentCounts],
  );

  const handleApprove = useCallback(
    async (
      input: {
        title: string;
        tags: string[];
        memo: string;
        recordType: FileRecordType;
      },
      result: ApproveFileResult,
    ) => {
      if (!approveTarget) return;

      const currentId = approveTarget.id;
      const idx = pendingFiles.findIndex((f) => f.id === currentId);
      const nextFile = idx >= 0 ? (pendingFiles[idx + 1] ?? null) : null;

      await onApproveFile(currentId, input);

      if (result === "next" && nextFile) {
        setFileEditorNote(null);
        setReviewPaused(false);
        const freshNext = resolveNoteById(nextFile.id) ?? nextFile;
        setApproveTarget(freshNext);
        onSelectNote(freshNext.id);
        return;
      }

      setFileEditorNote(null);
      setReviewPaused(false);
      setApproveTarget(null);
      if (filter.kind === "review" && pendingFiles.length <= 1) {
        setFilter({ kind: "all" });
      }
    },
    [approveTarget, onApproveFile, pendingFiles, filter.kind, onSelectNote, resolveNoteById],
  );

  const handleNewFile = useCallback(() => {
    onOpenCapture?.();
  }, [onOpenCapture]);

  const listTitle =
    filter.kind === "review"
      ? "Review"
      : searchQuery.trim()
        ? "Search results"
        : filter.kind === "tags"
          ? filter.tags.join(" + ")
          : "Archive";

  const fileListContent =
    filter.kind === "review" ? (
      <ReviewPanel
        files={streamedFiles}
        tasks={tasksById}
        selectedId={selectedNoteId}
        onSelect={(id) => notesProps.onSelectNote(id)}
        onReview={openReview}
        onOpenEditor={openFileEditor}
        attachmentCounts={attachmentCounts}
      />
    ) : (
      <FileStream
        files={streamedFiles}
        tasks={tasksById}
        selectedId={selectedNoteId}
        onSelect={(id) => notesProps.onSelectNote(id)}
        onOpenEditor={openFileEditor}
        attachmentCounts={attachmentCounts}
        emptyMessage={
          searchQuery.trim()
            ? "No files match your search."
            : "No archived files match this filter yet."
        }
      />
    );

  return (
    <div
      className={cn(
        "files-root flex h-full min-h-0 overflow-hidden",
        showMobileDetail && "files-mobile-detail",
      )}
    >
      <TagRail
        filter={filter}
        onFilterChange={handleFilterChange}
        onTagFilterChange={handleTagFilterChange}
        tags={workspaceTags}
        reviewCount={pendingFiles.length}
        onNewFile={handleNewFile}
        isDesktop={isDesktop}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searching={isRemoteSearching}
        listContent={isDesktop ? fileListContent : undefined}
      />

      {!isDesktop && (
        <div className="files-list-column w-64 sm:w-72 shrink-0 flex flex-col min-h-0 border-r border-border-glass bg-bg">
          <div className="p-3 border-b border-border-glass space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                {listTitle}
              </div>
              <button
                type="button"
                onClick={() => void handleNewFile()}
                className="md:hidden flex items-center gap-1 rounded-lg border border-neon-purple/30 bg-neon-purple/10 px-2.5 py-1.5 text-[11px] font-semibold text-neon-purple-tint"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            </div>
            {filter.kind !== "review" && (
              <TagMultiSelect
                tags={workspaceTags}
                selected={selectedFilterTags}
                onChange={handleTagFilterChange}
              />
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files…"
                className="w-full bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint"
                aria-label="Search files"
              />
              {isRemoteSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neon-purple" />
              )}
            </div>
          </div>
          {fileListContent}
        </div>
      )}

      {showMobileDetail && (
        <div className="files-mobile-back-bar">
          <button
            type="button"
            onClick={() => notesProps.onSelectNote(null)}
            className="flex items-center gap-1 rounded-xl px-2 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary min-h-[40px]"
            aria-label="Back to file list"
          >
            <ChevronLeft className="h-5 w-5" />
            Files
          </button>
          <div className="min-w-0 flex-1 text-sm font-medium truncate text-text-primary">
            {selectedFile?.title || "Untitled file"}
          </div>
        </div>
      )}

      <div className="files-detail-column flex flex-1 flex-col min-w-0 min-h-0 h-full">
        <NotesView
          {...notesProps}
          notes={notes}
          workspaceId={workspaceId}
          onCreateNote={onCreateNote}
          shellMode="detail-only"
          previewMode
          onRequestEdit={openFileEditor}
          attachmentCounts={attachmentCounts}
          attachmentCountsLoading={attachmentCountsLoading}
          onAttachmentCountChange={setNoteCount}
        />
      </div>

      <ApproveFileModal
        file={approveTarget}
        isOpen={!!approveTarget && !reviewPaused && !fileEditorNote}
        onClose={() => {
          setApproveTarget(null);
          setReviewPaused(false);
        }}
        workspaceTags={workspaceTags}
        remainingInQueue={pendingFiles.length}
        onApprove={handleApprove}
        onEdit={openReviewEditor}
      />

      <CaptureFileModal
        key={fileEditorNote?.id ?? "file-editor-closed"}
        isOpen={!!fileEditorNote}
        mode="edit"
        initialNote={fileEditorNote}
        onClose={handleFileEditorClose}
        workspaceTags={workspaceTags}
        isLive={notesProps.isLive}
        tasks={notesProps.tasks}
        linkedTaskIds={fileEditorNote?.linkedTaskIds ?? []}
        onSaveEdit={handleSaveFileEdit}
        onCreateTaskAndLink={notesProps.onCreateTaskAndLink}
      />
    </div>
  );
}