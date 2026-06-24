import { describe, expect, it } from "vitest";
import {
  buildMeetingSummaryPrintDocument,
  buildMeetingSummaryPreviewDocument,
} from "@/lib/meetings/summaryPrintDocument";

describe("summaryPrintDocument", () => {
  it("wraps summary HTML in a self-contained print document", () => {
    const doc = buildMeetingSummaryPrintDocument(
      '<article class="meeting-summary-doc"><h1>Sync</h1></article>',
      "Weekly Sync",
    );
    expect(doc).toContain("<!DOCTYPE html>");
    expect(doc).toContain("meeting-summary-doc__title");
    expect(doc).toContain("Weekly Sync — Summary");
    expect(doc).toContain("<h1>Sync</h1>");
    expect(doc).toContain("meeting-print-page");
    expect(doc).toContain("padding: 32px 40px");
  });

  it("uses identical markup for preview and PDF generation", () => {
    const html = '<article class="meeting-summary-doc"><h1>Sync</h1></article>';
    expect(buildMeetingSummaryPreviewDocument(html, "Weekly Sync")).toBe(
      buildMeetingSummaryPrintDocument(html, "Weekly Sync"),
    );
  });
});