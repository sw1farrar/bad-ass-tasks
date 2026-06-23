import { describe, expect, it, vi, afterEach } from "vitest";
import { isStandalonePwa } from "@/lib/pwa/isStandalonePwa";

describe("isStandalonePwa", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(isStandalonePwa()).toBe(false);
  });

  it("detects iOS navigator.standalone", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    vi.stubGlobal("navigator", { standalone: true });
    expect(isStandalonePwa()).toBe(true);
  });

  it("detects display-mode: standalone", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", {
      matchMedia: (query: string) => ({
        matches: query === "(display-mode: standalone)",
      }),
    });
    expect(isStandalonePwa()).toBe(true);
  });
});