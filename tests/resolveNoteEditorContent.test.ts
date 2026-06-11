import { describe, expect, it } from "vitest";
import {
  isInboundEmailNote,
  resolveNoteEditorContent,
} from "@/lib/notes/resolveNoteEditorContent";

describe("resolveNoteEditorContent", () => {
  it("detects inbound email notes", () => {
    expect(isInboundEmailNote({ tags: ["from-email"], recordType: "note" })).toBe(true);
    expect(isInboundEmailNote({ tags: [], recordType: "email" })).toBe(true);
    expect(isInboundEmailNote({ tags: [], recordType: "note" })).toBe(false);
  });

  it("rebuilds emailHtmlBlock from rawHtml when stored block html is empty", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "emailHtmlBlock",
          attrs: { html: "", styles: "" },
        },
      ],
    });

    const resolved = resolveNoteEditorContent({
      content,
      rawHtml: "<p>Full archived email body</p>",
      tags: ["from-email"],
      recordType: "email",
      emailPipelineVersion: 1,
    });

    const doc = JSON.parse(resolved);
    const block = doc.content.find((n: { type: string }) => n.type === "emailHtmlBlock");
    expect(block.attrs.html).toContain("Full archived email body");
  });

  it("rebuilds emailHtmlBlock when stored block is a stub but rawHtml is complete", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "emailHtmlBlock",
          attrs: { html: "<p>Hi</p>", styles: "" },
        },
      ],
    });

    const longRaw =
      "<p>Hi — your <strong>conference registration</strong> is confirmed.</p>" +
      "<p>Total: <span style=\"color:#16a34a\">$249.00</span></p>" +
      "<p>Receipt attached. See you in Austin!</p>";

    const resolved = resolveNoteEditorContent({
      content,
      rawHtml: longRaw,
      tags: ["from-email"],
      recordType: "email",
      emailPipelineVersion: 1,
    });

    const doc = JSON.parse(resolved);
    const block = doc.content.find((n: { type: string }) => n.type === "emailHtmlBlock");
    expect(block.attrs.html).toContain("conference registration");
    expect(block.attrs.html).toContain("$249.00");
  });

  it("returns content unchanged when emailHtmlBlock is already present", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "emailHtmlBlock",
          attrs: { html: "<p>Hello</p>", styles: "" },
        },
      ],
    });

    const resolved = resolveNoteEditorContent({
      content,
      rawHtml: "<p>Ignored</p>",
      tags: ["from-email"],
      recordType: "email",
      emailPipelineVersion: 1,
    });

    expect(resolved).toBe(content);
  });

  it("injects emailHtmlBlock from rawHtml for inbound notes", () => {
    const resolved = resolveNoteEditorContent({
      content: "Plain fallback body",
      rawHtml: "<p>Original email body</p>",
      tags: ["from-email"],
      recordType: "email",
      emailPipelineVersion: 2,
    });

    const doc = JSON.parse(resolved);
    const block = doc.content.find((n: { type: string }) => n.type === "emailHtmlBlock");
    expect(block).toBeTruthy();
    expect(block.attrs.html).toContain("Original email body");
    expect(doc.content[0].content[0].text).toBe("Plain fallback body");
  });

  it("leaves non-email notes untouched", () => {
    expect(
      resolveNoteEditorContent({
        content: "Just a note",
        rawHtml: "<p>Email</p>",
        tags: [],
        recordType: "note",
        emailPipelineVersion: null,
      }),
    ).toBe("Just a note");
  });
});