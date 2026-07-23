import { describe, it, expect } from "vitest";
import {
  mapNoteListRow,
  isNoteBodyHydrated,
  mergeHydratedNote,
  mergeNoteListProjection,
  noteListSearchHaystack,
} from "@/lib/files/noteListProjection";
import type { Note } from "@/types";

describe("noteListProjection", () => {
  const listRow = {
    id: "n1",
    workspace_id: "ws1",
    title: "Invoice",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    tags: ["finance"],
    linked_task_ids: ["t1"],
    linked_note_ids: null,
    parent_note_id: null,
    sort_order: null,
    search_plain: "amount due",
    email_source: null,
    email_pipeline_version: null,
    review_status: "filed",
    record_type: "receipt",
    memo: "Q1",
    filed_at: "2026-01-02T00:00:00Z",
    reviewed_by: null,
    search_document: "Invoice amount due",
    is_archived: false,
  };

  it("mapNoteListRow returns lightweight note without body", () => {
    const note = mapNoteListRow(listRow);
    expect(note.content).toBe("");
    expect(note.bodyHydrated).toBe(false);
    expect(note.title).toBe("Invoice");
    expect(note.linkedTaskIds).toEqual(["t1"]);
    expect(note.reviewStatus).toBe("filed");
  });

  it("isNoteBodyHydrated respects explicit flag and content", () => {
    expect(isNoteBodyHydrated({ ...mapNoteListRow(listRow) })).toBe(false);
    expect(
      isNoteBodyHydrated({
        ...mapNoteListRow(listRow),
        bodyHydrated: true,
      }),
    ).toBe(true);
    expect(
      isNoteBodyHydrated({
        ...mapNoteListRow(listRow),
        content: '{"type":"doc","content":[]}',
      }),
    ).toBe(true);
  });

  it("mergeHydratedNote preserves list fields and marks hydrated", () => {
    const listNote = mapNoteListRow(listRow);
    const full: Note = {
      ...listNote,
      content: '{"type":"doc","content":[]}',
      rawHtml: "<p>hi</p>",
      bodyHydrated: true,
    };
    const merged = mergeHydratedNote(listNote, full);
    expect(merged.bodyHydrated).toBe(true);
    expect(merged.content).toContain("doc");
    expect(merged.rawHtml).toBe("<p>hi</p>");
    expect(merged.memo).toBe("Q1");
  });

  it("mergeNoteListProjection keeps local body when sync returns a stub", () => {
    const listNote = mapNoteListRow({ ...listRow, title: "Renamed" });
    const hydrated: Note = {
      ...mapNoteListRow(listRow),
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      rawHtml: "<p>kept</p>",
      bodyHydrated: true,
    };
    const merged = mergeNoteListProjection(hydrated, listNote);
    expect(merged.title).toBe("Renamed");
    expect(merged.content).toContain("paragraph");
    expect(merged.rawHtml).toBe("<p>kept</p>");
    expect(merged.bodyHydrated).toBe(true);
  });

  it("noteListSearchHaystack uses metadata only", () => {
    const note = mapNoteListRow(listRow);
    expect(noteListSearchHaystack(note)).toContain("invoice");
    expect(noteListSearchHaystack(note)).toContain("amount due");
  });
});