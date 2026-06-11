import { describe, expect, it } from "vitest";
import { getListColorStyleForTheme, getListColorsForTheme } from "@/lib/lists/listColorStyles";

describe("getListColorStyleForTheme", () => {
  it("returns light pastels in light mode", () => {
    expect(getListColorStyleForTheme("amber", "light").bg).toBe("#fffbeb");
    expect(getListColorStyleForTheme("blue", "light").bg).toBe("#eff6ff");
  });

  it("keeps dark rgba palette in dark mode", () => {
    expect(getListColorStyleForTheme("amber", "dark").bg).toBe("rgba(250,204,21,0.1)");
  });

  it("exposes light palette for color pickers", () => {
    expect(getListColorsForTheme("light")).toHaveLength(6);
    expect(getListColorsForTheme("light")[0].bg).toBe("#ffffff");
  });
});