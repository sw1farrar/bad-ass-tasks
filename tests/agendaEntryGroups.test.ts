import { describe, expect, it } from "vitest";
import {
  appendAgendaEntryGroupsPlainText,
  buildAgendaEntryGroupsClipboardHtml,
  buildAgendaEntryGroupsDocumentHtml,
  buildAgendaEntryGroupsSummaryHtml,
  groupAgendaEntriesByDate,
} from "@/lib/meetings/agendaEntryGroups";
import type { MeetingAgendaEntry } from "@/types";

const entries: MeetingAgendaEntry[] = [
  {
    id: "e1",
    agendaItemId: "a1",
    body: "Older June note",
    createdAt: "2026-06-23T10:00:00Z",
  },
  {
    id: "e2",
    agendaItemId: "a1",
    body: "Newer June note",
    createdAt: "2026-06-23T18:00:00Z",
  },
  {
    id: "e3",
    agendaItemId: "a1",
    body: "July note",
    createdAt: "2026-07-01T12:00:00Z",
  },
];

describe("agendaEntryGroups", () => {
  it("groups notes by date with newest dates and notes first", () => {
    const groups = groupAgendaEntriesByDate(entries);
    expect(groups.map((group) => group.dateLabel)).toEqual([
      "July 1, 2026",
      "June 23, 2026",
    ]);
    expect(groups[0].entries.map((entry) => entry.id)).toEqual(["e3"]);
    expect(groups[1].entries.map((entry) => entry.id)).toEqual(["e2", "e1"]);
  });

  it("renders date sections for PDF and Word output", () => {
    const html = buildAgendaEntryGroupsDocumentHtml(entries, (text) => text);
    const clipboard = buildAgendaEntryGroupsClipboardHtml(entries, (text) => text);
    const summary = buildAgendaEntryGroupsSummaryHtml(entries, (text) => text);

    expect(html).toContain('class="meeting-agenda-doc__comment-date-heading"');
    expect(html).toContain("July 1, 2026");
    expect(html).toContain("June 23, 2026");
    expect(html.indexOf("July note")).toBeLessThan(html.indexOf("Newer June note"));
    expect(html).not.toContain("meeting-agenda-doc__comment-meta");

    expect(clipboard).toContain("July 1, 2026");
    expect(clipboard).toContain("Newer June note");
    expect(clipboard.indexOf("July note")).toBeLessThan(clipboard.indexOf("Older June note"));

    expect(summary).toContain('class="meeting-summary-doc__note-date-heading"');
    expect(summary).toContain("July 1, 2026");
    expect(summary.indexOf("July note")).toBeLessThan(summary.indexOf("Older June note"));
  });

  it("formats grouped notes in plain text copy", () => {
    const lines: string[] = [];
    appendAgendaEntryGroupsPlainText(lines, entries);
    expect(lines).toEqual([
      "   July 1, 2026",
      "     July note",
      "",
      "   June 23, 2026",
      "     Newer June note",
      "",
      "     Older June note",
    ]);
  });
});