import { describe, expect, it } from "vitest";
import { isBenignBrowserError } from "@/lib/logger";

describe("isBenignBrowserError", () => {
  it("ignores ResizeObserver loop noise", () => {
    expect(
      isBenignBrowserError("ResizeObserver loop completed with undelivered notifications."),
    ).toBe(true);
    expect(isBenignBrowserError("ResizeObserver loop limit exceeded")).toBe(true);
  });

  it("ignores sandboxed srcdoc script blocking noise", () => {
    expect(
      isBenignBrowserError(
        "Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.",
      ),
    ).toBe(true);
  });

  it("does not ignore real application errors", () => {
    expect(isBenignBrowserError("TypeError: Cannot read properties of undefined")).toBe(false);
    expect(isBenignBrowserError("Preview unavailable")).toBe(false);
  });
});