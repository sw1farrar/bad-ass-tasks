import { describe, it, expect } from "vitest";
import {
  filterPendingReview,
  filterFiledNotes,
  filterByAllTags,
  collectWorkspaceTags,
  countPendingReviewForWorkspace,
  hasUserFilingTags,
} from "@/lib/files/fileFilters";
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
    recordType: partial.recordType,
    memo: partial.memo,
    filedAt: partial.filedAt,
  };
}

describe("fileFilters", () => {
  it("splits pending review from filed notes", () => {
    const notes = [
      note({ id: "1", reviewStatus: "pending_review" }),
      note({ id: "2", reviewStatus: "filed" }),
      note({ id: "3" }),
    ];
    expect(filterPendingReview(notes).map((n) => n.id)).toEqual(["1"]);
    expect(filterFiledNotes(notes).map((n) => n.id)).toEqual(["2", "3"]);
  });

  it("filters by all selected tags (AND)", () => {
    const notes = [
      note({ id: "1", tags: ["receipt", "acme"] }),
      note({ id: "2", tags: ["receipt"] }),
      note({ id: "3", tags: ["acme"] }),
    ];
    expect(filterByAllTags(notes, ["receipt", "acme"]).map((n) => n.id)).toEqual(["1"]);
    expect(filterByAllTags(notes, ["receipt"]).map((n) => n.id)).toEqual(["1", "2"]);
  });

  it("hasUserFilingTags requires a user tag (not from-email alone)", () => {
    expect(hasUserFilingTags([])).toBe(false);
    expect(hasUserFilingTags(["from-email"])).toBe(false);
    expect(hasUserFilingTags(["receipt"])).toBe(true);
    expect(hasUserFilingTags(["from-email", "acme"])).toBe(true);
  });

  it("counts pending review per workspace", () => {
    const notes = [
      note({ id: "1", workspaceId: "ws-a", reviewStatus: "pending_review" }),
      note({ id: "2", workspaceId: "ws-a", reviewStatus: "filed" }),
      note({ id: "3", workspaceId: "ws-b", reviewStatus: "pending_review" }),
    ];
    expect(countPendingReviewForWorkspace(notes, "ws-a")).toBe(1);
    expect(countPendingReviewForWorkspace(notes, "ws-b")).toBe(1);
    expect(countPendingReviewForWorkspace(notes, "ws-c")).toBe(0);
  });

  it("collects user tags excluding from-email", () => {
    const tags = collectWorkspaceTags([
      note({ id: "1", tags: ["receipt", "from-email"] }),
      note({ id: "2", tags: ["acme"] }),
    ]);
    expect(tags).toEqual(["acme", "receipt"]);
  });
});