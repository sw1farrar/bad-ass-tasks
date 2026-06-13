import { describe, it, expect } from "vitest";
import {
  defaultTaskDueDate,
  defaultTaskDueDateInput,
  isDueDateToday,
  parseLocalDate,
  safeFormatDate,
  safeFormatTimestampIso,
  safeFormatDistanceToNow,
  formatLocalDateShort,
  startOfLocalToday,
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

  it("defaultTaskDueDate helpers align picker input with stored today", () => {
    const today = startOfLocalToday();
    const stored = defaultTaskDueDate(today);
    const input = defaultTaskDueDateInput(today);
    expect(input).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isDueDateToday(stored, today)).toBe(true);
    expect(parseLocalDate(input)?.getTime()).toBe(today.getTime());
  });

  it("safeFormatTimestampIso never throws on invalid ISO strings", () => {
    expect(safeFormatTimestampIso("")).toBe("");
    expect(safeFormatTimestampIso("not-a-date", "MMM d, yyyy", "—")).toBe("—");
    expect(safeFormatTimestampIso(new Date().toISOString(), "MMM d, yyyy")).not.toBe("");
  });
});