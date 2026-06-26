import { describe, expect, it } from "vitest";
import {
  buildMeetingAgendaClipboardHtml,
  buildMeetingAgendaPlainText,
} from "@/lib/meetings/agendaClipboard";
import type { Meeting, MeetingAgendaEntry, MeetingAgendaItem } from "@/types";

const meeting: Meeting = {
  id: "m1",
  workspaceId: "w1",
  title: "Weekly Sync",
  status: "scheduled",
  scheduledAt: "2026-06-23T12:00:00Z",
  attendeeIds: [],
  sortOrder: 0,
  createdAt: "2026-06-23T12:00:00Z",
  updatedAt: "2026-06-23T12:00:00Z",
};

const entries: MeetingAgendaEntry[] = [
  {
    id: "e1",
    agendaItemId: "a1",
    body: "Need updated forecast",
    createdAt: "2026-06-23T13:00:00Z",
  },
  {
    id: "e2",
    agendaItemId: "a1",
    body: "Latest blocker",
    createdAt: "2026-06-23T14:00:00Z",
  },
];

const items: MeetingAgendaItem[] = [
  {
    id: "a1",
    meetingId: "m1",
    title: "Budget",
    description: "Review Q3 numbers",
    sortOrder: 0,
    status: "open",
    linkedTaskIds: [],
    timeBudgetMinutes: 15,
    createdAt: "2026-06-23T12:00:00Z",
    updatedAt: "2026-06-23T12:00:00Z",
  },
];

describe("agendaClipboard", () => {
  it("builds inline HTML suitable for email paste", () => {
    const html = buildMeetingAgendaClipboardHtml({ meeting, items, members: [] });
    expect(html).toContain("Weekly Sync");
    expect(html).toContain("Budget");
    expect(html).toContain("Review Q3 numbers");
    expect(html).toContain('style="');
    expect(html).not.toContain("#7c3aed");
  });

  it("builds plain text fallback", () => {
    const plain = buildMeetingAgendaPlainText({ meeting, items, members: [] });
    expect(plain).toContain("Weekly Sync");
    expect(plain).toContain("1. Budget");
    expect(plain).not.toContain("15 min");
    expect(plain).toContain("Review Q3 numbers");
  });

  it("includes comments below agenda items when requested", () => {
    const html = buildMeetingAgendaClipboardHtml({
      meeting,
      items,
      entries,
      members: [],
      includeComments: true,
    });
    const plain = buildMeetingAgendaPlainText({
      meeting,
      items,
      entries,
      members: [],
      includeComments: true,
    });
    expect(html).toContain("Need updated forecast");
    expect(plain).toContain("Need updated forecast");
    expect(html.indexOf("Latest blocker")).toBeLessThan(html.indexOf("Need updated forecast"));
    expect(plain.indexOf("Latest blocker")).toBeLessThan(plain.indexOf("Need updated forecast"));
    expect(html).toMatch(/Need updated forecast<\/span><br \/>/);
    expect(plain).toMatch(/Need updated forecast\n {3}Jun 23, 2026/);
  });
});