import { describe, it, expect } from "vitest";
import { parseTagsInput } from "@/lib/files/parseTagsInput";

describe("parseTagsInput", () => {
  it("splits comma and hash separated tags", () => {
    expect(parseTagsInput("receipt, acme #2026")).toEqual(["receipt", "acme", "2026"]);
  });

  it("lowercases and trims", () => {
    expect(parseTagsInput("  Receipt , ACME ")).toEqual(["receipt", "acme"]);
  });

  it("returns empty for blank input", () => {
    expect(parseTagsInput("  ")).toEqual([]);
  });
});