import { describe, expect, it } from "vitest";
import {
  buildFilesSearchIndex,
  mergeFilesSearchResultIds,
  rankFilesSearchIds,
  scoreFilesSearchEntry,
  tokenizeFilesSearchQuery,
} from "@/lib/files/filesSearchRank";
import type { Note } from "@/types";

function note(partial: Partial<Note> & { id: string }): Note {
  return {
    id: partial.id,
    title: partial.title ?? "Test",
    content: "",
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-01-02T00:00:00.000Z",
    tags: partial.tags ?? [],
    linkedTaskIds: [],
    workspaceId: "ws-1",
    reviewStatus: partial.reviewStatus,
    searchDocument: partial.searchDocument,
    searchPlain: partial.searchPlain,
    memo: partial.memo,
  };
}

describe("filesSearchRank", () => {
  const notes = [
    note({
      id: "1",
      title: "Receipt from Acme",
      reviewStatus: "pending_review",
      tags: ["receipt"],
      memo: "office supplies",
    }),
    note({
      id: "2",
      title: "Q3 strategy",
      reviewStatus: "pending_review",
      searchDocument: "roadmap planning",
    }),
    note({ id: "3", title: "Unrelated", searchPlain: "vacation photos" }),
    note({ id: "4", title: "Acme contract", reviewStatus: "filed", memo: "signed copy" }),
  ];

  const index = buildFilesSearchIndex(notes);

  it("tokenizes queries", () => {
    expect(tokenizeFilesSearchQuery("  acme   receipt ")).toEqual(["acme", "receipt"]);
  });

  it("ranks title-prefix matches above title-contains matches", () => {
    expect(rankFilesSearchIds(index, "acme", { scope: "all" })[0]).toBe("4");
    expect(rankFilesSearchIds(index, "receipt", { scope: "all" })[0]).toBe("1");
  });

  it("requires every token to match", () => {
    expect(rankFilesSearchIds(index, "acme receipt", { scope: "all" })).toEqual(["1"]);
    expect(rankFilesSearchIds(index, "acme vacation", { scope: "all" })).toEqual([]);
  });

  it("scopes review vs filed", () => {
    expect(rankFilesSearchIds(index, "acme", { scope: "review" })).toEqual(["1"]);
    expect(rankFilesSearchIds(index, "acme", { scope: "filed" })).toEqual(["4"]);
  });

  it("ignores single-character haystack noise", () => {
    expect(rankFilesSearchIds(index, "z", { scope: "all" })).toEqual([]);
    expect(scoreFilesSearchEntry(index[2], ["z"])).toBe(-1);
  });

  it("merges local and remote ids without duplicates", () => {
    expect(mergeFilesSearchResultIds(["1", "2"], ["2", "3"])).toEqual(["1", "2", "3"]);
  });
});