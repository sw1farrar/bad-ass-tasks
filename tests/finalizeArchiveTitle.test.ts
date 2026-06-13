import { describe, expect, it, vi, beforeEach } from "vitest";
import { finalizeArchiveTitleParts } from "@/lib/files/finalizeArchiveTitle";
import { suggestArchiveTitleHeuristic } from "@/lib/files/suggestArchiveTitleHeuristic";

describe("finalizeArchiveTitleParts", () => {
  const microCenterCtx = {
    title: "Your receipt",
    emailHtml:
      "<p>Thank you for shopping at Micro Center.</p><p>LG 27 inch 4K Monitor $329.99</p><p>Order Date: 06/07/2026</p>",
    searchPlain: "Your receipt Thank you for shopping at Micro Center. LG 27 inch 4K Monitor $329.99",
    createdAt: "2026-06-07T12:00:00.000Z",
  };

  it("replaces raw AI boilerplate with merchant and product", () => {
    const heuristic = suggestArchiveTitleHeuristic(microCenterCtx);
    const finalized = finalizeArchiveTitleParts(
      { subject: "your receipt", date: "2026-06-07", institution: "Your" },
      microCenterCtx,
      heuristic.parts,
    );

    expect(finalized.subject).not.toBe("your receipt");
    expect(finalized.subject).toContain("receipt");
    expect(finalized.institution).toBe("Micro Center");
    expect(finalized.institution).not.toBe("Your");
  });
});

describe("suggestArchiveTitle AI path", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.XAI_API_KEY = "test-key";
    delete process.env.AI_FORCE_SIM;
  });

  it("never returns your receipt / Your even when the model does", async () => {
    const badJson = JSON.stringify({
      analysis: { document_kind: "other" },
      output: { subject: "your receipt", date: "2026-06-07", institution: "Your" },
    });

    vi.doMock("@/lib/ai/xaiClient", () => ({
      isXaiConfigured: () => true,
      callXaiChat: vi.fn().mockResolvedValue({ ok: true, content: badJson }),
    }));

    const { suggestArchiveTitle } = await import("@/lib/files/suggestArchiveTitle");
    const result = await suggestArchiveTitle({
      title: "Your receipt",
      emailHtml:
        "<p>Thank you for shopping at Micro Center.</p><p>LG 27 inch 4K Monitor $329.99</p>",
      createdAt: "2026-06-07T12:00:00.000Z",
    });

    expect(result.title).not.toContain("your receipt 2026-06-07 Your");
    expect(result.parts.institution).not.toBe("Your");
    expect(result.parts.subject).not.toBe("your receipt");
  });
});