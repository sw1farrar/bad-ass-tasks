import { describe, expect, it } from "vitest";
import {
  buildMeetingAgendaPrintDocument,
  buildMeetingAgendaPreviewDocument,
  LETTER_PAGE_WIDTH_PT,
  MEETING_AGENDA_PRINT_WIDTH_PX,
} from "@/lib/meetings/agendaPrintDocument";

describe("agendaPrintDocument", () => {
  it("wraps agenda HTML in a self-contained print document", () => {
    const doc = buildMeetingAgendaPrintDocument(
      '<article class="meeting-agenda-doc"><h1>Sync</h1></article>',
      "Weekly Sync",
    );
    expect(doc).toContain("<!DOCTYPE html>");
    expect(doc).toContain("meeting-agenda-doc__list");
    expect(doc).toContain("Weekly Sync — Agenda");
    expect(doc).toContain("<h1>Sync</h1>");
    expect(doc).toContain("meeting-print-page");
    expect(doc).toContain("padding: 32px 40px");
  });

  it("uses letter-width capture pixels at 96dpi", () => {
    expect(MEETING_AGENDA_PRINT_WIDTH_PX).toBe(Math.round(LETTER_PAGE_WIDTH_PT * (96 / 72)));
  });

  it("uses identical markup for preview and PDF generation", () => {
    const html = '<article class="meeting-agenda-doc"><h1>Sync</h1></article>';
    expect(buildMeetingAgendaPreviewDocument(html, "Weekly Sync")).toBe(
      buildMeetingAgendaPrintDocument(html, "Weekly Sync"),
    );
  });

  it("includes rich note-body styles for PDF preview and download", () => {
    const doc = buildMeetingAgendaPrintDocument(
      '<article class="meeting-agenda-doc"><div class="meeting-agenda-doc__comment-body"><strong>Bold</strong><ul><li>Item</li></ul></div></article>',
      "Weekly Sync",
    );
    expect(doc).toContain(".meeting-agenda-doc__comment-body strong");
    expect(doc).toContain("list-style-type: disc");
    expect(doc).toContain(".meeting-agenda-doc__comment-body ul");
    expect(doc).toContain(".meeting-agenda-doc__comment-body table");
    expect(doc).toContain(".meeting-agenda-doc__comment-body {\n    margin: 0;\n    font-size: 9pt;\n    color: #000000;\n    white-space: normal;");
  });
});