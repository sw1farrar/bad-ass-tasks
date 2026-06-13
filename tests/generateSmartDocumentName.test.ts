import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildSmartDocumentNameUserPrompt } from "@/lib/files/buildSmartDocumentNamePrompt";
import {
  getSmartFilenameRejectionReason,
  isKnownBadSmartFilename,
  isLiteralSubjectLead,
  isTaxFormLeadSegment,
  sanitizeSmartFilename,
  sanitizeSmartMemo,
  splitSmartFilenameSegments,
} from "@/lib/files/smartDocumentName";

const microCenterCtx = {
  title: "Your receipt",
  emailHtml:
    "<p>Thank you for shopping with us!</p><p>Thank you for shopping at Micro Center.</p><p>LG 27 inch 4K Monitor $329.99</p><p>USB-C Cable $12.99</p><p>Order Date: 06/07/2026</p><p>orders@microcenter.com</p>",
  searchPlain:
    "Your receipt Thank you for shopping at Micro Center. LG 27 inch 4K Monitor $329.99 USB-C Cable $12.99",
  createdAt: "2026-06-07T12:00:00.000Z",
};

function mockXaiContent(json: unknown) {
  return { ok: true as const, content: JSON.stringify(json) };
}

describe("buildSmartDocumentNameUserPrompt", () => {
  it("passes raw body content without pre-extracted signals", () => {
    const prompt = buildSmartDocumentNameUserPrompt(microCenterCtx);

    expect(prompt).toContain("EMAIL / NOTE BODY");
    expect(prompt).toContain("Micro Center");
    expect(prompt).toContain("LG 27 inch 4K Monitor");
    expect(prompt).not.toContain("EXTRACTED SIGNALS");
    expect(prompt).not.toContain("Priced line items sorted");
  });

  it("includes workspace filing tags for AI tag matching", () => {
    const prompt = buildSmartDocumentNameUserPrompt(
      { attachmentFileNames: ["receipt.jpg"] },
      { workspaceTags: ["receipts", "taxes", "utilities"] },
    );

    expect(prompt).toContain("WORKSPACE FILING TAGS");
    expect(prompt).toContain("receipts, taxes, utilities");
  });

  it("notes when document images are attached for visual analysis", () => {
    const prompt = buildSmartDocumentNameUserPrompt(
      { attachmentFileNames: ["receipt.jpg"] },
      { visionImages: [{ fileName: "receipt.jpg" }] },
    );

    expect(prompt).toContain("DOCUMENT IMAGES");
    expect(prompt).toContain("visual analysis");
    expect(prompt).toContain("receipt.jpg");
    expect(prompt).not.toContain("filenames only");
  });
});

describe("sanitizeSmartMemo", () => {
  it("trims and caps memo length", () => {
    expect(sanitizeSmartMemo("  Micro Center receipt for a 27 inch monitor.  ")).toBe(
      "Micro Center receipt for a 27 inch monitor.",
    );
    expect(sanitizeSmartMemo("x".repeat(600)).length).toBe(500);
  });
});

describe("sanitizeSmartFilename", () => {
  it("cleans characters and preserves iso dates in segments", () => {
    expect(sanitizeSmartFilename("Monitor! — 2026-06-07 — Micro Center")).toBe(
      "Monitor - 2026-06-07 - Micro Center",
    );
    expect(splitSmartFilenameSegments("Monitor - 2026-06-07 - Micro Center")).toEqual([
      "Monitor",
      "2026-06-07",
      "Micro Center",
    ]);
  });

  it("preserves hyphens inside tax form identifiers", () => {
    expect(sanitizeSmartFilename("1098-SA - 2025 - Wells Fargo")).toBe(
      "1098-SA - 2025 - Wells Fargo",
    );
    expect(sanitizeSmartFilename("W-2 - 2025 - Acme Corporation")).toBe(
      "W-2 - 2025 - Acme Corporation",
    );
    expect(splitSmartFilenameSegments("1098-SA - 2025 - Wells Fargo")).toEqual([
      "1098-SA",
      "2025",
      "Wells Fargo",
    ]);
  });
});

describe("document-type lead helpers", () => {
  it("recognizes tax form and statement literal subjects", () => {
    expect(isTaxFormLeadSegment("1098-SA")).toBe(true);
    expect(isTaxFormLeadSegment("W-2")).toBe(true);
    expect(isTaxFormLeadSegment("1094-C")).toBe(true);
    expect(isTaxFormLeadSegment("1098 SA")).toBe(true);
    expect(isLiteralSubjectLead("Bank Statement")).toBe(true);
    expect(isLiteralSubjectLead("Credit Card Statement")).toBe(true);
    expect(isLiteralSubjectLead("Invoice")).toBe(true);
  });
});

