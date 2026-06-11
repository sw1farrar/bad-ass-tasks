import { describe, expect, it } from "vitest";
import {
  detectWordDocumentFormat,
  isOleCompoundFile,
  isZipArchive,
  legacyWordBodyToParagraphs,
} from "@/lib/preview/legacyWordDocShared";
import { buildNoteAttachmentPreviewUrl } from "@/lib/notes/attachmentUrls";

describe("extractLegacyWordDoc helpers", () => {
  it("detects OLE compound file header", () => {
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x00]);
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    expect(isOleCompoundFile(ole)).toBe(true);
    expect(isOleCompoundFile(zip)).toBe(false);
  });

  it("detects zip archives and chooses the correct Word preview format", () => {
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x00]);
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    expect(isZipArchive(zip)).toBe(true);
    expect(isZipArchive(ole)).toBe(false);
    expect(detectWordDocumentFormat(zip)).toBe("docx");
    expect(detectWordDocumentFormat(ole)).toBe("legacy-doc");
    expect(detectWordDocumentFormat(Buffer.from([0x00, 0x11, 0x22, 0x33]))).toBe("unknown");
  });

  it("splits legacy Word body text into paragraphs", () => {
    expect(legacyWordBodyToParagraphs("First paragraph.\n\nSecond paragraph.")).toEqual([
      "First paragraph.",
      "Second paragraph.",
    ]);
    expect(legacyWordBodyToParagraphs("  \n\n  ")).toEqual([]);
  });

  it("builds preview URL for legacy doc attachments", () => {
    expect(buildNoteAttachmentPreviewUrl("note-1", "att-9")).toBe(
      "/api/notes/note-1/attachments/att-9/preview",
    );
  });
});