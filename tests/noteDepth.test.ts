import { describe, it, expect } from "vitest";
import { getNoteDepth, isEligibleEmailInboxParent } from "@/lib/notes/noteDepth";

describe("noteDepth", () => {
  const notes = [
    { id: "root", parentNoteId: null },
    { id: "child", parentNoteId: "root" },
    { id: "grandchild", parentNoteId: "child" },
  ];

  it("computes depth for root, child, and grandchild", () => {
    expect(getNoteDepth("root", notes)).toBe(0);
    expect(getNoteDepth("child", notes)).toBe(1);
    expect(getNoteDepth("grandchild", notes)).toBe(2);
  });

  it("allows inbox parents at depth 0 and 1 only", () => {
    expect(isEligibleEmailInboxParent(0)).toBe(true);
    expect(isEligibleEmailInboxParent(1)).toBe(true);
    expect(isEligibleEmailInboxParent(2)).toBe(false);
  });
});