import { describe, expect, it } from "vitest";
import {
  filterFileNotes,
  filterNotebookNotes,
  filterNotebookNotesBySearch,
  isFileNote,
} from "@/lib/notebooks/notebookFilters";
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

describe("notebookFilters", () => {
  it("excludes notebook notes from file notes", () => {
    const notes = [
      note({ id: "f1" }),
      note({ id: "n1", notebookId: "nb-1" }),
    ];
    expect(isFileNote(notes[1]!)).toBe(false);
    expect(filterFileNotes(notes).map((n) => n.id)).toEqual(["f1"]);
  });

  it("filters notes by notebook id", () => {
    const notes = [
      note({ id: "n1", notebookId: "nb-1" }),
      note({ id: "n2", notebookId: "nb-2" }),
    ];
    expect(filterNotebookNotes(notes, "nb-1").map((n) => n.id)).toEqual(["n1"]);
  });

  it("searches notebook notes by title", () => {
    const notes = [
      note({ id: "n1", notebookId: "nb-1", title: "Meeting notes" }),
      note({ id: "n2", notebookId: "nb-1", title: "Groceries" }),
    ];
    expect(filterNotebookNotesBySearch(notes, "meeting").map((n) => n.id)).toEqual(["n1"]);
    expect(filterNotebookNotesBySearch(notes, "").map((n) => n.id)).toEqual(["n1", "n2"]);
  });
});