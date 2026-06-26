import { describe, expect, it } from "vitest";
import {
  buildMeetingSummaryClipboardHtml,
  buildMeetingSummaryPlainText,
} from "@/lib/meetings/summaryClipboard";
import type { Meeting, MeetingAgendaEntry, MeetingAgendaItem } from "@/types";

const meeting: Meeting = {
  id: "m1",
  workspaceId: "w1",
  title: "Sprint Review",
  status: "completed",
  scheduledAt: "2026-06-23T14:00:00Z",
  attendeeIds: [],
  sortOrder: 0,
  createdAt: "2026-06-23T12:00:00Z",
  updatedAt: "2026-06-23T15:00:00Z",
};

const items: MeetingAgendaItem[] = [
  {
    id: "a1",
    meetingId: "m1",
    title: "Demos",
    sortOrder: 0,
    status: "completed",
    linkedTaskIds: [],
    createdAt: "2026-06-23T12:00:00Z",
    updatedAt: "2026-06-23T14:30:00Z",
  },
  {
    id: "a2",
    meetingId: "m1",
    title: "Roadmap",
    sortOrder: 1,
    status: "continued",
    linkedTaskIds: [],
    createdAt: "2026-06-23T12:00:00Z",
    updatedAt: "2026-06-23T14:30:00Z",
  },
];

const entries: MeetingAgendaEntry[] = [
  {
    id: "e1",
    agendaItemId: "a1",
    body: "#decision Ship v2 Friday",
    isDecision: true,
    createdAt: "2026-06-23T14:15:00Z",
  },
  {
    id: "e2",
    agendaItemId: "a1",
    body: "Demo went well",
    createdAt: "2026-06-23T14:10:00Z",
  },
  {
    id: "e3",
    agendaItemId: "a2",
    body: "Need more stakeholder input",
    createdAt: "2026-06-23T14:20:00Z",
  },
];

describe("summaryClipboard", () => {
  it("builds inline HTML suitable for email paste", () => {
    const html = buildMeetingSummaryClipboardHtml({
      meeting,
      items,
      entries,
      members: [],
    });
    expect(html).toContain("Sprint Review");
    expect(html).toContain("Meeting summary");
    expect(html).toContain("Decisions");
    expect(html).toContain("Ship v2 Friday");
    expect(html).toContain("Demo went well");
    expect(html).toContain("Follow-ups for next time");
    expect(html).toContain("Roadmap");
    expect(html).toContain("Need more stakeholder input");
    expect(html).toContain("June 23, 2026");
    expect(html.indexOf("Demo went well")).toBeLessThan(html.indexOf("Need more stakeholder input"));
    expect(html).toContain('style="');
  });

  it("builds plain text fallback", () => {
    const plain = buildMeetingSummaryPlainText({
      meeting,
      items,
      entries,
      members: [],
    });
    expect(plain).toContain("Sprint Review");
    expect(plain).toContain("MEETING SUMMARY");
    expect(plain).toContain("Ship v2 Friday");
    expect(plain).toContain("Demo went well");
    expect(plain).toContain("FOLLOW-UPS FOR NEXT TIME");
    expect(plain).toContain("Roadmap");
    expect(plain).toContain("Need more stakeholder input");
    expect(plain).toContain("June 23, 2026");
  });
});