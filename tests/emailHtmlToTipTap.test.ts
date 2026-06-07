import { describe, it, expect } from "vitest";
import {
  buildInboundNoteContentJson,
  htmlToTipTapDoc,
  sanitizeInboundEmailHtml,
  replaceCidImagesInTipTapDoc,
} from "@/lib/notes/emailHtmlToTipTap";

describe("emailHtmlToTipTap", () => {
  it("strips script tags from inbound HTML", () => {
    const sanitized = sanitizeInboundEmailHtml(
      '<p>Hello</p><script>alert("xss")</script>',
    );
    expect(sanitized).not.toContain("script");
    expect(sanitized).toContain("Hello");
  });

  it("converts basic HTML to TipTap doc", () => {
    const doc = htmlToTipTapDoc("<p>Hello <strong>world</strong></p>");
    expect(doc).toMatchObject({
      type: "doc",
      content: expect.arrayContaining([
        expect.objectContaining({ type: "paragraph" }),
      ]),
    });
  });

  it("falls back to plain text when HTML parses empty", () => {
    const doc = buildInboundNoteContentJson({
      From: { Address: "sender@example.com" },
      RawHtmlBody: "<html><head><style>.x{}</style></head><body></body></html>",
      RawTextBody: "Plain fallback body",
    });
    const serialized = JSON.stringify(doc);
    expect(serialized).toContain("Plain fallback body");
  });

  it("replaces cid image sources in TipTap JSON", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "cid:logo123", alt: "Logo" },
        },
      ],
    };
    const updated = replaceCidImagesInTipTapDoc(doc, { logo123: "https://cdn.example/logo.png" });
    expect((updated as any).content[0].attrs.src).toBe("https://cdn.example/logo.png");
  });
});