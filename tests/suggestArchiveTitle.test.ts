import { describe, expect, it } from "vitest";
import { formatArchiveTitle, normalizeArchiveDate } from "@/lib/files/archiveTitle";
import {
  classifyDocument,
  extractMerchantInstitution,
  extractReceiptProduct,
  sanitizeAiInstitution,
} from "@/lib/files/archiveTitleRules";
import { suggestArchiveTitleHeuristic } from "@/lib/files/suggestArchiveTitleHeuristic";

describe("archive title formatting", () => {
  it("formats subject, date, and institution in order", () => {
    expect(
      formatArchiveTitle({
        subject: "bank statement",
        date: "2026-12-31",
        institution: "Wells Fargo",
      }),
    ).toBe("bank statement 2026-12-31 Wells Fargo");
  });

  it("normalizes compact and slash dates", () => {
    expect(normalizeArchiveDate("20261231")).toBe("2026-12-31");
    expect(normalizeArchiveDate("12/31/2026")).toBe("2026-12-31");
  });
});

describe("suggestArchiveTitleHeuristic", () => {
  it("detects bank statement with period month and institution", () => {
    const result = suggestArchiveTitleHeuristic({
      title: "Your Wells Fargo statement",
      searchPlain:
        "Bank statement for the month of December 2026 from Wells Fargo. Account ending 1234.",
      createdAt: "2026-06-01T12:00:00.000Z",
    });

    expect(result.parts.subject).toBe("bank statement");
    expect(result.parts.date).toBe("2026-12-31");
    expect(result.parts.institution).toBe("Wells Fargo");
    expect(result.title).toBe("bank statement 2026-12-31 Wells Fargo");
  });

  it("detects 1098-SA form code", () => {
    const result = suggestArchiveTitleHeuristic({
      title: "Tax document",
      searchPlain: "Form 1098-SA mortgage interest statement for 2025 tax year.",
      attachmentFileNames: ["1098sa_2025.pdf"],
      createdAt: "2026-01-15T08:00:00.000Z",
    });

    expect(result.parts.subject).toBe("1098-SA");
  });

  it("falls back to upload date when no document date is found", () => {
    const result = suggestArchiveTitleHeuristic({
      title: "Misc scan",
      searchPlain: "No dates in this note.",
      createdAt: "2026-03-10T16:00:00.000Z",
    });

    expect(result.parts.date).toBe("2026-03-10");
  });

  it("uses purchased item and Micro Center merchant on receipt with Chase payment", () => {
    const ctx = {
      title: "Your Micro Center order confirmation",
      searchPlain: [
        "From: Micro Center <orders@microcenter.com>",
        "Thank you for shopping at Micro Center.",
        "Order Date: 03/15/2026",
        "Description: LG 27 inch 4K Monitor",
        "LG 27 inch 4K Monitor $329.99",
        "Payment method: Chase Visa ending in 4242",
        "Total $356.12",
      ].join(" "),
      createdAt: "2026-03-16T08:00:00.000Z",
    };

    expect(classifyDocument(ctx.searchPlain!, ctx)).toBe("receipt");
    expect(extractReceiptProduct(ctx.searchPlain!)).toContain("lg 27 inch 4k monitor");

    const result = suggestArchiveTitleHeuristic(ctx);
    expect(result.parts.subject).toBe("lg 27 inch 4k monitor receipt");
    expect(result.parts.institution).toBe("Micro Center");
    expect(result.parts.institution).not.toBe("Chase");
    expect(result.parts.date).toBe("2026-03-15");
  });

  it("rejects Chase as institution for receipts in AI sanitization", () => {
    const ctx = {
      title: "Your Micro Center order confirmation",
      searchPlain:
        "Thank you for shopping at Micro Center. LG UltraWide Monitor $499. Payment method: Chase Visa.",
      createdAt: "2026-03-16T08:00:00.000Z",
    };
    const text = ctx.searchPlain;
    const institution = sanitizeAiInstitution("Chase", "receipt", text, ctx);
    expect(institution).toBe("Micro Center");
  });

  it("prefers merchant from email domain over payment card mention", () => {
    const ctx = {
      title: "Order confirmation",
      searchPlain: "From: orders@microcenter.com Payment method Chase Visa",
      createdAt: "2026-03-16T08:00:00.000Z",
    };
    expect(extractMerchantInstitution(ctx.searchPlain, ctx)).toBe("Micro Center");
  });
});