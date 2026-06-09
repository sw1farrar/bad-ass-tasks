import { describe, it, expect, beforeEach } from "vitest";
import { readSidebarPinMode, writeSidebarPinMode } from "@/lib/sidebarPreferences";

describe("sidebarPreferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to pinned when unset", () => {
    expect(readSidebarPinMode()).toBe("pinned");
  });

  it("persists auto mode", () => {
    writeSidebarPinMode("auto");
    expect(readSidebarPinMode()).toBe("auto");
  });
});