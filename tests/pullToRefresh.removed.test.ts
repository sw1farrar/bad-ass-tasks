import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

describe("pull-to-refresh removed", () => {
  it("does not mount the PWA pull-to-refresh hook or indicator", () => {
    const page = readFileSync(resolve(root, "app/page.tsx"), "utf8");
    expect(page).not.toMatch(/usePullToRefresh/);
    expect(page).not.toMatch(/pull-to-refresh-indicator/);
    expect(page).not.toMatch(/canStartPullToRefresh/);
    expect(page).toMatch(/handleWorkspaceRefresh/);
    expect(page).toMatch(/Refresh workspace/);
  });

  it("does not keep the PTR hook or CSS", () => {
    expect(() => readFileSync(resolve(root, "lib/hooks/usePullToRefresh.ts"))).toThrow();
    const css = readFileSync(resolve(root, "app/globals.css"), "utf8");
    expect(css).not.toMatch(/\.pull-to-refresh-indicator/);
  });
});
