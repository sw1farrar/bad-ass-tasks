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

  it("prefers .docx extension over misleading application/msword MIME", () => {
    expect(resolvePreviewMimeType("application/msword", "Quarterly-Report.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(isLegacyWordDoc("application/msword", "Quarterly-Report.docx")).toBe(false);
    expect(isDocxPreviewable("application/msword", "Quarterly-Report.docx")).toBe(true);
  });

  it("prefers .docx extension over application/zip MIME", () => {
    expect(resolvePreviewMimeType("application/zip", "Notes.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(isDocxPreviewable("application/zip", "Notes.docx")).toBe(true);
  });

  it("detects legacy .doc files separately from .docx", () => {
    expect(isLegacyWordDoc("application/msword", "Budget.doc")).toBe(true);
    expect(isLegacyWordDoc("application/octet-stream", "Budget.doc")).toBe(true);
    expect(isLegacyWordDoc("application/octet-stream", "Budget.docx")).toBe(false);
    expect(isLegacyWordDoc("application/msword", "Quarterly-Report")).toBe(false);
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
    expect(isWordFile("application/msword", "New.docx")).toBe(true);
    expect(isWordFile("application/msword", "attachment")).toBe(true);
  });

  it("detects Excel previews from mime or extension", () => {
    expect(isXlsxPreviewable("application/octet-stream", "Sheet.xlsx")).toBe(true);
    expect(isXlsxPreviewable("application/vnd.ms-excel", "Sheet.xls")).toBe(true);
  });

  it("strips MIME parameters before matching", () => {
    expect(
      resolvePreviewMimeType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document; charset=binary",
        "memo",
      ),
    ).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(
      isDocxPreviewable(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document; charset=binary",
        "memo",
      ),
    ).toBe(true);
  });
});