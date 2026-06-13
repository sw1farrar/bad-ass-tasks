import { describe, expect, it } from "vitest";
import { sanitizeAiInstitution, sanitizeAiSubject } from "@/lib/files/archiveTitleRules";
import { validateArchiveTitleParts } from "@/lib/files/validateArchiveTitle";

const microCenterCtx = {
  title: "Your receipt",
  searchPlain:
    "Thank you for shopping at Micro Center. Order Date: 06/07/2026. LG 27 inch 4K Monitor $329.99. Payment: Chase Visa.",
  createdAt: "2026-06-07T12:00:00.000Z",
};

describe("validateArchiveTitleParts", () => {
  it("rejects boilerplate subject and pronoun institution from bad AI output", () => {
    const issues = validateArchiveTitleParts(
      {
        subject: "your receipt",
        date: "2026-06-07",
        institution: "Your",
      },
      microCenterCtx,
      "receipt",
    );

    expect(issues.some((i) => i.field === "subject")).toBe(true);
    expect(issues.some((i) => i.field === "institution")).toBe(true);
  });

  it("accepts monitor receipt with Micro Center merchant", () => {
    const issues = validateArchiveTitleParts(
      {
        subject: "lg 27 inch 4k monitor receipt",
        date: "2026-06-07",
        institution: "Micro Center",
      },
      microCenterCtx,
      "receipt",
    );

    expect(issues).toHaveLength(0);
  });
});

describe("AI sanitization for Micro Center receipt", () => {
  it("repairs Chase institution and generic subject", () => {
    const text = microCenterCtx.searchPlain!;
    const subject = sanitizeAiSubject("your receipt", "receipt", text, microCenterCtx);
    const institution = sanitizeAiInstitution("Your", "receipt", text, microCenterCtx);

    expect(subject).not.toBe("your receipt");
    expect(subject).toContain("receipt");
    expect(institution).toBe("Micro Center");
  });
});