import { describe, expect, it } from "vitest";
import {
  MOBILE_SHEET_HEIGHT_CLASS,
  MOBILE_SHEET_HEIGHT_90_CLASS,
  SHEET_DISMISS_FLICK_MIN_PX,
  SHEET_DISMISS_RATIO,
  shouldDismissSheet,
} from "@/lib/motion/sheet";

describe("shouldDismissSheet", () => {
  const sheetHeight = 700;

  it("dismisses after dragging about 15% of the sheet height", () => {
    expect(
      shouldDismissSheet({
        offsetY: sheetHeight * SHEET_DISMISS_RATIO + 1,
        velocityY: 0,
        sheetHeight,
      }),
    ).toBe(true);
  });

  it("dismisses a clear slow pull even if the finger stops", () => {
    expect(
      shouldDismissSheet({
        offsetY: 81,
        velocityY: 0,
        sheetHeight,
      }),
    ).toBe(true);
  });

  it("does not dismiss a short slow drag", () => {
    expect(
      shouldDismissSheet({
        offsetY: 40,
        velocityY: 80,
        sheetHeight,
      }),
    ).toBe(false);
  });

  it("dismisses a flick with minimum travel", () => {
    expect(
      shouldDismissSheet({
        offsetY: SHEET_DISMISS_FLICK_MIN_PX + 1,
        velocityY: 1100,
        sheetHeight,
      }),
    ).toBe(true);
  });

  it("does not dismiss a flick with almost no travel", () => {
    expect(
      shouldDismissSheet({
        offsetY: 10,
        velocityY: 2000,
        sheetHeight,
      }),
    ).toBe(false);
  });
});

describe("mobile sheet height token", () => {
  it("uses the full viewport class by default", () => {
    expect(MOBILE_SHEET_HEIGHT_CLASS).toBe("h-[100dvh] max-h-[100dvh]");
  });

  it("keeps a 90% opt-in token unused by default", () => {
    expect(MOBILE_SHEET_HEIGHT_90_CLASS).toBe("mobile-bottom-sheet--90");
  });
});
