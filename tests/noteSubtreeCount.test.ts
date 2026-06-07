import { describe, expect, it } from "vitest";
import {
  buildNoteSubtreeCounts,
  getNoteSubtreeCount,
} from "@/features/notes/lib/noteSubtreeCount";

describe("noteSubtreeCount", () => {
  const notes = [
    { id: "root", parentNoteId: null },
    { id: "child-a", parentNoteId: "root" },
    { id: "child-b", parentNoteId: "root" },
    { id: "grandchild", parentNoteId: "child-a" },
    { id: "solo", parentNoteId: null },
  ];

  it("counts the full subtree including the parent note", () => {
    const counts = buildNoteSubtreeCounts(notes);

    expect(counts.get("root")).toBe(4);
    expect(counts.get("child-a")).toBe(2);
    expect(counts.get("child-b")).toBe(1);
    expect(counts.get("grandchild")).toBe(1);
    expect(counts.get("solo")).toBe(1);
  });

  it("returns 1 for unknown notes", () => {
    expect(getNoteSubtreeCount("missing", notes)).toBe(1);
  });

  it("reuses a precomputed map", () => {
    const counts = buildNoteSubtreeCounts(notes);
    expect(getNoteSubtreeCount("root", notes, counts)).toBe(4);
  });
});