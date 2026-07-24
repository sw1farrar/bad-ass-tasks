import { describe, expect, it } from "vitest";
import { localDateInputValue, parseLocalDateInput } from "@/lib/meetings/meetingDates";

describe("meetingDates", () => {
  it("formats local calendar date without using UTC midnight", () => {
    const eveningPacific = new Date(2026, 6, 23, 20, 0, 0); // Jul 23 8pm local
    expect(localDateInputValue(eveningPacific)).toBe("2026-07-23");
  });

  it("parses date inputs to a valid ISO timestamp", () => {
    const iso = parseLocalDateInput("2026-07-23");
    expect(iso).toBeTruthy();
    expect(new Date(iso!).getFullYear()).toBe(2026);
  });
});
