"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Loader2, Plus, Search } from "lucide-react";
import { NotesView } from "@/features/notes/NotesView";
import type { Note, FileRecordType } from "@/types";
import { apiFetch } from "@/lib/api/apiFetch";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { cn } from "@/lib/utils";
import {
  collectWorkspaceTags,
  filterByAllTags,
  filterFiledNotes,
  filterPendingReview,
  sortFiledNotes,
} from "@/lib/files/fileFilters";
import { searchFilesInWorkspace } from "@/lib/files/searchFilesInWorkspace";
import { TagRail, type FilesBrowseFilter } from "./components/TagRail";
import { FileStream } from "./components/FileStream";
import { ReviewPanel } from "./components/ReviewPanel";
import {
  ApproveFileModal,
  type ApproveFileResult,
} from "./components/ApproveFileModal";
import { useNoteAttachmentCounts } from "@/features/notes/hooks";
import "./files-workspace.css";

type FilesViewProps = React.ComponentProps<typeof NotesView> & {
  onApproveFile: (
    id: string,
    input: { title: string; tags: string[]; memo: string; recordType: FileRecordType },
  ) => Promise<void>;
  /** Open Review drawer once (e.g. from Home). */
  openReviewOnMount?: boolean;
  onOpenReviewConsumed?: () => void;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResultIds, setSearchResultIds] = useState<string[] | null>(null);
  const [approveTarget, setApproveTarget] = useState<Note | null>(null);

  const { counts: attachmentCounts } = useNoteAttachmentCounts(workspaceId);

  const selectedFile = useMemo(
    () => (selectedNoteId ? notes.find((n) => n.id === selectedNoteId) : null),
    [notes, selectedNoteId],
  );

  useEffect(() => {
    if (openReviewOnMount) {
      setFilter({ kind: "review" });
      filterChosenByUser.current = true;
      onOpenReviewConsumed?.();
    }
  }, [openReviewOnMount, onOpenReviewConsumed]);

  useEffect(() => {
    if (filterChosenByUser.current || openReviewOnMount) return;
    if (pendingFiles.length > 0) {
      setFilter({ kind: "review" });
      filterChosenByUser.current = true;
    }
  }, [pendingFiles.length, openReviewOnMount]);

  const handleFilterChange = useCallback((next: FilesBrowseFilter) => {
    filterChosenByUser.current = true;
    setFilter(next);
    setSearchQuery("");
    setSearchResultIds(null);
  }, []);

  const streamedFiles = useMemo(() => {
    if (searchResultIds) {
      const byId = new Map(notes.map((n) => [n.id, n]));
      return searchResultIds.map((id) => byId.get(id)).filter(Boolean) as Note[];
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

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || !workspaceId) {
      setSearchResultIds(null);
      setSearching(false);
      return;
    }

    const handle = window.setTimeout(() => {
      setSearching(true);
      void apiFetch(
        `/api/workspace/files/search?workspaceId=${encodeURIComponent(workspaceId)}&q=${encodeURIComponent(q)}&includePending=${filter.kind === "review"}`,
      )
        .then(async (res) => {
          if (!res.ok) throw new Error("search failed");
          const json = (await res.json()) as { results?: Array<{ id: string }> };
          setSearchResultIds((json.results ?? []).map((r) => r.id));
        })
        .catch(() => {
          const scope = filter.kind === "review" ? "review" : "filed";
          const ids = searchFilesInWorkspace(notes, q, { scope }).map((n) => n.id);
          setSearchResultIds(ids);
        })
        .finally(() => setSearching(false));
    }, 300);

    return () => window.clearTimeout(handle);
  }, [searchQuery, workspaceId, notes, filter.kind]);

  const openReview = useCallback(
    (id: string) => {
      const file = notes.find((n) => n.id === id);
      if (!file) return;
      setApproveTarget(file);
      onSelectNote(id);
    },
    [notes, onSelectNote],
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
        setApproveTarget(nextFile);
        onSelectNote(nextFile.id);
        return;
      }

      setApproveTarget(null);
      if (filter.kind === "review" && pendingFiles.length <= 1) {
        setFilter({ kind: "all" });
      }
    },
    [approveTarget, onApproveFile, pendingFiles, filter.kind, onSelectNote],
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
        selectedId={selectedNoteId}
        onSelect={(id) => notesProps.onSelectNote(id)}
        onReview={openReview}
        attachmentCounts={attachmentCounts}
      />
    ) : (
      <FileStream
        files={streamedFiles}
        selectedId={selectedNoteId}
        onSelect={(id) => notesProps.onSelectNote(id)}
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
        tags={workspaceTags}
        reviewCount={pendingFiles.length}
        onNewFile={handleNewFile}
        isDesktop={isDesktop}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searching={searching}
        listContent={isDesktop ? fileListContent : undefined}
      />

      {!isDesktop && (
        <div className="files-list-column w-64 sm:w-72 shrink-0 flex flex-col min-h-0 border-r border-white/10 bg-[#0a0a0a]">
          <div className="p-3 border-b border-white/10 space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="text-xs font-semibold uppercase tracking-widest text-[#71717a]">
                {listTitle}
              </div>
              <button
                type="button"
                onClick={() => void handleNewFile()}
                className="md:hidden flex items-center gap-1 rounded-lg border border-[#c084fc]/30 bg-[#c084fc]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#e9d5ff]"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#52525b]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files…"
                className="w-full bg-[#111114] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#c084fc]/40 placeholder:text-[#52525b]"
                aria-label="Search files"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#c084fc]" />
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
            className="flex items-center gap-1 rounded-xl px-2 py-2 text-sm text-[#a1a1aa] hover:bg-white/5 hover:text-white min-h-[40px]"
            aria-label="Back to file list"
          >
            <ChevronLeft className="h-5 w-5" />
            Files
          </button>
          <div className="min-w-0 flex-1 text-sm font-medium truncate text-[#f4f4f5]">
            {selectedFile?.title || "Untitled file"}
          </div>
        </div>
      )}

      <div className="files-detail-column flex-1 min-w-0 min-h-0">
        <NotesView
          {...notesProps}
          notes={notes}
          workspaceId={workspaceId}
          onCreateNote={onCreateNote}
          shellMode="detail-only"
        />
      </div>

      <ApproveFileModal
        file={approveTarget}
        isOpen={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        workspaceTags={workspaceTags}
        remainingInQueue={pendingFiles.length}
        onApprove={handleApprove}
      />
    </div>
  );
}