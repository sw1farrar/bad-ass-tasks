import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { hasOpenOverlay } from "@/lib/dom/hasOpenOverlay";

describe("hasOpenOverlay", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns false when no overlay is mounted", () => {
    expect(hasOpenOverlay()).toBe(false);
  });

  it("returns true when a dialog is mounted", () => {
    document.body.innerHTML = '<div role="dialog"></div>';
    expect(hasOpenOverlay()).toBe(true);
  });

  it("returns true when an alertdialog is mounted", () => {
    document.body.innerHTML = '<div role="alertdialog" aria-modal="true"></div>';
    expect(hasOpenOverlay()).toBe(true);
  });
});