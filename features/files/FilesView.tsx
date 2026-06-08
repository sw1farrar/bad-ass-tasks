"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { NotesView } from "@/features/notes/NotesView";
import type { Note, Task, FileRecordType } from "@/types";
import { apiFetch } from "@/lib/api/apiFetch";
import {
  collectWorkspaceTags,
  filterByTags,
  filterFiledNotes,
  filterPendingReview,
  sortFiledNotes,
} from "@/lib/files/fileFilters";
import { TagRail, type FilesBrowseFilter } from "./components/TagRail";
import { FileStream } from "./components/FileStream";
import { ReviewPanel } from "./components/ReviewPanel";
import { ApproveFileModal } from "./components/ApproveFileModal";
import { useNoteAttachmentCounts } from "@/features/notes/hooks";
import "./files-workspace.css";

type FilesViewProps = React.ComponentProps<typeof NotesView> & {
  onApproveFile: (
    id: string,
    input: { title: string; tags: string[]; memo: string; recordType: FileRecordType },
  ) => Promise<void>;
};

export function FilesView({
  onApproveFile,
  workspaceId,
  notes,
  onCreateNote,
  ...notesProps
}: FilesViewProps) {
  const pendingFiles = useMemo(() => sortFiledNotes(filterPendingReview(notes)), [notes]);
  const filedFiles = useMemo(() => sortFiledNotes(filterFiledNotes(notes)), [notes]);
  const workspaceTags = useMemo(() => collectWorkspaceTags(filedFiles), [filedFiles]);

  const [filter, setFilter] = useState<FilesBrowseFilter>({ kind: "all" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResultIds, setSearchResultIds] = useState<string[] | null>(null);
  const [approveTarget, setApproveTarget] = useState<Note | null>(null);

  const { counts: attachmentCounts } = useNoteAttachmentCounts(workspaceId);

  useEffect(() => {
    if (pendingFiles.length > 0 && filter.kind === "all") {
      setFilter({ kind: "review" });
    }
  }, [pendingFiles.length, filter.kind]);

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
    } else if (filter.kind === "tag") {
      list = filterByTags(list, [filter.tag]);
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
          const lower = q.toLowerCase();
          const ids = notes
            .filter((n) => {
              const hay = [n.title, n.searchPlain, n.searchDocument, n.memo, ...(n.tags ?? [])]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
              return hay.includes(lower);
            })
            .map((n) => n.id);
          setSearchResultIds(ids);
        })
        .finally(() => setSearching(false));
    }, 300);

    return () => window.clearTimeout(handle);
  }, [searchQuery, workspaceId, notes, filter.kind]);

  const handleApprove = useCallback(
    async (input: {
      title: string;
      tags: string[];
      memo: string;
      recordType: FileRecordType;
    }) => {
      if (!approveTarget) return;
      await onApproveFile(approveTarget.id, input);
      setApproveTarget(null);
      if (filter.kind === "review" && pendingFiles.length <= 1) {
        setFilter({ kind: "all" });
      }
    },
    [approveTarget, onApproveFile, filter.kind, pendingFiles.length],
  );

  const listTitle =
    filter.kind === "review"
      ? "Review"
      : searchQuery.trim()
        ? "Search results"
        : filter.kind === "tag"
          ? filter.tag
          : filter.kind === "untagged"
            ? "Untagged"
            : "All filed";

  return (
    <div className="files-root flex h-full min-h-0 overflow-hidden">
      <TagRail
        filter={filter}
        onFilterChange={(f) => {
          setFilter(f);
          setSearchQuery("");
          setSearchResultIds(null);
        }}
        tags={workspaceTags}
        reviewCount={pendingFiles.length}
        onNewFile={() => void onCreateNote?.()}
        isCreating={false}
      />

      <div className="files-list-column w-64 sm:w-72 shrink-0 flex flex-col min-h-0 border-r border-white/10 bg-[#0a0a0a]">
        <div className="p-3 border-b border-white/10 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-[#71717a] px-1">
            {listTitle}
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

        {filter.kind === "review" ? (
          <ReviewPanel
            files={streamedFiles}
            selectedId={notesProps.selectedNoteId}
            onSelect={(id) => notesProps.onSelectNote(id)}
            onApprove={(id) => {
              const file = notes.find((n) => n.id === id);
              if (file) setApproveTarget(file);
            }}
            attachmentCounts={attachmentCounts}
          />
        ) : (
          <FileStream
            files={streamedFiles}
            selectedId={notesProps.selectedNoteId}
            onSelect={(id) => notesProps.onSelectNote(id)}
            attachmentCounts={attachmentCounts}
            emptyMessage={
              searchQuery.trim()
                ? "No files match your search."
                : "No filed files in this drawer yet."
            }
          />
        )}
      </div>

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
        onApprove={handleApprove}
      />
    </div>
  );
}