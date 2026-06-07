import { describe, it, expect } from "vitest";
import {
  buildInboundNotePlainText,
  buildInboundNoteTitle,
  extractInboundPlainBody,
} from "@/lib/brevo/inboundNoteContent";
import type { BrevoInboundEmailItem } from "@/lib/brevo/inboundTypes";

describe("inboundNoteContent", () => {
  const item: BrevoInboundEmailItem = {
    From: { Name: "Steve Farrar", Address: "sw1farrar@gmail.com" },
    Subject: "Brevo inbound test",
    RawTextBody: "Hello from email",
    SentAtDate: "Sun, 7 Jun 2026 00:47:37 -0700",
  };

  it("uses subject for title", () => {
    expect(buildInboundNoteTitle(item)).toBe("Brevo inbound test");
  });

  it("prefers extracted markdown over raw text", () => {
    expect(
      extractInboundPlainBody({
        ExtractedMarkdownMessage: "Parsed body",
        RawTextBody: "Raw body",
      }),
    ).toBe("Parsed body");
  });

  it("includes sender metadata in note body", () => {
    const text = buildInboundNotePlainText(item);
    expect(text).toContain("From: Steve Farrar <sw1farrar@gmail.com>");
    expect(text).toContain("Hello from email");
  });
});