import { describe, expect, it } from "vitest";
import {
  flattenColorOverBackground,
  getListColorPresentation,
  getListColorStyleForTheme,
  getListColorsForTheme,
} from "@/lib/lists/listColorStyles";

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

describe("getListColorPresentation", () => {
  it("returns translucent dark card colors by default", () => {
    expect(getListColorPresentation("purple", "dark").bg).toBe("rgba(124, 58, 237, 0.28)");
  });

  it("returns opaque drawer colors in dark mode when requested", () => {
    const opaque = getListColorPresentation("purple", "dark", { opaque: true });
    expect(opaque.bg).toBe("#352359");
    expect(opaque.border).toBe("#5e5088");
    expect(opaque.bg).not.toContain("rgba");
  });

  it("keeps light mode colors unchanged when opaque is requested", () => {
    expect(getListColorPresentation("purple", "light", { opaque: true }).bg).toBe("#ede9fe");
  });
});

describe("flattenColorOverBackground", () => {
  it("composites rgba over the dark drawer base", () => {
    expect(flattenColorOverBackground("rgba(124, 58, 237, 0.28)")).toBe("#352359");
  });

  it("returns hex colors unchanged", () => {
    expect(flattenColorOverBackground("#1c1c22")).toBe("#1c1c22");
  });
});