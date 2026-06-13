import { describe, expect, it } from "vitest";
import { computeScaledDimensions } from "@/lib/images/compressPhotoForUpload";

describe("computeScaledDimensions", () => {
  it("keeps dimensions when already within the max edge", () => {
    expect(computeScaledDimensions(1200, 800, 1400)).toEqual({ width: 1200, height: 800 });
  });

  it("scales down the long edge to the max", () => {
    expect(computeScaledDimensions(4032, 3024, 1400)).toEqual({ width: 1400, height: 1050 });
  });

  it("handles portrait photos", () => {
    expect(computeScaledDimensions(3024, 4032, 1400)).toEqual({ width: 1050, height: 1400 });
  });
});