import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(process.cwd(), "features/tasks/tasks-workspace.css"),
  "utf8",
);

/** Relative luminance, 0–1. */
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbDistance(a: string, b: string): number {
  const parts = (hex: string) =>
    [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16));
  const [ar, ag, ab] = parts(a);
  const [br, bg, bb] = parts(b);
  return Math.hypot(ar - br, ag - bg, ab - bb);
}

describe("task detail notes selection", () => {
  it("paints an opaque selection highlight on modal text fields", () => {
    expect(css).toMatch(/\.task-detail-modal\.modal-panel ::selection\s*\{[^}]*background:\s*#7c3aed/s);
    expect(css).toMatch(/\.task-detail-modal\.modal-panel ::-moz-selection\s*\{[^}]*background:\s*#7c3aed/s);
    expect(css).not.toMatch(/\.task-detail-modal\.modal-panel ::selection\s*\{[^}]*accent-purple-subtle/s);

    // Notes surface is #25252b. The old highlight composites to about #292141
    // (distance ~15) and disappears. #7c3aed is a different hue, and white
    // text on it stays readable.
    const notesSurface = "#25252b";
    const selection = "#7c3aed";
    const invisible = "#292141";
    expect(rgbDistance(selection, notesSurface)).toBeGreaterThan(150);
    expect(rgbDistance(invisible, notesSurface)).toBeLessThan(30);
    expect(contrastRatio("#ffffff", selection)).toBeGreaterThan(4.5);
  });

  it("keeps notes and comment fields selectable, including on touch", () => {
    expect(css).toMatch(
      /\.task-detail-modal\.modal-panel textarea[\s\S]*?-webkit-user-select:\s*text;[\s\S]*?user-select:\s*text;/,
    );
    expect(css).toMatch(/\.task-detail-modal\.mobile-bottom-sheet\s*\{[^}]*touch-action:\s*manipulation/s);
    expect(css).toMatch(
      /\.task-detail-modal\.mobile-bottom-sheet\.bottom-sheet-panel--dragging[\s\S]*?touch-action:\s*none/,
    );
  });
});
