import { describe, it, expect, beforeEach } from "vitest";
import {
  readSidebarDisplayMode,
  writeSidebarDisplayMode,
} from "@/lib/sidebarPreferences";

describe("sidebarPreferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to expanded when unset", () => {
    expect(readSidebarDisplayMode()).toBe("expanded");
  });

  it("persists all three display modes", () => {
    writeSidebarDisplayMode("hover-expand");
    expect(readSidebarDisplayMode()).toBe("hover-expand");

    writeSidebarDisplayMode("icons-only");
    expect(readSidebarDisplayMode()).toBe("icons-only");

    writeSidebarDisplayMode("expanded");
    expect(readSidebarDisplayMode()).toBe("expanded");
  });

  it("migrates legacy pinned/auto values", () => {
    localStorage.setItem("badazz-sidebar-pin-mode", "auto");
    expect(readSidebarDisplayMode()).toBe("hover-expand");
    expect(localStorage.getItem("badazz-sidebar-display-mode")).toBe("hover-expand");
  });
});