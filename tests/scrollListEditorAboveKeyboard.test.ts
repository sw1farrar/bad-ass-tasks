import { describe, expect, it } from "vitest";
import { editorScrollDelta } from "@/lib/lists/scrollListEditorAboveKeyboard";

describe("editorScrollDelta", () => {
  const band = { visibleTop: 200, visibleBottom: 520 };

  it("scrolls a row that sits below the fold up until it clears the keyboard", () => {
    expect(
      editorScrollDelta({
        ...band,
        editorTop: 560,
        editorBottom: 608,
      }),
    ).toBe(100);
  });

  it("scrolls a row that is partly under the keyboard until every line is inside the band", () => {
    expect(
      editorScrollDelta({
        ...band,
        editorTop: 470,
        editorBottom: 560,
      }),
    ).toBe(52);
  });

  it("leaves a row that is already fully visible where it is", () => {
    expect(
      editorScrollDelta({
        ...band,
        editorTop: 240,
        editorBottom: 300,
      }),
    ).toBe(0);
  });

  it("scrolls a row that is above the visible band back down", () => {
    expect(
      editorScrollDelta({
        ...band,
        editorTop: 140,
        editorBottom: 188,
      }),
    ).toBe(-72);
  });

  it("pins a row taller than the visible band to the bottom so the last lines stay uncovered", () => {
    expect(
      editorScrollDelta({
        ...band,
        editorTop: 180,
        editorBottom: 700,
      }),
    ).toBe(192);
  });
});