describe("getSmartFilenameRejectionReason", () => {
  it("accepts filenames for tax forms, statements, bills, and correspondence", () => {
    expect(getSmartFilenameRejectionReason("1098-SA - 2025 - Wells Fargo")).toBe(null);
    expect(getSmartFilenameRejectionReason("W-2 - 2025 - Acme Corporation")).toBe(null);
    expect(getSmartFilenameRejectionReason("1094-C - 2025 - Acme Corporation")).toBe(null);
    expect(getSmartFilenameRejectionReason("Bank Statement - 2026-05-31 - Wells Fargo")).toBe(null);
    expect(getSmartFilenameRejectionReason("Credit Card Statement - 2026-05-31 - Chase")).toBe(null);
    expect(getSmartFilenameRejectionReason("Invoice - Acme Plumbing - 2026-04-15")).toBe(null);
    expect(getSmartFilenameRejectionReason("Electric Bill - 2026-03-15 - PG&E")).toBe(null);
    expect(getSmartFilenameRejectionReason("Q2 Planning Meeting Notes - 2026-04-12")).toBe(null);
  });

  it("rejects generic tax and statement subjects", () => {
    expect(getSmartFilenameRejectionReason("Tax Form - 2025 - Wells Fargo")).toContain(
      "specific form type",
    );
    expect(getSmartFilenameRejectionReason("Tax Document - 2025 - IRS")).toContain(
      "specific form type",
    );
    expect(getSmartFilenameRejectionReason("Statement - 2026-05-31 - Wells Fargo")).toContain(
      "too vague",
    );
    expect(getSmartFilenameRejectionReason("Bill - 2026-03-15 - PG&E")).toContain("too vague");
  });

  it("flags obvious bad filenames with actionable reasons", () => {
    expect(getSmartFilenameRejectionReason("Your Receipt - 2026-06-07 - Your")).toContain(
      "boilerplate",
    );
    expect(
      getSmartFilenameRejectionReason(
        "Purchase - 2026-06-07 - Micro Center Tustin 1100 E Edinger Ave",
      ),
    ).toMatch(/generic|boilerplate/i);
    expect(getSmartFilenameRejectionReason("LG 27 Inch 4K Monitor - 2026-06-07 - Micro Center")).toBe(
      null,
    );
    expect(isKnownBadSmartFilename("LG 27 Inch 4K Monitor - 2026-06-07 - Micro Center")).toBe(
      false,
    );
  });
});

