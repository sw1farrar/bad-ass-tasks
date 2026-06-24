import { describe, expect, it } from "vitest";
import { sortProgressEntriesNewestFirst } from "@/lib/notebooks/progressEntries";

describe("sortProgressEntriesNewestFirst", () => {
  it("orders entries with the most recent createdAt first", () => {
    const sorted = sortProgressEntriesNewestFirst([
      { id: "old", createdAt: "2026-01-01T10:00:00.000Z" },
      { id: "new", createdAt: "2026-01-03T10:00:00.000Z" },
      { id: "mid", createdAt: "2026-01-02T10:00:00.000Z" },
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["new", "mid", "old"]);
  });
});