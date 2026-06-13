import { describe, expect, it } from "vitest";
import { buildArchiveTitleUserPrompt } from "@/lib/files/buildArchiveTitlePrompt";

describe("buildArchiveTitleUserPrompt", () => {
  it("puts attachments first and marks email subject as low trust", () => {
    const prompt = buildArchiveTitleUserPrompt({
      title: "Your receipt",
      searchPlain: "Thank you for shopping at Micro Center.",
      attachmentFileNames: ["receipt.pdf"],
      attachmentTexts: [
        "LG 27 inch Monitor $329.99\nUSB Cable $12.99\nPayment: Chase Visa",
      ],
      createdAt: "2026-03-16T08:00:00.000Z",
    });

    const attachmentIdx = prompt.indexOf("ATTACHMENT: receipt.pdf");
    const subjectIdx = prompt.indexOf("EMAIL / NOTE SUBJECT (LOW TRUST");
    const bodyIdx = prompt.indexOf("EMAIL / NOTE BODY");

    expect(attachmentIdx).toBeGreaterThan(-1);
    expect(subjectIdx).toBeGreaterThan(-1);
    expect(attachmentIdx).toBeLessThan(subjectIdx);
    expect(bodyIdx).toBeGreaterThan(-1);
    expect(bodyIdx).toBeLessThan(subjectIdx);
    expect(prompt).toContain("EXTRACTED SIGNALS");
    expect(prompt).toContain("LG 27 inch Monitor $329.99");
    expect(prompt).toContain("Rejected boilerplate");
    expect(prompt).not.toContain("search_document");
    expect(prompt).not.toContain("Heuristic");
  });
});