import { describe, expect, it } from "vitest";
import { finalizeArchiveTitleParts } from "@/lib/files/finalizeArchiveTitle";
import { suggestArchiveTitleHeuristic } from "@/lib/files/suggestArchiveTitleHeuristic";

describe("client fallback scenario", () => {
  it("thin list-projection context does not return your receipt / Your", () => {
    const ctx = {
      title: "Your receipt",
      searchPlain: "Your receipt",
      createdAt: "2026-06-07T12:00:00.000Z",
      recordType: "email" as const,
    };

    const heuristic = suggestArchiveTitleHeuristic(ctx);
    const finalized = finalizeArchiveTitleParts(
      { subject: "your receipt", date: "2026-06-07", institution: "Your" },
      ctx,
      heuristic.parts,
    );

    expect(heuristic.title).not.toBe("your receipt 2026-06-07 Your");
    expect(finalized.subject).not.toBe("your receipt");
    expect(finalized.institution).not.toBe("Your");
  });
});