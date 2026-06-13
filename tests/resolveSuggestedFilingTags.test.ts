import { describe, expect, it } from "vitest";
import {
  mergeWorkspaceFilingTags,
  resolveSuggestedFilingTags,
} from "@/lib/files/resolveSuggestedFilingTags";

describe("resolveSuggestedFilingTags", () => {
  const allowed = ["receipts", "taxes", "utilities", "electronics"];

  it("keeps only tags that exist in the workspace pool", () => {
    expect(resolveSuggestedFilingTags(["receipts", "groceries", "Taxes"], allowed)).toEqual([
      "receipts",
      "taxes",
    ]);
  });

  it("dedupes and normalizes casing", () => {
    expect(resolveSuggestedFilingTags(["Receipts", "RECEIPTS", "electronics"], allowed)).toEqual([
      "receipts",
      "electronics",
    ]);
  });

  it("ignores system tags and empty suggestions", () => {
    expect(resolveSuggestedFilingTags(["from-email", "receipts"], allowed)).toEqual(["receipts"]);
    expect(resolveSuggestedFilingTags([], allowed)).toEqual([]);
    expect(resolveSuggestedFilingTags(["receipts"], [])).toEqual([]);
  });
});

describe("mergeWorkspaceFilingTags", () => {
  it("merges, normalizes, and sorts unique tags", () => {
    expect(mergeWorkspaceFilingTags(["Taxes", "receipts"], ["from-email", "Receipts", "utilities"])).toEqual(
      ["receipts", "taxes", "utilities"],
    );
  });
});