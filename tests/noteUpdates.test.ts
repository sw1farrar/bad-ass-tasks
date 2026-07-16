import { describe, expect, it } from "vitest";
import {
  isEmptyNoteContent,
  noteContentEquivalent,
  noteUpdatesAreNoOp,
} from "@/lib/notes/noteUpdates";
import type { Note } from "@/types";

const EMPTY_DOC = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

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

  it("treats empty string and empty TipTap doc as unchanged content", () => {
    const existing = note({ id: "n1", content: "" });
    expect(noteUpdatesAreNoOp(existing, { content: EMPTY_DOC })).toBe(true);
  });

  it("returns false when content actually changes", () => {
    const existing = note({ id: "n1", content: EMPTY_DOC });
    const next = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    });
    expect(noteUpdatesAreNoOp(existing, { content: next })).toBe(false);
  });
});

describe("noteContentEquivalent / isEmptyNoteContent", () => {
  it("detects empty TipTap docs", () => {
    expect(isEmptyNoteContent("")).toBe(true);
    expect(isEmptyNoteContent(EMPTY_DOC)).toBe(true);
    expect(isEmptyNoteContent(JSON.stringify({ type: "doc", content: [] }))).toBe(true);
  });

  it("equates empty representations", () => {
    expect(noteContentEquivalent("", EMPTY_DOC)).toBe(true);
    expect(noteContentEquivalent(EMPTY_DOC, EMPTY_DOC)).toBe(true);
  });

  it("equates TipTap docs that only differ by key order / null attrs", () => {
    const a = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: null },
          content: [{ type: "text", text: "hello" }],
        },
      ],
    });
    const b = JSON.stringify({
      content: [
        {
          content: [{ text: "hello", type: "text" }],
          type: "paragraph",
        },
      ],
      type: "doc",
    });
    expect(noteContentEquivalent(a, b)).toBe(true);
  });
});