import { describe, it, expect } from "vitest";
import { searchFilesInWorkspace } from "@/lib/files/searchFilesInWorkspace";
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
    workspaceId: "ws-1",
    reviewStatus: partial.reviewStatus,
    memo: partial.memo,
  };
}

describe("searchFilesInWorkspace", () => {
  const notes = [
    note({ id: "1", title: "Acme receipt", reviewStatus: "pending_review", memo: "vendor" }),
    note({ id: "2", title: "Acme contract", reviewStatus: "filed", memo: "signed" }),
    note({ id: "3", title: "Other", reviewStatus: "filed" }),
  ];

  it("scopes review vs filed results", () => {
    expect(searchFilesInWorkspace(notes, "acme", { scope: "review" }).map((n) => n.id)).toEqual([
      "1",
    ]);
    expect(searchFilesInWorkspace(notes, "acme", { scope: "filed" }).map((n) => n.id)).toEqual([
      "2",
    ]);
  });
});