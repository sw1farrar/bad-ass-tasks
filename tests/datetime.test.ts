import { describe, it, expect } from "vitest";
import {
  parseLocalDate,
  safeFormatDate,
  safeFormatTimestampIso,
  safeFormatDistanceToNow,
  formatLocalDateShort,
} from "@/lib/datetime";

describe("datetime safety helpers", () => {
  it("parseLocalDate returns undefined for invalid input", () => {
    expect(parseLocalDate("")).toBeUndefined();
    expect(parseLocalDate("   ")).toBeUndefined();
    expect(parseLocalDate("not-a-date")).toBeUndefined();
  });

  it("safeFormatDate never throws on invalid dates", () => {
    expect(safeFormatDate(new Date("invalid"), "MMM d")).toBe("");
    expect(safeFormatDate(new Date("invalid"), "MMM d", "—")).toBe("—");
  });

  it("safeFormatDistanceToNow never throws on invalid input", () => {
    expect(safeFormatDistanceToNow("")).toBe("Recently");
    expect(safeFormatDistanceToNow("bad-date")).toBe("Recently");
    expect(safeFormatDistanceToNow(new Date().toISOString())).toMatch(/ago$/);
  });

  it("formatLocalDateShort returns empty string for invalid input", () => {
    expect(formatLocalDateShort("not-a-date")).toBe("");
  });

  it("safeFormatTimestampIso never throws on invalid ISO strings", () => {
    expect(safeFormatTimestampIso("")).toBe("");
    expect(safeFormatTimestampIso("not-a-date", "MMM d, yyyy", "—")).toBe("—");
    expect(safeFormatTimestampIso(new Date().toISOString(), "MMM d, yyyy")).not.toBe("");
  });
});