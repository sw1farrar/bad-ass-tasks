import { describe, expect, it } from "vitest";
import {
  EMAIL_IFRAME_MIN_HEIGHT_PX,
  EMAIL_IFRAME_SANDBOX,
  measureEmailIframeContentHeight,
} from "@/lib/notes/emailIframe";

describe("emailIframe", () => {
  it("exports sandbox flags required for parent height measurement", () => {
    expect(EMAIL_IFRAME_SANDBOX).toContain("allow-same-origin");
    expect(EMAIL_IFRAME_SANDBOX).not.toContain("allow-scripts");
  });

  it("measureEmailIframeContentHeight uses email-message-root scroll height", () => {
    const doc = document.implementation.createHTMLDocument("email");
    doc.body.innerHTML = `
      <div class="email-message-root" style="height: 480px; overflow: hidden;">
        <p>Long email body</p>
      </div>
    `;
    const root = doc.body.querySelector(".email-message-root") as HTMLElement;
    Object.defineProperty(root, "scrollHeight", { value: 920, configurable: true });
    Object.defineProperty(root, "offsetHeight", { value: 480, configurable: true });

    expect(measureEmailIframeContentHeight(doc)).toBe(928);
  });

  it("measureEmailIframeContentHeight falls back to minimum", () => {
    const doc = document.implementation.createHTMLDocument("empty");
    expect(measureEmailIframeContentHeight(doc)).toBe(EMAIL_IFRAME_MIN_HEIGHT_PX);
  });
});