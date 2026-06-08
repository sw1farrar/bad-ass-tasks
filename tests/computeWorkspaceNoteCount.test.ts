import { describe, expect, it } from "vitest";
import type { Note } from "@/types";
import { computeWorkspaceNoteCount } from "@/features/home/lib/computeWorkspaceNoteCount";

function note(id: string, workspaceId: string): Note {
  return {
    id,
    title: id,
    content: "",
    workspaceId,
    createdAt: "",
    updatedAt: "",
    tags: [],
    linkedTaskIds: [],
  };
}

describe("computeWorkspaceNoteCount", () => {
  it("counts only notes in the requested workspace", () => {
    const notes = [note("a", "ws-1"), note("b", "ws-1"), note("c", "ws-2")];
    expect(computeWorkspaceNoteCount(notes, "ws-1")).toBe(2);
    expect(computeWorkspaceNoteCount(notes, "ws-2")).toBe(1);
    expect(computeWorkspaceNoteCount(notes, "ws-3")).toBe(0);
  });
});