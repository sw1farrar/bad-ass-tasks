import { describe, it, expect } from "vitest";
import { buildNoteAttachmentFileUrl } from "@/lib/notes/attachmentUrls";

describe("attachmentUrls", () => {
  it("builds stable same-origin attachment file URLs", () => {
    expect(buildNoteAttachmentFileUrl("note-1", "att-2")).toBe(
      "/api/notes/note-1/attachments/att-2",
    );
  });
});