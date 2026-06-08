import { describe, it, expect } from "vitest";
import { searchNotesLocal } from "@/lib/files/searchNotesLocal";
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

describe("searchNotesLocal", () => {
  const notes = [
    note({ id: "1", title: "Receipt from Acme", tags: ["receipt"], memo: "office supplies" }),
    note({
      id: "2",
      title: "Q3 strategy",
      reviewStatus: "pending_review",
      searchDocument: "roadmap planning",
    }),
    note({ id: "3", title: "Unrelated", searchPlain: "vacation photos" }),
  ];

  it("returns empty for short queries", () => {
    expect(searchNotesLocal(notes, "a")).toEqual([]);
    expect(searchNotesLocal(notes, "  ")).toEqual([]);
  });

  it("matches title, memo, tags, and searchDocument", () => {
    expect(searchNotesLocal(notes, "acme").map((n) => n.id)).toEqual(["1"]);
    expect(searchNotesLocal(notes, "office").map((n) => n.id)).toEqual(["1"]);
    expect(searchNotesLocal(notes, "receipt").map((n) => n.id)).toEqual(["1"]);
    expect(searchNotesLocal(notes, "roadmap").map((n) => n.id)).toEqual(["2"]);
  });

  it("prioritizes pending review and recency", () => {
    const hits = searchNotesLocal(notes, "q3");
    expect(hits[0]?.id).toBe("2");
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      note({ id: `n-${i}`, title: `shared keyword ${i}` }),
    );
    expect(searchNotesLocal(many, "shared", 5)).toHaveLength(5);
  });
});