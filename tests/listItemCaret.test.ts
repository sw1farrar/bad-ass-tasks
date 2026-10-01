import { describe, expect, it } from "vitest";
import {
  isFullTextSelection,
  listItemCaretPlacement,
  listItemCaretRange,
} from "@/lib/lists/listItemCaret";

describe("listItemCaretPlacement", () => {
  it("puts the mobile caret at the end of an existing item", () => {
    expect(listItemCaretPlacement(true)).toBe("end");
    expect(listItemCaretRange("Buy milk".length, "end")).toEqual({ start: 8, end: 8 });
  });

  it("keeps desktop select-all", () => {
    expect(listItemCaretPlacement(false)).toBe("select-all");
    expect(listItemCaretRange("Buy milk".length, "select-all")).toEqual({ start: 0, end: 8 });
  });

  it("treats an empty item as a collapsed caret", () => {
    expect(listItemCaretRange(0, "end")).toEqual({ start: 0, end: 0 });
    expect(listItemCaretRange(0, "select-all")).toEqual({ start: 0, end: 0 });
    expect(isFullTextSelection(0, 0, 0)).toBe(false);
  });

  it("recognizes a select-all that iOS still needs to collapse", () => {
    expect(isFullTextSelection(8, 0, 8)).toBe(true);
    expect(isFullTextSelection(8, 8, 8)).toBe(false);
    expect(isFullTextSelection(8, 3, 3)).toBe(false);
  });
});
