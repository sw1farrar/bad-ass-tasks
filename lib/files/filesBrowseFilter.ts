import type { Note } from "@/types";
import {
  filterBookmarkedFiles,
  filterByAllTags,
  filterPendingReview,
  filterFiledNotes,
  sortFiledNotes,
} from "@/lib/files/fileFilters";

export type FilesTagFilter =
  | { kind: "all" }
  | { kind: "untagged" }
  | { kind: "tags"; tags: string[] };

export type FilesBrowseFilter = {
  /** Review queue vs filed archive — mutually exclusive. */
  library: "review" | "archive";
  /** When true, narrows the current library view to bookmarked files only. */
  bookmarksOnly: boolean;
  tagFilter: FilesTagFilter;
};

export const DEFAULT_FILES_BROWSE_FILTER: FilesBrowseFilter = {
  library: "archive",
  bookmarksOnly: false,
  tagFilter: { kind: "all" },
};

export function getSelectedFilterTags(filter: FilesBrowseFilter): string[] {
  return filter.tagFilter.kind === "tags" ? filter.tagFilter.tags : [];
}

export function isReviewLibrary(filter: FilesBrowseFilter): boolean {
  return filter.library === "review";
}

export function isArchiveLibrary(filter: FilesBrowseFilter): boolean {
  return filter.library === "archive";
}

export function isTagFilterDisabled(filter: FilesBrowseFilter): boolean {
  return filter.library === "review";
}

export function setFilesLibrary(
  filter: FilesBrowseFilter,
  library: "review" | "archive",
): FilesBrowseFilter {
  return {
    ...filter,
    library,
    tagFilter: library === "review" ? { kind: "all" } : filter.tagFilter,
  };
}

export function toggleFilesBookmarksOnly(filter: FilesBrowseFilter): FilesBrowseFilter {
  return { ...filter, bookmarksOnly: !filter.bookmarksOnly };
}

export function setFilesTagFilter(filter: FilesBrowseFilter, tags: string[]): FilesBrowseFilter {
  return {
    ...filter,
    library: "archive",
    tagFilter: tags.length ? { kind: "tags", tags } : { kind: "all" },
  };
}

function applyTagFilter(list: Note[], filter: FilesBrowseFilter): Note[] {
  if (filter.library === "review") return list;

  if (filter.tagFilter.kind === "untagged") {
    return list.filter((n) => (n.tags ?? []).filter((t) => t !== "from-email").length === 0);
  }
  if (filter.tagFilter.kind === "tags") {
    return filterByAllTags(list, filter.tagFilter.tags);
  }
  return list;
}

/** Build the file list for the active browse filter (non-search path). */
export function listFilesForBrowseFilter(
  notes: Note[],
  filter: FilesBrowseFilter,
): Note[] {
  const pending = sortFiledNotes(filterPendingReview(notes));
  const filed = sortFiledNotes(filterFiledNotes(notes));

  let list = filter.library === "review" ? pending : filed;
  list = applyTagFilter(list, filter);
  if (filter.bookmarksOnly) {
    list = filterBookmarkedFiles(list);
  }
  return list;
}

/** Apply browse filter on top of search results. */
export function filterSearchResultsForBrowse(
  results: Note[],
  filter: FilesBrowseFilter,
): Note[] {
  let list = results;

  if (filter.library === "review") {
    list = filterPendingReview(list);
  } else {
    list = filterFiledNotes(list);
    list = applyTagFilter(list, filter);
  }

  if (filter.bookmarksOnly) {
    list = filterBookmarkedFiles(list);
  }

  return list;
}