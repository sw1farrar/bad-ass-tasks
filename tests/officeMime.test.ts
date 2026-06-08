import { describe, expect, it } from "vitest";
import {
  isDocxPreviewable,
  isLegacyWordDoc,
  isWordFile,
  isXlsxPreviewable,
  resolvePreviewMimeType,
} from "@/lib/preview/officeMime";

describe("officeMime", () => {
  it("infers docx mime from extension when storage type is octet-stream", () => {
    expect(
      resolvePreviewMimeType("application/octet-stream", "Quarterly-Report.docx"),
    ).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("detects legacy .doc files separately from .docx", () => {
    expect(isLegacyWordDoc("application/msword", "Budget.doc")).toBe(true);
    expect(isLegacyWordDoc("application/octet-stream", "Budget.doc")).toBe(true);
    expect(isLegacyWordDoc("application/octet-stream", "Budget.docx")).toBe(false);
  });

  it("marks only modern Word files as docx-previewable", () => {
    expect(isDocxPreviewable("application/octet-stream", "Notes.docx")).toBe(true);
    expect(isDocxPreviewable("application/msword", "Notes.doc")).toBe(false);
    expect(
      isDocxPreviewable(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "file",
      ),
    ).toBe(true);
  });

  it("groups all Word variants under isWordFile", () => {
    expect(isWordFile("application/msword", "Old.doc")).toBe(true);
    expect(isWordFile("application/octet-stream", "New.docx")).toBe(true);
  });

  it("detects Excel previews from mime or extension", () => {
    expect(isXlsxPreviewable("application/octet-stream", "Sheet.xlsx")).toBe(true);
    expect(isXlsxPreviewable("application/vnd.ms-excel", "Sheet.xls")).toBe(true);
  });
});