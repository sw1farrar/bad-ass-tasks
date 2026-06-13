import { describe, expect, it } from "vitest";
import { formatBytes } from "@/lib/files/formatBytes";

describe("formatBytes", () => {
  it("formats bytes, kilobytes, and megabytes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(1_572_864)).toBe("1.5 MB");
  });

  it("returns empty string for invalid or zero sizes", () => {
    expect(formatBytes(0)).toBe("");
    expect(formatBytes(-1)).toBe("");
  });
});