describe("generateSmartDocumentName", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.XAI_API_KEY = "test-key";
    delete process.env.AI_FORCE_SIM;
    delete process.env.NEXT_PUBLIC_AI_FORCE_SIM;
  });

  it("returns AI output directly without local rewriting", async () => {
    vi.doMock("@/lib/ai/xaiClient", () => ({
      getXaiUnavailableReason: () => null,
      callXaiChat: vi.fn().mockResolvedValue(
        mockXaiContent({
          analysis: {
            document_type: "receipt",
            what_i_read: "Micro Center order with LG monitor as top item.",
          },
          output: {
            filename: "Computer Monitor - 2026-06-07 - Micro Center",
            memo: "Micro Center purchase receipt dated June 7, 2026 for a 27 inch 4K computer monitor, the highest priced item on the order.",
            tags: ["receipts", "electronics"],
            reasoning: "Highest priced item interpreted as a computer monitor from the Micro Center receipt.",
          },
        }),
      ),
    }));

    const { generateSmartDocumentName } = await import("@/lib/files/generateSmartDocumentName");
    const result = await generateSmartDocumentName(microCenterCtx, {
      workspaceTags: ["receipts", "electronics", "taxes"],
    });

    expect(result.source).toBe("ai");
    expect(result.filename).toBe("Computer Monitor - 2026-06-07 - Micro Center");
    expect(result.memo).toContain("Micro Center");
    expect(result.tags).toEqual(["receipts", "electronics"]);
    expect(result.reasoning).toContain("Micro Center");
  });

  it("retries when the first response is boilerplate", async () => {
    const callXaiChat = vi
      .fn()
      .mockResolvedValueOnce(
        mockXaiContent({
          output: { filename: "Your Receipt - 2026-06-07 - Your", reasoning: "from subject" },
        }),
      )
      .mockResolvedValueOnce(
        mockXaiContent({
          output: {
            filename: "Computer Monitor - 2026-06-07 - Micro Center",
            reasoning: "Top line item interpreted as computer monitor.",
          },
        }),
      );

    vi.doMock("@/lib/ai/xaiClient", () => ({
      getXaiUnavailableReason: () => null,
      callXaiChat,
    }));

    const { generateSmartDocumentName } = await import("@/lib/files/generateSmartDocumentName");
    const result = await generateSmartDocumentName(microCenterCtx);

    expect(callXaiChat).toHaveBeenCalledTimes(2);
    expect(result.filename).toContain("Micro Center");
    expect(result.filename).not.toMatch(/^Your Receipt\b/i);
  });

  it("throws when API key is missing", async () => {
    vi.doMock("@/lib/ai/xaiClient", () => ({
      getXaiUnavailableReason: () => "missing_key" as const,
      callXaiChat: vi.fn(),
    }));

    const { generateSmartDocumentName } = await import("@/lib/files/generateSmartDocumentName");
    await expect(generateSmartDocumentName(microCenterCtx)).rejects.toThrow(
      "ai_unavailable:missing_key",
    );
  });

  it("sends image attachments to Grok vision when note has photos", async () => {
    const callXaiChat = vi.fn().mockResolvedValue(
      mockXaiContent({
        analysis: {
          document_type: "receipt",
          what_i_read: "Photo of Micro Center receipt with monitor purchase.",
        },
        output: {
          filename: "Computer Monitor - 2026-06-07 - Micro Center",
          memo: "Photo of a Micro Center receipt from June 7, 2026 showing a computer monitor as the main purchase.",
          tags: ["receipts"],
          reasoning: "Read store and line items from the receipt photo.",
        },
      }),
    );

    vi.doMock("@/lib/files/loadNoteAttachmentVisionImages", () => ({
      loadNoteAttachmentVisionImages: vi.fn().mockResolvedValue([
        {
          fileName: "receipt.jpg",
          mimeType: "image/jpeg",
          dataUrl: "data:image/jpeg;base64,ZmFrZQ==",
        },
      ]),
    }));

    vi.doMock("@/lib/ai/xaiClient", () => ({
      getXaiUnavailableReason: () => null,
      callXaiChat,
    }));

    const { generateSmartDocumentName } = await import("@/lib/files/generateSmartDocumentName");
    const result = await generateSmartDocumentName(
      {
        title: "Photos · Jun 7",
        attachmentFileNames: ["receipt.jpg"],
        createdAt: "2026-06-07T12:00:00.000Z",
      },
      { noteId: "note-1", userId: "user-1", workspaceTags: ["receipts", "electronics"] },
    );

    expect(result.filename).toBe("Computer Monitor - 2026-06-07 - Micro Center");
    expect(result.tags).toEqual(["receipts"]);
    expect(callXaiChat).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [
          expect.objectContaining({
            dataUrl: "data:image/jpeg;base64,ZmFrZQ==",
            label: "receipt.jpg",
          }),
        ],
      }),
    );
  });

  it("returns tax form filenames from AI without rewriting", async () => {
    vi.doMock("@/lib/ai/xaiClient", () => ({
      getXaiUnavailableReason: () => null,
      callXaiChat: vi.fn().mockResolvedValue(
        mockXaiContent({
          analysis: {
            document_type: "tax_form",
            form_type: "1098-SA",
            subject: "1098-SA",
            what_i_read: "HSA tax form from Wells Fargo for 2025.",
          },
          output: {
            filename: "1098-SA - 2025 - Wells Fargo",
            memo: "Wells Fargo 1098-SA for tax year 2025 reporting HSA contributions and distributions.",
            tags: ["taxes", "health"],
            reasoning: "HSA form 1098-SA from Wells Fargo for tax year 2025.",
          },
        }),
      ),
    }));

    const { generateSmartDocumentName } = await import("@/lib/files/generateSmartDocumentName");
    const result = await generateSmartDocumentName(
      {
        title: "Your tax document is ready",
        searchPlain: "Form 1098-SA Tax Year 2025 Wells Fargo HSA",
        createdAt: "2026-06-07T12:00:00.000Z",
      },
      { workspaceTags: ["taxes", "health", "receipts"] },
    );

    expect(result.filename).toBe("1098-SA - 2025 - Wells Fargo");
    expect(result.memo).toContain("1098-SA");
    expect(result.tags).toEqual(["taxes", "health"]);
    expect(result.source).toBe("ai");
  });

  it("falls back to analysis text when memo is missing", async () => {
    vi.doMock("@/lib/ai/xaiClient", () => ({
      getXaiUnavailableReason: () => null,
      callXaiChat: vi.fn().mockResolvedValue(
        mockXaiContent({
          analysis: {
            document_type: "receipt",
            what_i_read: "Receipt from Micro Center for monitor purchase on June 7, 2026.",
          },
          output: {
            filename: "Computer Monitor - 2026-06-07 - Micro Center",
            reasoning: "Top item is a monitor.",
          },
        }),
      ),
    }));

    const { generateSmartDocumentName } = await import("@/lib/files/generateSmartDocumentName");
    const result = await generateSmartDocumentName(microCenterCtx);

    expect(result.memo).toContain("Micro Center");
  });

  it("throws when both attempts produce bad filenames", async () => {
    vi.doMock("@/lib/ai/xaiClient", () => ({
      getXaiUnavailableReason: () => null,
      callXaiChat: vi.fn().mockResolvedValue(
        mockXaiContent({
          output: { filename: "Purchase - 2026-06-07 - Us", reasoning: "bad" },
        }),
      ),
    }));

    const { generateSmartDocumentName } = await import("@/lib/files/generateSmartDocumentName");
    await expect(generateSmartDocumentName(microCenterCtx)).rejects.toThrow("suggestion_rejected");
  });
});