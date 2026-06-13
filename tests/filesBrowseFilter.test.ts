import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILES_BROWSE_FILTER,
  listFilesForBrowseFilter,
  setFilesLibrary,
  toggleFilesBookmarksOnly,
} from "@/lib/files/filesBrowseFilter";
import type { Note } from "@/types";

function note(partial: Partial<Note> & { id: string }): Note {
  return {
    id: partial.id,
    title: partial.title ?? "Test",
    content: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: partial.tags ?? [],
    linkedTaskIds: [],
    workspaceId: partial.workspaceId ?? "ws-1",
    reviewStatus: partial.reviewStatus,
    bookmarked: partial.bookmarked,
  };
}

describe("filesBrowseFilter", () => {
  const notes = [
    note({ id: "1", reviewStatus: "pending_review", bookmarked: true }),
    note({ id: "2", reviewStatus: "pending_review" }),
    note({ id: "3", reviewStatus: "filed", bookmarked: true }),
    note({ id: "4", reviewStatus: "filed" }),
  ];

  it("lists review or archive exclusively", () => {
    expect(
      listFilesForBrowseFilter(notes, { ...DEFAULT_FILES_BROWSE_FILTER, library: "review" }).map(
        (n) => n.id,
      ),
    ).toEqual(["1", "2"]);
    expect(
      listFilesForBrowseFilter(notes, { ...DEFAULT_FILES_BROWSE_FILTER, library: "archive" }).map(
        (n) => n.id,
      ),
    ).toEqual(["3", "4"]);
  });

  it("narrows the active library when bookmarksOnly is enabled", () => {
    const reviewBookmarks = listFilesForBrowseFilter(notes, {
      library: "review",
      bookmarksOnly: true,
      tagFilter: { kind: "all" },
    });
    expect(reviewBookmarks.map((n) => n.id)).toEqual(["1"]);

    const archiveBookmarks = listFilesForBrowseFilter(notes, {
      library: "archive",
      bookmarksOnly: true,
      tagFilter: { kind: "all" },
    });
    expect(archiveBookmarks.map((n) => n.id)).toEqual(["3"]);
  });

  it("preserves bookmarksOnly when switching library", () => {
    const next = setFilesLibrary(
      { library: "review", bookmarksOnly: true, tagFilter: { kind: "all" } },
      "archive",
    );
    expect(next.library).toBe("archive");
    expect(next.bookmarksOnly).toBe(true);
  });

  it("toggles bookmarks independently", () => {
    const toggled = toggleFilesBookmarksOnly(DEFAULT_FILES_BROWSE_FILTER);
    expect(toggled.bookmarksOnly).toBe(true);
    expect(toggled.library).toBe("archive");
  });
});