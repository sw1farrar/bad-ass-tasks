import { describe, expect, it } from "vitest";
import { noteUpdatesAreNoOp } from "@/lib/notes/noteUpdates";
import type { Note } from "@/types";

function note(partial: Partial<Note> & { id: string }): Note {
  const { id, title, ...rest } = partial;
  return {
    id,
    title: title ?? "Test",
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    tags: [],
    linkedTaskIds: [],
    workspaceId: "ws-1",
    reviewStatus: "filed",
    ...rest,
  };
}

describe("noteUpdatesAreNoOp", () => {
  it("returns true when title is unchanged", () => {
    const existing = note({ id: "n1", title: "Hello" });
    expect(noteUpdatesAreNoOp(existing, { title: "Hello" })).toBe(true);
  });

  it("returns false when title changes", () => {
    const existing = note({ id: "n1", title: "Hello" });
    expect(noteUpdatesAreNoOp(existing, { title: "World" })).toBe(false);
  });

  it("returns false when note is missing", () => {
    expect(noteUpdatesAreNoOp(undefined, { title: "Hello" })).toBe(false);
  });
});