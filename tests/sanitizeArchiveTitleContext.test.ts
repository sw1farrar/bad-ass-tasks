import { describe, expect, it } from "vitest";
import { extractMerchantInstitution } from "@/lib/files/archiveTitleRules";
import { guaranteeArchiveTitle } from "@/lib/files/guaranteeArchiveTitle";
import { suggestArchiveTitleHeuristic } from "@/lib/files/suggestArchiveTitleHeuristic";
import { isLikelyArchiveTitle } from "@/lib/files/archiveTitle";
import { isKnownBadArchiveTitle } from "@/lib/files/guaranteeArchiveTitle";
import { sanitizeArchiveTitleContext } from "@/lib/files/sanitizeArchiveTitleContext";

describe("sanitizeArchiveTitleContext", () => {
  it("detects polluted archive titles", () => {
    expect(isLikelyArchiveTitle("your receipt 2026-06-07 Your")).toBe(true);
    expect(isLikelyArchiveTitle("Your receipt")).toBe(false);
  });

  it("recovers inbound subject when note title was polluted", () => {
    const ctx = sanitizeArchiveTitleContext({
      title: "your receipt 2026-06-07 Your",
      searchPlain:
        "your receipt 2026-06-07 Your Thank you for shopping at Micro Center. LG 27 inch 4K Monitor $329.99",
      createdAt: "2026-06-07T12:00:00.000Z",
    });

    expect(ctx.title).not.toBe("your receipt 2026-06-07 Your");
    expect(ctx.searchPlain).toContain("Micro Center");
  });

  it("never returns your receipt / Your after pollution cleanup", () => {
    const ctx = sanitizeArchiveTitleContext({
      title: "your receipt 2026-06-07 Your",
      searchPlain:
        "your receipt 2026-06-07 Your Thank you for shopping at Micro Center. LG 27 inch 4K Monitor $329.99 Order Date 06/07/2026",
      createdAt: "2026-06-07T12:00:00.000Z",
    });
    const heuristic = suggestArchiveTitleHeuristic(ctx);
    const guaranteed = guaranteeArchiveTitle(heuristic.parts, ctx);

    expect(guaranteed.title).not.toBe("your receipt 2026-06-07 Your");
    expect(guaranteed.parts.institution).not.toBe("Your");
  });
});

describe("extractMerchantInstitution", () => {
  it("rejects merchant: Your boilerplate", () => {
    const institution = extractMerchantInstitution("Merchant: Your receipt details", {
      title: "Your receipt",
    });
    expect(institution).not.toBe("Your");
  });

  it("does not treat shopping with us as the merchant", () => {
    const institution = extractMerchantInstitution(
      "Thank you for shopping with us! Visit us again.",
      { title: "Your receipt" },
    );
    expect(institution).not.toBe("Us!");
    expect(institution).not.toBe("Us");
  });

  it("finds Micro Center from at-merchant line and email domain", () => {
    const institution = extractMerchantInstitution(
      [
        "Thank you for shopping with us!",
        "Thank you for shopping at Micro Center.",
        "From: orders@microcenter.com",
        "LG 27 inch Monitor $329.99",
      ].join(" "),
      { title: "Your receipt" },
    );
    expect(institution).toBe("Micro Center");
  });
});

describe("guaranteeArchiveTitle", () => {
  it("rejects your receipt / Us! formatted titles", () => {
    expect(isKnownBadArchiveTitle("your receipt 2026-06-07 Us!")).toBe(true);
    expect(isKnownBadArchiveTitle("your receipt 2026-06-07 Us!\u200c\u200c")).toBe(true);
  });

  it("rejects junk merchants hidden behind invisible unicode", () => {
    expect(isKnownBadArchiveTitle("your receipt 2026-06-07 Us!\u200c\u200c\u200c")).toBe(true);
  });

  it("recovers from polluted note title already saved as archive format", () => {
    const ctx = sanitizeArchiveTitleContext({
      title: "your receipt 2026-06-07 Us!\u200c\u200c",
      searchPlain:
        "your receipt 2026-06-07 Us! Thank you for shopping at Micro Center. LG 27 inch 4K Monitor $329.99 Order Date 06/07/2026",
      emailHtml:
        "<p>Thank you for shopping at Micro Center.</p><p>LG 27 inch 4K Monitor $329.99</p>",
      createdAt: "2026-06-07T12:00:00.000Z",
    });

    expect(ctx.title).toBeUndefined();
    const guaranteed = guaranteeArchiveTitle(
      { subject: "your receipt", date: "2026-06-07", institution: "Us!" },
      ctx,
    );

    expect(guaranteed.title).not.toMatch(/\bUs!?\b/);
    expect(guaranteed.title).not.toMatch(/^your receipt\b/i);
    expect(guaranteed.parts.institution).toBe("Micro Center");
  });
});