import { describe, it, expect } from "vitest";
import { isHomeAllCaughtUp } from "@/features/home/lib/isHomeAllCaughtUp";

describe("isHomeAllCaughtUp", () => {
  const clear = {
    attentionItemCount: 0,
    upcomingFocusCount: 0,
    openTasksTotal: 0,
    overdueTotal: 0,
    openChecklistItemsTotal: 0,
  };

  it("is true only when every actionable bucket is empty", () => {
    expect(isHomeAllCaughtUp(clear)).toBe(true);
  });

  it("is false when there are open tasks without a near due date", () => {
    expect(isHomeAllCaughtUp({ ...clear, openTasksTotal: 3 })).toBe(false);
  });

  it("is false when there are overdue tasks", () => {
    expect(isHomeAllCaughtUp({ ...clear, overdueTotal: 2 })).toBe(false);
  });

  it("is false when there is upcoming focus or attention", () => {
    expect(isHomeAllCaughtUp({ ...clear, upcomingFocusCount: 1 })).toBe(false);
    expect(isHomeAllCaughtUp({ ...clear, attentionItemCount: 1 })).toBe(false);
  });
});