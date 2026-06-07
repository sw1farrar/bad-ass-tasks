import { describe, it, expect } from "vitest";
import { mapRealtimeNoteRow, mergeRealtimeNoteUpdate } from "@/lib/notes/mapRealtimeNoteRow";

describe("mapRealtimeNoteRow", () => {
  it("maps parent_note_id and JSONB content from realtime insert", () => {
    const row = {
      id: "note-1",
      workspace_id: "ws-1",
      title: "Email subject",
      parent_note_id: "parent-1",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] },
      created_at: "2026-06-07T00:00:00Z",
      updated_at: "2026-06-07T00:00:00Z",
      tags: ["from-email"],
      linked_task_ids: [],
      linked_note_ids: [],
    };

    const mapped = mapRealtimeNoteRow(row);
    expect(mapped.parentNoteId).toBe("parent-1");
    expect(mapped.content).toContain("Hello");
  });

  it("merges content on update payloads", () => {
    const existing = mapRealtimeNoteRow({
      id: "note-1",
      workspace_id: "ws-1",
      title: "Old",
      parent_note_id: "parent-1",
      content: { type: "doc", content: [{ type: "paragraph" }] },
      created_at: "2026-06-07T00:00:00Z",
      updated_at: "2026-06-07T00:00:00Z",
      tags: [],
      linked_task_ids: [],
    });

    const merged = mergeRealtimeNoteUpdate(existing, {
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Updated body" }] }],
      },
      updated_at: "2026-06-07T01:00:00Z",
    });

    expect(merged.content).toContain("Updated body");
    expect(merged.parentNoteId).toBe("parent-1");
  });
});