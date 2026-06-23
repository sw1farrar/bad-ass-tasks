import { describe, expect, it } from "vitest";
import { buildMeetingSummaryHtml, buildMeetingAgendaHtml } from "@/lib/meetings/summaryBuilder";
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
];

const entries: MeetingAgendaEntry[] = [
  {
    id: "e1",
    agendaItemId: "a1",
    body: "#decision Ship v2 Friday",
    isDecision: true,
    createdAt: "2026-06-23T14:15:00Z",
  },
];

describe("summaryBuilder", () => {
  it("renders summary html with decisions section", () => {
    const html = buildMeetingSummaryHtml({
      meeting,
      items,
      entries,
      members: [],
      workspaceName: "Acme",
    });
    expect(html).toContain("Sprint Review");
    expect(html).toContain("Decisions");
    expect(html).toContain("Ship v2 Friday");
  });

  it("renders agenda html with topics", () => {
    const html = buildMeetingAgendaHtml({
      meeting,
      items,
      members: [],
    });
    expect(html).toContain("Demos");
    expect(html).toContain("meeting-agenda-doc");
  });
});