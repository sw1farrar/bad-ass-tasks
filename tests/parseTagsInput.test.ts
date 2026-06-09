import { describe, it, expect } from "vitest";
import { normalizeTag, parseTagsInput } from "@/lib/files/parseTagsInput";

describe("parseTagsInput", () => {
  it("parses comma and hash separated tags", () => {
    expect(parseTagsInput("receipt, acme, #2026")).toEqual(["receipt", "acme", "2026"]);
  });

  it("normalizes tag spacing and case", () => {
    expect(normalizeTag("  Acme Corp  ")).toBe("acme corp");
  });
});