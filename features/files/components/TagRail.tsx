"use client";

import React from "react";
import { Archive, Bookmark, Inbox, Loader2, Plus, Receipt, Search } from "lucide-react";
import {
  getSelectedFilterTags,
  isArchiveLibrary,
  isReviewLibrary,
  isTagFilterDisabled,
  type FilesBrowseFilter,
} from "@/lib/files/filesBrowseFilter";
import { cn } from "@/lib/utils";
import { TagMultiSelect } from "./TagMultiSelect";

export type { FilesBrowseFilter } from "@/lib/files/filesBrowseFilter";

interface TagRailProps {
  filter: FilesBrowseFilter;
  onLibraryChange: (library: "review" | "archive") => void;
  onBookmarksOnlyChange: (bookmarksOnly: boolean) => void;
  onOpenReceiptLedger?: () => void;
  onTagFilterChange: (tags: string[]) => void;
  tags: string[];
  reviewCount: number;
  bookmarkCount?: number;
  onNewFile: () => void;
  isCreating?: boolean;
  isDesktop?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  searching?: boolean;
  listContent?: React.ReactNode;
}

function LibrarySegmentButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
  position,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Inbox;
  label: string;
  badge?: React.ReactNode;
  position: "start" | "end";
}) {
  return (
    <button
      type="button"
      className={cn(
        "files-library-segment__btn",
        "files-library-segment__btn--icon-only",
        position === "start" && "files-library-segment__btn--start",
        position === "end" && "files-library-segment__btn--end",
        active && "files-library-segment__btn--active",
      )}
      onClick={onClick}
      role="radio"
      aria-checked={active}
      aria-label={label}
      title={label}
    >
      <Icon className="files-library-segment__icon h-4 w-4 shrink-0" aria-hidden />
      {badge ? <span className="files-library-segment__badge">{badge}</span> : null}
    </button>
  );
}

function BrowseModeControls({
  filter,
  onLibraryChange,
  onBookmarksOnlyChange,
  onOpenReceiptLedger,
  reviewCount,
  bookmarkCount,
  variant,
}: {
  filter: FilesBrowseFilter;
  onLibraryChange: (library: "review" | "archive") => void;
  onBookmarksOnlyChange: (bookmarksOnly: boolean) => void;
  onOpenReceiptLedger?: () => void;
  reviewCount: number;
  bookmarkCount: number;
  variant: "desktop" | "mobile";
}) {
  const reviewBadge =
    reviewCount > 0 ? (
      <span className="nav-count-badge nav-count-badge--corner">
        {reviewCount > 99 ? "99+" : reviewCount}
      </span>
    ) : undefined;

  const bookmarkBadge =
    bookmarkCount > 0 ? (
      <span className="nav-count-badge nav-count-badge--corner">
        {bookmarkCount > 99 ? "99+" : bookmarkCount}
      </span>
    ) : undefined;

  const libraryLabel = isReviewLibrary(filter) ? "Review" : "Archive";

  return (
    <div
      className={cn(
        "files-browse-mode-row",
        variant === "mobile" && "files-browse-mode-row--mobile",
        filter.bookmarksOnly && "files-browse-mode-row--bookmarks-scoped",
      )}
    >
      <div className="files-library-segment" role="radiogroup" aria-label="Library view">
        <LibrarySegmentButton
          active={isReviewLibrary(filter)}
          onClick={() => onLibraryChange("review")}
          icon={Inbox}
          label="Review"
          badge={reviewBadge}
          position="start"
        />
        <LibrarySegmentButton
          active={isArchiveLibrary(filter)}
          onClick={() => onLibraryChange("archive")}
          icon={Archive}
          label="Archive"
          position="end"
        />
      </div>

      <div className="files-browse-mode-row__divider" aria-hidden />

      {variant === "desktop" && onOpenReceiptLedger ? (
        <button
          type="button"
          className="files-receipt-ledger-btn"
          onClick={onOpenReceiptLedger}
          aria-label="Open receipt items ledger"
          title="Receipt items"
        >
          <Receipt className="h-4 w-4 shrink-0" aria-hidden />
        </button>
      ) : null}

      <button
        type="button"
        className={cn(
          "files-bookmarks-filter-btn",
          filter.bookmarksOnly && "files-bookmarks-filter-btn--active",
        )}
        onClick={() => onBookmarksOnlyChange(!filter.bookmarksOnly)}
        aria-pressed={filter.bookmarksOnly}
        aria-label={
          filter.bookmarksOnly
            ? `Show all ${libraryLabel.toLowerCase()} files`
            : `Filter ${libraryLabel.toLowerCase()} to bookmarks only`
        }
        title={filter.bookmarksOnly ? "Show all files" : "Bookmarks only"}
      >
        <Bookmark
          className={cn("files-bookmarks-filter-btn__icon h-4 w-4", filter.bookmarksOnly && "fill-current")}
          aria-hidden
        />
        {bookmarkBadge ? (
          <span className="files-bookmarks-filter-btn__badge">{bookmarkBadge}</span>
        ) : null}
      </button>
    </div>
  );
}

