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
    body: "Need updated forecast\n\nWaiting on finance",
    createdAt: "2026-06-23T13:00:00Z",
  },
  {
    id: "e2",
    agendaItemId: "a1",
    body: "Latest blocker",
    createdAt: "2026-06-23T14:00:00Z",
  },
  {
    id: "e3",
    agendaItemId: "a1",
    body: "Carry to next week",
    createdAt: "2026-06-26T12:00:00Z",
  },
];

const items: MeetingAgendaItem[] = [
  {
    id: "a1",
    meetingId: "m1",
    title: "Budget",
    description: "Review Q3 numbers\n\nFocus on hiring plan",
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
    expect(html).toContain("June 26, 2026");
    expect(html).toContain("June 23, 2026");
    const htmlAgendaStart = html.indexOf(">Agenda</p>");
    const htmlJune26 = html.indexOf("June 26, 2026", htmlAgendaStart);
    const htmlJune23 = html.indexOf("June 23, 2026", htmlJune26);
    expect(htmlJune26).toBeGreaterThan(htmlAgendaStart);
    expect(htmlJune23).toBeGreaterThan(htmlJune26);
    expect(html.indexOf("Carry to next week")).toBeLessThan(html.indexOf("Latest blocker"));
    expect(plain).toContain("June 26, 2026");
    expect(plain).toContain("June 23, 2026");
    const plainAgendaStart = plain.indexOf("AGENDA");
    const plainJune26 = plain.indexOf("June 26, 2026", plainAgendaStart);
    const plainJune23 = plain.indexOf("June 23, 2026", plainJune26);
    expect(plainJune26).toBeGreaterThan(plainAgendaStart);
    expect(plainJune23).toBeGreaterThan(plainJune26);
    expect(plain.indexOf("Carry to next week")).toBeLessThan(plain.indexOf("Latest blocker"));
    expect(html).toContain("Need updated forecast<br /><br />Waiting on finance");
    expect(html).toContain("Review Q3 numbers<br /><br />Focus on hiring plan");
    expect(plain).toContain("   Need updated forecast");
    expect(plain).toContain("   Waiting on finance");
    expect(plain).toContain("   Focus on hiring plan");
  });

  it("keeps TipTap formatting in Word/clipboard HTML", () => {
    const richEntries: MeetingAgendaEntry[] = [
      {
        id: "e-rich",
        agendaItemId: "a1",
        body: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "bold" }], text: "Owner update" },
              ],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Call finance" }],
                    },
                  ],
                },
              ],
            },
          ],
        }),
        createdAt: "2026-06-23T15:00:00Z",
      },
    ];
    const html = buildMeetingAgendaClipboardHtml({
      meeting,
      items,
      entries: richEntries,
      members: [],
      includeComments: true,
    });
    expect(html).toContain("<strong style=");
    expect(html).toContain("Owner update");
    expect(html).toContain("list-style-type:disc");
    expect(html).toContain("Call finance");
  });
});