import { describe, expect, it } from "vitest";
import { resolveListItemEnterAction } from "@/lib/lists/listItemEnter";

describe("resolveListItemEnterAction", () => {
  it("blurs when insert is disabled", () => {
    expect(
      resolveListItemEnterAction({
        insertEnabled: false,
        selectionStart: 3,
        selectionEnd: 3,
        value: "abc",
      }),
    ).toBe("blur");
  });

  it("inserts when the caret is at the end", () => {
    expect(
      resolveListItemEnterAction({
        insertEnabled: true,
        selectionStart: 3,
        selectionEnd: 3,
        value: "abc",
      }),
    ).toBe("insert");
  });

  it("inserts when the full value is selected (title-edit select-all)", () => {
    expect(
      resolveListItemEnterAction({
        insertEnabled: true,
        selectionStart: 0,
        selectionEnd: 5,
        value: "hello",
      }),
    ).toBe("insert");
  });

  it("blurs when the caret is mid-text", () => {
    expect(
      resolveListItemEnterAction({
        insertEnabled: true,
        selectionStart: 1,
        selectionEnd: 1,
        value: "abc",
      }),
    ).toBe("blur");
  });

  it("stays on a whitespace-only row when caret is at the end", () => {
    expect(
      resolveListItemEnterAction({
        insertEnabled: true,
        selectionStart: 3,
        selectionEnd: 3,
        value: "   ",
      }),
    ).toBe("stay");
  });

  it("stays when whitespace-only text is fully selected", () => {
    expect(
      resolveListItemEnterAction({
        insertEnabled: true,
        selectionStart: 0,
        selectionEnd: 3,
        value: "   ",
      }),
    ).toBe("stay");
  });

  it("stays on a truly empty row", () => {
    expect(
      resolveListItemEnterAction({
        insertEnabled: true,
        selectionStart: 0,
        selectionEnd: 0,
        value: "",
      }),
    ).toBe("stay");
  });

  it("blurs partial mid selections", () => {
    expect(
      resolveListItemEnterAction({
        insertEnabled: true,
        selectionStart: 1,
        selectionEnd: 3,
        value: "hello",
      }),
    ).toBe("blur");
  });
});