export function TagRail({
  filter,
  onLibraryChange,
  onBookmarksOnlyChange,
  onOpenReceiptLedger,
  onTagFilterChange,
  tags,
  reviewCount,
  bookmarkCount = 0,
  onNewFile,
  isCreating,
  isDesktop = false,
  searchQuery = "",
  onSearchQueryChange,
  searching = false,
  listContent,
}: TagRailProps) {
  const selectedTags = getSelectedFilterTags(filter);
  const tagFilterDisabled = isTagFilterDisabled(filter);

  if (isDesktop) {
    return (
      <aside
        className="files-browse-panel w-80 xl:w-[22rem] shrink-0 border-r border-border-glass bg-bg flex flex-col min-h-0 gap-3"
        aria-label="Files browse"
      >
        <div className="files-browse-toolbar files-action-bar shrink-0 p-4 border-b border-border-glass space-y-3">
          <button
            type="button"
            onClick={onNewFile}
            disabled={isCreating}
            className="w-full btn btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add File
          </button>

          <BrowseModeControls
            filter={filter}
            onLibraryChange={onLibraryChange}
            onBookmarksOnlyChange={onBookmarksOnlyChange}
            onOpenReceiptLedger={onOpenReceiptLedger}
            reviewCount={reviewCount}
            bookmarkCount={bookmarkCount}
            variant="desktop"
          />

          <TagMultiSelect
            tags={tags}
            selected={selectedTags}
            onChange={onTagFilterChange}
            disabled={tagFilterDisabled}
          />

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange?.(e.target.value)}
              placeholder="Search files…"
              className="w-full bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint"
              aria-label="Search files"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neon-purple" />
            )}
          </div>
        </div>

        <div className="files-browse-list-shell flex-1 min-h-0 flex flex-col">{listContent}</div>
      </aside>
    );
  }

  return (
    <aside className="files-tag-rail w-full min-w-0 max-w-full shrink-0 border-r border-border-glass bg-bg flex flex-col min-h-0">
      <div className="files-tag-rail__new-file p-3 border-b border-border-glass">
        <button
          type="button"
          onClick={onNewFile}
          disabled={isCreating}
          className="w-full btn btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Capture file
        </button>
      </div>

      <nav className="files-mobile-mode-nav flex-1 overflow-y-auto p-2" aria-label="File drawers">
        <BrowseModeControls
          filter={filter}
          onLibraryChange={onLibraryChange}
          onBookmarksOnlyChange={onBookmarksOnlyChange}
          onOpenReceiptLedger={onOpenReceiptLedger}
          reviewCount={reviewCount}
          bookmarkCount={bookmarkCount}
          variant="mobile"
        />
      </nav>
    </aside>
  );
}