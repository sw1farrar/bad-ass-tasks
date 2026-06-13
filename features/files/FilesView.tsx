"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2, Pencil, Plus, Search } from "lucide-react";
import { FileBookmarkButton } from "./components/FileBookmarkButton";
import { toast } from "sonner";
import { NotesView } from "@/features/notes/NotesView";
import type { Note, FileRecordType, WorkspaceMember } from "@/types";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { cn } from "@/lib/utils";
import {
  collectWorkspaceTags,
  countBookmarkedFiles,
  filterFiledNotes,
  filterPendingReview,
  isPendingReview,
  sortFiledNotes,
} from "@/lib/files/fileFilters";
import type { FilesSearchScope } from "@/lib/files/searchFilesInWorkspace";
import { useTaskStore } from "@/store/useTaskStore";
import { useFilesSearch } from "./hooks/useFilesSearch";
import { TagRail } from "./components/TagRail";
import {
  DEFAULT_FILES_BROWSE_FILTER,
  filterSearchResultsForBrowse,
  listFilesForBrowseFilter,
  setFilesLibrary,
  setFilesTagFilter,
  toggleFilesBookmarksOnly,
  getSelectedFilterTags,
  isReviewLibrary,
  type FilesBrowseFilter,
} from "@/lib/files/filesBrowseFilter";
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
import { buildPhotoNoteContent } from "@/lib/notes/buildPhotoNoteContent";
import { prefetchNoteAttachments } from "@/lib/notes/noteAttachmentListCache";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { MobileAddNoteChoiceSheet } from "./components/MobileAddNoteChoiceSheet";
import { MobilePhotoCaptureFlow } from "./components/MobilePhotoCaptureFlow";
import { ReceiptItemsModal } from "./components/ReceiptItemsModal";
import "./files-workspace.css";

