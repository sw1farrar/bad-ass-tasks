import { describe, expect, it } from "vitest";
import {
  isActionableFileAiSuggestion,
  parseFileAiSuggestion,
} from "@/lib/files/fileAiSuggestion";

describe("fileAiSuggestion", () => {
  it("parses ready suggestions with receipt items", () => {
    const parsed = parseFileAiSuggestion({
      status: "ready",
      title: "Best Buy · Monitor",
      memo: "27-inch display",
      tags: ["Tech", "receipt"],
      isReceipt: true,
      receiptLineItems: [{ itemName: "Monitor", vendor: "Best Buy" }],
      analyzedAt: "2026-06-15T12:00:00.000Z",
    });

    expect(parsed?.status).toBe("ready");
    expect(parsed?.title).toBe("Best Buy · Monitor");
    expect(parsed?.tags).toEqual(["tech", "receipt"]);
    expect(isActionableFileAiSuggestion(parsed)).toBe(true);
  });

  it("returns null for invalid payloads", () => {
    expect(parseFileAiSuggestion(null)).toBeNull();
    expect(parseFileAiSuggestion({ status: "bogus" })).toBeNull();
  });
});