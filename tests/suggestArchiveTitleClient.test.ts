import { describe, expect, it } from "vitest";
import { suggestArchiveTitleLocal } from "@/lib/files/suggestArchiveTitleClient";

describe("suggestArchiveTitleLocal", () => {
  it("finalizes thin context without your receipt / Your", () => {
    const result = suggestArchiveTitleLocal({
      title: "Your receipt",
      searchPlain: "Your receipt",
      createdAt: "2026-06-07T12:00:00.000Z",
      recordType: "email",
    });

    expect(result.title).not.toBe("your receipt 2026-06-07 Your");
    expect(result.parts.institution).not.toBe("Your");
  });

  it("uses email html for Micro Center receipt", () => {
    const result = suggestArchiveTitleLocal({
      title: "Your receipt",
      emailHtml:
        "<p>Thank you for shopping at Micro Center.</p><p>LG 27 inch 4K Monitor $329.99</p><p>Order Date: 06/07/2026</p>",
      createdAt: "2026-06-07T12:00:00.000Z",
    });

    expect(result.parts.institution).toBe("Micro Center");
    expect(result.parts.subject).toContain("monitor");
  });

  it("ignores a previously saved bad archive title on the note", () => {
    const result = suggestArchiveTitleLocal({
      title: "your receipt 2026-06-07 Us!\u200c\u200c",
      searchPlain:
        "your receipt 2026-06-07 Us! Thank you for shopping at Micro Center. LG 27 inch 4K Monitor $329.99",
      emailHtml:
        "<p>Thank you for shopping at Micro Center.</p><p>LG 27 inch 4K Monitor $329.99</p>",
      createdAt: "2026-06-07T12:00:00.000Z",
    });

    expect(result.title).not.toMatch(/\bUs!?\b/);
    expect(result.parts.institution).toBe("Micro Center");
    expect(result.parts.subject).toContain("monitor");
  });

  it("handles thank you for shopping with us without naming Us! as merchant", () => {
    const result = suggestArchiveTitleLocal({
      title: "Your receipt",
      emailHtml: [
        "<p>Thank you for shopping with us!</p>",
        "<p>Thank you for shopping at Micro Center.</p>",
        "<p>LG 27 inch 4K Monitor $329.99</p>",
        "<p>orders@microcenter.com</p>",
      ].join(""),
      createdAt: "2026-06-07T12:00:00.000Z",
    });

    expect(result.title).not.toMatch(/\bUs!?\b/);
    expect(result.parts.subject).not.toBe("your receipt");
    expect(result.parts.institution).toBe("Micro Center");
  });
});