const EMPTY_NOTE_DOC = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

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
  members?: WorkspaceMember[];
  currentUserId?: string;
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
  members,
  currentUserId,
  ...notesProps
}: FilesViewProps) {
  const isMobile = useIsMobileViewport();
  const isDesktop = !isMobile;
  const selectedNoteId = notesProps.selectedNoteId;
  const onSelectNote = notesProps.onSelectNote;
  const showMobileDetail = isMobile && !!selectedNoteId;

  const pendingFiles = useMemo(() => sortFiledNotes(filterPendingReview(notes)), [notes]);
  const filedFiles = useMemo(() => sortFiledNotes(filterFiledNotes(notes)), [notes]);
  const bookmarkCount = useMemo(() => countBookmarkedFiles(notes), [notes]);
  const workspaceTags = useMemo(
    () => collectWorkspaceTags([...filedFiles, ...pendingFiles]),
    [filedFiles, pendingFiles],
  );

  const [filter, setFilter] = useState<FilesBrowseFilter>(DEFAULT_FILES_BROWSE_FILTER);
  const filterChosenByUser = useRef(false);
  const [approveTarget, setApproveTarget] = useState<Note | null>(null);
  const [reviewPaused, setReviewPaused] = useState(false);
  const [fileEditorNote, setFileEditorNote] = useState<Note | null>(null);
  const [photoCaptureOpen, setPhotoCaptureOpen] = useState(false);
  const [addNoteChoiceOpen, setAddNoteChoiceOpen] = useState(false);
  const [receiptLedgerOpen, setReceiptLedgerOpen] = useState(false);
  const hydrateNoteDetail = useTaskStore((s) => s.hydrateNoteDetail);
  const addNote = useTaskStore((s) => s.addNote);

  const searchScope: FilesSearchScope = isReviewLibrary(filter) ? "review" : "filed";

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
    refresh: refreshAttachmentCounts,
  } = useNoteAttachmentCounts(workspaceId);

  const notesAttachmentRefreshKey = useMemo(
    () => notes.map((n) => `${n.id}:${n.updatedAt ?? ""}`).join("|"),
    [notes],
  );

  const selectedFile = useMemo(
    () => (selectedNoteId ? notes.find((n) => n.id === selectedNoteId) : null),
    [notes, selectedNoteId],
  );

  useEffect(() => {
    if (!selectedNoteId) return;
    void hydrateNoteDetail(selectedNoteId);
  }, [selectedNoteId, hydrateNoteDetail]);

  useEffect(() => {
    if (!notesProps.isLive) return;
    void refreshAttachmentCounts();
  }, [notesAttachmentRefreshKey, notesProps.isLive, refreshAttachmentCounts]);

  useEffect(() => {
    if (!selectedNoteId) return;
    prefetchNoteAttachments(selectedNoteId);
  }, [selectedNoteId]);

  useEffect(() => {
    if (!approveTarget) return;
    const fresh = notes.find((n) => n.id === approveTarget.id);
    if (fresh) setApproveTarget(fresh);
  }, [notes, approveTarget?.id]);

  useEffect(() => {
    if (!approveTarget?.id) return;
    void hydrateNoteDetail(approveTarget.id).then((hydrated) => {
      if (!hydrated) return;
      setApproveTarget((current) =>
        current?.id === hydrated.id ? { ...current, ...hydrated, bodyHydrated: true } : current,
      );
    });
  }, [approveTarget?.id, hydrateNoteDetail]);

  useEffect(() => {
    if (openReviewOnMount) {
      setFilter((current) => setFilesLibrary(current, "review"));
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
    setFilter((current) => setFilesLibrary(current, "review"));
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
      setFilter((current) => setFilesLibrary(current, "review"));
      filterChosenByUser.current = true;
    }
  }, [pendingFiles.length, openReviewOnMount]);

  const handleLibraryChange = useCallback(
    (library: "review" | "archive") => {
      filterChosenByUser.current = true;
      setFilter((current) => setFilesLibrary(current, library));
      clearSearch();
    },
    [clearSearch],
  );

  const handleBookmarksOnlyChange = useCallback((bookmarksOnly: boolean) => {
    filterChosenByUser.current = true;
    setFilter((current) => ({ ...current, bookmarksOnly }));
  }, []);

  const handleOpenReceiptFile = useCallback(
    (noteId: string) => {
      const file = notes.find((n) => n.id === noteId);
      if (!file) return;
      filterChosenByUser.current = true;
      setFilter((current) =>
        setFilesLibrary(current, isPendingReview(file) ? "review" : "archive"),
      );
      clearSearch();
      setFileEditorNote(null);
      setApproveTarget(null);
      onSelectNote(noteId);
    },
    [notes, onSelectNote, clearSearch],
  );

  const handleTagFilterChange = useCallback(
    (nextTags: string[]) => {
      filterChosenByUser.current = true;
      clearSearch();
      setFilter((current) => setFilesTagFilter(current, nextTags));
    },
    [clearSearch],
  );

  const selectedFilterTags = getSelectedFilterTags(filter);

  const streamedFiles = useMemo(() => {
    if (searchResultIds) {
      const byId = new Map(notes.map((n) => [n.id, n]));
      const results = searchResultIds.map((id) => byId.get(id)).filter(Boolean) as Note[];
      return filterSearchResultsForBrowse(results, filter);
    }

    return listFilesForBrowseFilter(notes, filter);
  }, [searchResultIds, filter, notes]);

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
      if (!isMobile) {
        onSelectNote(id);
      }
    },
    [resolveNoteById, onSelectNote, isMobile],
  );

  const closeMobileDetail = useCallback(() => {
    if (typeof window !== "undefined" && window.history.state?.mobileFileDetail) {
      window.history.back();
      return;
    }
    notesProps.onSelectNote(null);
  }, [notesProps.onSelectNote]);

  useEffect(() => {
    if (!isMobile || !selectedNoteId) return;
    const token = `file-${selectedNoteId}`;
    window.history.pushState({ mobileFileDetail: token }, "");
    const onPop = () => {
      notesProps.onSelectNote(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isMobile, selectedNoteId, notesProps.onSelectNote]);

  const openFileEditor = useCallback(
    (id: string) => {
      prefetchNoteAttachments(id);
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
    setReviewPaused(true);
    void hydrateNoteDetail(targetId).then((file) => {
      if (!file) return;
      setFileEditorNote(file);
    });
  }, [approveTarget?.id, hydrateNoteDetail]);

  const handleFileEditorClose = useCallback(() => {
    const preservedId = fileEditorNote?.id ?? null;
    const returningToReview =
      preservedId != null && approveTarget?.id === preservedId;
    setFileEditorNote(null);
    setReviewPaused(false);
    if (preservedId && !returningToReview) {
      onSelectNote(preservedId);
    }
  }, [fileEditorNote, approveTarget?.id, onSelectNote]);

  const handleSaveFileEdit = useCallback(
    async (noteId: string, input: CaptureFileInput) => {
      await notesProps.onUpdateNote(noteId, {
        title: input.title,
        content: input.content,
        tags: input.tags,
        memo: input.memo || null,
        recordType: input.recordType,
      });
    },
    [notesProps],
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
      if (isReviewLibrary(filter) && pendingFiles.length <= 1) {
        setFilter((current) => setFilesLibrary(current, "archive"));
      }
    },
    [approveTarget, onApproveFile, pendingFiles, filter, onSelectNote, resolveNoteById],
  );

  const handleNewFile = useCallback(() => {
    onOpenCapture?.();
  }, [onOpenCapture]);

  const handleToggleBookmark = useCallback(
    async (noteId: string, bookmarked: boolean) => {
      await notesProps.onUpdateNote(noteId, { bookmarked });
    },
    [notesProps.onUpdateNote],
  );

  const handlePhotoCaptureComplete = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const title = `Photos · ${format(new Date(), "MMM d")}`;
      const created = await addNote(title, EMPTY_NOTE_DOC, {
        tags: [],
        recordType: "document",
        reviewStatus: "pending_review",
      });

      if (!created) {
        toast.error("Could not create note");
        throw new Error("create-failed");
      }

      if (isSupabaseConfigured() && notesProps.isLive) {
        const uploaded = await uploadFilesToNote(created.id, files);
        if (uploaded === 0) {
          toast.warning("Photos could not be uploaded");
        } else if (uploaded < files.length) {
          toast.warning(`${uploaded} of ${files.length} photos uploaded`);
        } else {
          patchNoteAttachmentCount(workspaceId, created.id, uploaded);
          prefetchNoteAttachments(created.id);
        }
      } else {
        const content = await buildPhotoNoteContent(files);
        await notesProps.onUpdateNote(created.id, { content });
      }

      filterChosenByUser.current = true;
      setFilter((current) => setFilesLibrary(current, "review"));
      notesProps.onSelectNote(null);
      openReview(created.id);
      toast.success(
        files.length === 1 ? "Added to Review" : `${files.length} photos added to Review`,
      );
    },
    [addNote, workspaceId, notesProps, openReview],
  );

  const fileListContent =
    isReviewLibrary(filter) ? (
      <ReviewPanel
        files={streamedFiles}
        tasks={tasksById}
        selectedId={selectedNoteId}
        onSelect={(id) => notesProps.onSelectNote(id)}
        onReview={openReview}
        onOpenEditor={openFileEditor}
        attachmentCounts={attachmentCounts}
        emptyMessage={
          searchQuery.trim()
            ? "No files match your search."
            : filter.bookmarksOnly
              ? "No bookmarked files in Review yet."
              : undefined
        }
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
            : filter.bookmarksOnly
              ? "No bookmarked files in this view yet."
              : "No archived files match this filter yet."
        }
      />
    );

  return (
    <div
      className={cn(
        "files-root flex flex-col md:flex-row h-full min-h-0 overflow-hidden max-w-full min-w-0",
        showMobileDetail && "files-mobile-detail",
      )}
    >
      <TagRail
        filter={filter}
        onLibraryChange={handleLibraryChange}
        onBookmarksOnlyChange={handleBookmarksOnlyChange}
        onOpenReceiptLedger={isDesktop ? () => setReceiptLedgerOpen(true) : undefined}
        onTagFilterChange={handleTagFilterChange}
        tags={workspaceTags}
        reviewCount={pendingFiles.length}
        bookmarkCount={bookmarkCount}
        onNewFile={handleNewFile}
        isDesktop={isDesktop}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searching={isRemoteSearching}
        listContent={isDesktop ? fileListContent : undefined}
      />

      {!isDesktop && (
        <div className="files-list-column w-full min-w-0 max-w-full flex flex-1 flex-col min-h-0 border-r border-border-glass bg-bg box-border">
          <div className="files-list-toolbar files-mobile-toolbar-row border-b border-border-glass min-w-0 max-w-full box-border">
            <div className="files-mobile-toolbar-row__left flex flex-1 min-w-0 items-center gap-2">
              {!isReviewLibrary(filter) && (
                <TagMultiSelect
                  tags={workspaceTags}
                  selected={selectedFilterTags}
                  onChange={handleTagFilterChange}
                  variant="toolbar"
                />
              )}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files…"
                  className="files-mobile-search-input w-full min-w-0 bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint min-h-[44px]"
                  aria-label="Search files"
                />
                {isRemoteSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neon-purple" />
                )}
              </div>
            </div>
            <div className="files-mobile-toolbar-row__actions flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setAddNoteChoiceOpen(true)}
                className="files-mobile-add-note-btn flex items-center justify-center rounded-xl border border-neon-purple/30 bg-neon-purple/10 min-h-[44px] min-w-[44px] text-neon-purple-tint"
                aria-label="Add note"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
          {fileListContent}
        </div>
      )}

      {showMobileDetail && (
        <div className="files-mobile-back-bar">
          <button
            type="button"
            onClick={closeMobileDetail}
            className="flex items-center rounded-xl px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary min-h-[44px]"
            aria-label="Close file preview"
          >
            Close
          </button>
          <div className="min-w-0 flex-1 text-sm font-semibold truncate text-text-primary px-1">
            {selectedFile?.title || "Untitled file"}
          </div>
          {selectedNoteId && selectedFile && (
            <div className="flex items-center gap-0.5 shrink-0">
              <FileBookmarkButton
                bookmarked={!!selectedFile.bookmarked}
                onToggle={() => void handleToggleBookmark(selectedFile.id, !selectedFile.bookmarked)}
              />
              <button
                type="button"
                onClick={() => openFileEditor(selectedNoteId)}
                className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-neon-purple-tint hover:bg-surface-hover min-h-[44px] shrink-0"
                aria-label="Edit file"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
            </div>
          )}
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
        onToggleBookmark={handleToggleBookmark}
        tasks={notesProps.tasks}
        members={members}
        currentUserId={currentUserId}
        onCreateTaskAndLink={notesProps.onCreateTaskAndLink}
        onOpenTask={notesProps.onOpenTask}
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
        onToggleBookmark={handleToggleBookmark}
        onCreateTaskAndLink={notesProps.onCreateTaskAndLink}
        onLinkTaskToNote={notesProps.onLinkTaskToNote}
        onUnlinkTaskFromNote={notesProps.onUnlinkTaskFromNote}
        onOpenTask={notesProps.onOpenTask}
        onToggleTaskComplete={notesProps.onToggleTaskComplete}
        attachmentCountHint={
          fileEditorNote ? (attachmentCounts[fileEditorNote.id] ?? 0) : undefined
        }
        onAttachmentCountChange={setNoteCount}
      />

      {isDesktop && (
        <ReceiptItemsModal
          open={receiptLedgerOpen}
          onClose={() => setReceiptLedgerOpen(false)}
          workspaceId={workspaceId}
          onOpenFile={handleOpenReceiptFile}
        />
      )}

      {isMobile && (
        <>
          <MobileAddNoteChoiceSheet
            open={addNoteChoiceOpen}
            onClose={() => setAddNoteChoiceOpen(false)}
            onUploadPhotos={() => setPhotoCaptureOpen(true)}
            onTextNote={() => void handleNewFile()}
          />
          <MobilePhotoCaptureFlow
            open={photoCaptureOpen}
            onClose={() => setPhotoCaptureOpen(false)}
            onComplete={handlePhotoCaptureComplete}
          />
        </>
      )}
    </div>
  );
}