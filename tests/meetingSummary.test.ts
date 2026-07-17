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
  {
    id: "e2",
    agendaItemId: "a1",
    body: "Follow up with design",
    createdAt: "2026-06-23T14:30:00Z",
  },
];

describe("summaryBuilder", () => {
  it("renders summary html with decisions section", () => {
    const html = buildMeetingSummaryHtml({
      meeting: {
        ...meeting,
        startedAt: "2026-06-23T14:00:00Z",
        completedAt: "2026-06-23T15:00:00Z",
      },
      items,
      entries,
      members: [],
    });
    expect(html).toContain("Sprint Review");
    expect(html).toContain("Meeting summary");
    expect(html).not.toContain("Duration");
    expect(html).not.toContain(" min");
    expect(html).toContain("Decisions");
    expect(html).toContain("Ship v2 Friday");
    expect(html).not.toContain("Acme");
    expect(html).toContain("meeting-summary-doc__topic");
    expect(html).toContain("meeting-summary-doc__note-body");
    expect(html).toContain("meeting-summary-doc__note-date-heading");
    expect(html).toContain("June 23, 2026");
    expect(html).not.toContain("meeting-summary-doc__note-meta");
    expect(html).not.toContain("meeting-summary-doc__description");
    const topicStart = html.indexOf('class="meeting-summary-doc__topic"');
    expect(html.indexOf("Follow up with design", topicStart)).toBeLessThan(
      html.indexOf("Ship v2 Friday", topicStart),
    );
  });

  it("sections summary notes by date with newest notes first", () => {
    const html = buildMeetingSummaryHtml({
      meeting,
      items,
      entries: [
        ...entries,
        {
          id: "e3",
          agendaItemId: "a1",
          body: "July follow-up",
          createdAt: "2026-07-01T12:00:00Z",
        },
      ],
      members: [],
    });
    const topicStart = html.indexOf('class="meeting-summary-doc__topic"');
    const julyIndex = html.indexOf("July 1, 2026", topicStart);
    const juneIndex = html.indexOf("June 23, 2026", julyIndex);
    expect(julyIndex).toBeGreaterThan(topicStart);
    expect(juneIndex).toBeGreaterThan(julyIndex);
    expect(html.indexOf("July follow-up", topicStart)).toBeLessThan(
      html.indexOf("Follow up with design", topicStart),
    );
  });

  it("renders agenda html with topic cards", () => {
    const html = buildMeetingAgendaHtml({
      meeting,
      items,
      members: [],
    });
    expect(html).toContain("Demos");
    expect(html).toContain("meeting-agenda-doc");
    expect(html).toContain("meeting-agenda-doc__list");
    expect(html).toContain("meeting-agenda-doc__item");
    expect(html).not.toContain("assigned");
    expect(html).not.toContain("Unassigned");
    expect(html).not.toContain("meeting-agenda-doc__comments");
    expect(html).not.toContain("meeting-agenda-doc__description");
  });

  it("includes meeting description under the title on summary and agenda", () => {
    const withDescription = {
      ...meeting,
      description: "Q3 planning alignment",
    };
    const summaryHtml = buildMeetingSummaryHtml({
      meeting: withDescription,
      items,
      entries: [],
      members: [],
    });
    expect(summaryHtml).toContain("meeting-summary-doc__description");
    expect(summaryHtml).toContain("Q3 planning alignment");
    expect(summaryHtml.indexOf("Sprint Review")).toBeLessThan(
      summaryHtml.indexOf("Q3 planning alignment"),
    );

    const agendaHtml = buildMeetingAgendaHtml({
      meeting: withDescription,
      items,
      members: [],
    });
    expect(agendaHtml).toContain("meeting-agenda-doc__description");
    expect(agendaHtml).toContain("Q3 planning alignment");
    expect(agendaHtml.indexOf("Sprint Review")).toBeLessThan(
      agendaHtml.indexOf("Q3 planning alignment"),
    );
  });

  it("includes comment timeline below agenda items when requested", () => {
    const html = buildMeetingAgendaHtml({
      meeting,
      items,
      entries,
      members: [],
      includeComments: true,
    });
    expect(html).toContain("meeting-agenda-doc__comments");
    expect(html).toContain("meeting-agenda-doc__comment-date-heading");
    expect(html).toContain("Ship v2 Friday");
    expect(html).not.toContain("meeting-agenda-doc__comment-meta");
    expect(html.indexOf("Follow up with design")).toBeLessThan(html.indexOf("Ship v2 Friday"));
  });

  it("includes full notes for carryover topics", () => {
    const continuedItem: MeetingAgendaItem = {
      id: "a2",
      meetingId: "m1",
      title: "Roadmap",
      description: "Q4 planning",
      sortOrder: 1,
      status: "continued",
      linkedTaskIds: [],
      createdAt: "2026-06-23T12:00:00Z",
      updatedAt: "2026-06-23T14:30:00Z",
    };
    const continuedEntry: MeetingAgendaEntry = {
      id: "e2",
      agendaItemId: "a2",
      body: "Need more stakeholder input",
      createdAt: "2026-06-23T14:20:00Z",
    };
    const html = buildMeetingSummaryHtml({
      meeting,
      items: [...items, continuedItem],
      entries: [...entries, continuedEntry],
      members: [],
    });
    expect(html).toContain("Follow-ups for next time");
    expect(html).toContain("Roadmap");
    expect(html).toContain("Q4 planning");
    expect(html).toContain("Need more stakeholder input");
    expect(html).toContain("meeting-summary-doc__note-body");
    expect(html).toContain('data-outcome="deferred"');
    expect(html).not.toContain(">Deferred<");
    expect(html).not.toContain(">Done<");
    expect(html).not.toContain("meeting-summary-doc__badge");
  });

  it("omits owner from summary when topic has no assignee", () => {
    const html = buildMeetingSummaryHtml({
      meeting,
      items,
      entries: [],
      members: [],
    });
    expect(html).not.toContain("meeting-summary-doc__owner");
    expect(html).not.toContain("assigned");
    expect(html).not.toContain("Unassigned");
  });
});