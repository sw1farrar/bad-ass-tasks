import { describe, expect, it } from "vitest";
import {
  EMPTY_AGENDA_DOC,
  agendaEntryBodyToClipboardHtml,
  agendaEntryBodyToHtml,
  agendaEntryHasDecisionTag,
  agendaEntryPlainText,
  isEmptyAgendaEntryBody,
  stripAgendaDecisionTag,
} from "@/lib/meetings/agendaEntryBody";

const richDoc = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "bold" }], text: "Ship" },
        { type: "text", text: " #decision by Friday" },
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
              content: [{ type: "text", text: "Notify finance" }],
            },
          ],
        },
      ],
    },
  ],
});

describe("agendaEntryBody", () => {
  it("treats empty TipTap docs as empty", () => {
    expect(isEmptyAgendaEntryBody("")).toBe(true);
    expect(isEmptyAgendaEntryBody(EMPTY_AGENDA_DOC)).toBe(true);
    expect(isEmptyAgendaEntryBody(richDoc)).toBe(false);
    expect(
      isEmptyAgendaEntryBody(
        JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "   " }],
            },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      isEmptyAgendaEntryBody(
        JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "image",
                  attrs: { src: "data:image/png;base64,abc", alt: "shot" },
                },
              ],
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("extracts plain text from TipTap JSON and legacy plain bodies", () => {
    expect(agendaEntryPlainText("Need forecast\n\nWaiting")).toBe("Need forecast\n\nWaiting");
    expect(agendaEntryPlainText(richDoc)).toContain("Ship #decision by Friday");
    expect(agendaEntryPlainText(richDoc)).toContain("- Notify finance");
  });

  it("detects and strips #decision from rich bodies", () => {
    expect(agendaEntryHasDecisionTag(richDoc)).toBe(true);
    expect(agendaEntryHasDecisionTag("plain note")).toBe(false);
    expect(stripAgendaDecisionTag(richDoc)).toBe("Ship by Friday - Notify finance");
  });

  it("renders safe HTML for rich and plain bodies", () => {
    const richHtml = agendaEntryBodyToHtml(richDoc);
    expect(richHtml).toContain("<strong>Ship</strong>");
    expect(richHtml).toContain("<ul>");
    expect(richHtml).toContain("Notify finance");
    expect(richHtml).not.toContain('"type":"doc"');

    const plainHtml = agendaEntryBodyToHtml("Line one\n\nLine two");
    expect(plainHtml).toContain("Line one<br /><br />Line two");
  });

  it("emits inline styles for Word/clipboard paste", () => {
    const html = agendaEntryBodyToClipboardHtml(richDoc, (s) => s);
    expect(html).toContain("<strong style=");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("<ul style=");
    expect(html).toContain("list-style-type:disc");
  });

  it("strips unsafe URLs from exported HTML", () => {
    const unsafe = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
              text: "click",
            },
          ],
        },
        {
          type: "image",
          attrs: { src: "javascript:alert(1)", alt: "x" },
        },
      ],
    });
    const html = agendaEntryBodyToHtml(unsafe);
    expect(html).toContain("click");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img");
  });
});
