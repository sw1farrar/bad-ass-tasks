import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(process.cwd(), "features/tasks/tasks-workspace.css"),
  "utf8",
);
const tokens = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
const modal = readFileSync(resolve(process.cwd(), "components/TaskModal.tsx"), "utf8");
const editor = readFileSync(
  resolve(process.cwd(), "features/tasks/components/TaskRecurrenceEditor.tsx"),
  "utf8",
);

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

function themeVar(source: string, theme: "dark" | "light", name: string): string {
  const block =
    theme === "dark"
      ? source.match(/:root,\s*\[data-theme="dark"\]\s*\{([^}]+)\}/)
      : source.match(/\[data-theme="light"\]\s*\{([^}]+)\}/);
  const value = block?.[1].match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!value) throw new Error(`missing ${theme} ${name}`);
  return value[1];
}

function ruleColor(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*\\{[^}]*background:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`missing background on ${selector}`);
  return match[1];
}

describe("task detail modal polish", () => {
  it("puts a Close control on the same dismiss path as Done", () => {
    expect(modal).toMatch(
      /onClick=\{handleSheetClose\}[\s\S]{0,240}aria-label="Close"/,
    );
    expect(modal).toMatch(/max-\[768px\]:min-h-\[44px\] max-\[768px\]:min-w-\[44px\]/);
    expect(modal).toMatch(/task-detail-title/);
  });

  it("aligns the title text inset with the notes field", () => {
    expect(css).toMatch(
      /\.task-detail-modal \.task-detail-title\s*\{[^}]*border-width:\s*1px;[^}]*padding-left:\s*0\.75rem;/s,
    );
    expect(modal).toMatch(/className="input w-full h-full min-h-\[64px\] p-3/);
    expect(modal).toMatch(/className="input w-full min-h-\[120px\] p-3/);
  });

  it("gives the repeat switch a visible track in both states", () => {
    const off = ruleColor(css, ".task-repeat-switch");
    const on = ruleColor(css, '.task-repeat-switch[aria-checked="true"]');
    const thumb = ruleColor(css, ".task-repeat-switch__thumb");
    const darkBg = "#1a1a1f";
    const lightBg = "#ffffff";

    expect(off).not.toBe("transparent");
    expect(contrastRatio(off, darkBg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(off, lightBg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(thumb, off)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(thumb, on)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(on, lightBg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(on, darkBg)).toBeGreaterThanOrEqual(3);
  });

  it("makes repeat helper copy larger and easier to read than muted grey", () => {
    expect(editor).toContain('className="task-repeat-helper mt-0.5 leading-snug"');
    expect(editor).not.toMatch(/text-\[10px\] text-text-muted mt-0\.5/);
    expect(css).toMatch(/\.task-repeat-helper\s*\{[^}]*font-size:\s*0\.8125rem;/s);
    expect(css).toMatch(/\.task-repeat-helper\s*\{[^}]*color:\s*var\(--text-soft\)/s);

    const darkSoft = themeVar(tokens, "dark", "--text-soft");
    const darkMuted = themeVar(tokens, "dark", "--text-muted");
    const darkPrimary = themeVar(tokens, "dark", "--text-primary");
    const lightSoft = themeVar(tokens, "light", "--text-soft");
    const lightMuted = themeVar(tokens, "light", "--text-muted");
    const lightPrimary = themeVar(tokens, "light", "--text-primary");

    expect(darkSoft).not.toBe(darkPrimary);
    expect(lightSoft).not.toBe(lightPrimary);
    expect(contrastRatio(darkSoft, "#1a1a1f")).toBeGreaterThan(contrastRatio(darkMuted, "#1a1a1f"));
    expect(contrastRatio(lightSoft, "#ffffff")).toBeGreaterThan(contrastRatio(lightMuted, "#ffffff"));
    expect(contrastRatio(darkSoft, "#1a1a1f")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(lightSoft, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("lets the phone header strip dismiss without stealing notes selection", () => {
    expect(css).toMatch(
      /\.task-detail-modal\.mobile-bottom-sheet \.task-sheet-header,\s*\.task-detail-modal\.mobile-bottom-sheet \.task-sheet-header \*\s*\{[^}]*touch-action:\s*none/s,
    );
    expect(css).toMatch(
      /\.task-detail-modal\.mobile-bottom-sheet \.task-sheet-header :is\(button, a, input, textarea, select\)[\s\S]*?touch-action:\s*manipulation/s,
    );
    expect(css).toMatch(/\.task-detail-modal\.mobile-bottom-sheet\s*\{[^}]*touch-action:\s*manipulation/s);
    expect(css).toMatch(/\.task-detail-modal\.modal-panel ::selection\s*\{[^}]*background:\s*#7c3aed/s);
  });
});
