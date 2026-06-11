#!/usr/bin/env node
/** Migrate workspace CSS hardcoded colors → CSS variables */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CSS_FILES = [
  "features/lists/lists-workspace.css",
  "features/tasks/tasks-workspace.css",
  "features/files/files-workspace.css",
  "features/notes/notes-workspace.css",
  "features/teams/teams-workspace.css",
  "features/admin/site-admin.css",
  "features/notes/editor/notes-editor.css",
  "app/globals.css",
];

const REPLACEMENTS = [
  ["#c084fc", "var(--neon-purple)"],
  ["#0a0a0f", "var(--bg)"],
  ["#f4f4f5", "var(--text-primary)"],
  ["#71717a", "var(--text-muted)"],
  ["#a1a1aa", "var(--text-secondary)"],
  ["#e4e4e7", "var(--text-soft)"],
  ["#fafafa", "var(--text-primary)"],
  ["#d4d4d8", "var(--text-soft)"],
  ["#e9d5fe", "var(--accent-purple-text)"],
  ["#f3e8ff", "var(--accent-purple-text-active)"],
  ["#faf5ff", "var(--accent-purple-text-active)"],
  ["#7c3aed", "var(--neon-purple-dark)"],
  ["#9333ea", "var(--neon-purple-dark)"],
  ["#ff3366", "var(--priority-p0)"],
  ["#34d399", "var(--success)"],
  ["#e11d48", "var(--priority-p0)"],
  ["#9f1239", "var(--overdue-solid)"],
  ["#ffe4e6", "var(--overdue-text)"],
  ["#fff1f2", "var(--overdue-text)"],
  ["rgba(255, 255, 255, 0.28)", "var(--control-border)"],
  ["rgba(255, 255, 255, 0.12)", "var(--border-glass)"],
  ["rgba(255, 255, 255, 0.1)", "var(--border-glass)"],
  ["rgba(255, 255, 255, 0.08)", "var(--divider)"],
  ["rgba(255, 255, 255, 0.06)", "var(--accent-purple-muted)"],
  ["rgba(255, 255, 255, 0.04)", "var(--surface-hover)"],
  ["rgba(255, 255, 255, 0.03)", "var(--surface-hover)"],
  ["rgba(255, 255, 255, 0.02)", "var(--surface-hover)"],
  ["rgba(255, 255, 255, 0.15)", "var(--border-dashed)"],
  ["rgba(255, 255, 255, 0.14)", "var(--tree-line)"],
  ["rgba(255, 255, 255, 0.2)", "var(--tree-node)"],
  ["rgba(192, 132, 252, 0.12)", "var(--accent-purple-subtle)"],
  ["rgba(192, 132, 252, 0.15)", "var(--accent-purple-glow)"],
  ["rgba(192, 132, 252, 0.2)", "var(--accent-purple-glow)"],
  ["rgba(192, 132, 252, 0.25)", "var(--accent-purple-border)"],
  ["rgba(192, 132, 252, 0.28)", "var(--accent-purple-border)"],
  ["rgba(192, 132, 252, 0.35)", "var(--accent-purple-border)"],
  ["rgba(192, 132, 252, 0.4)", "var(--accent-purple-border)"],
  ["rgba(192, 132, 252, 0.45)", "var(--accent-purple-border)"],
  ["rgba(192, 132, 252, 0.55)", "var(--neon-purple)"],
  ["rgba(192, 132, 252, 0.06)", "var(--accent-purple-muted)"],
  ["rgba(192, 132, 252, 0.08)", "var(--accent-purple-muted)"],
  ["rgba(20, 20, 24, 0.96)", "var(--glass-strong-bg)"],
  ["rgba(0, 0, 0, 0.25)", "var(--shadow-color)"],
  ["rgba(0, 0, 0, 0.35)", "var(--shadow-color)"],
  ["rgba(0, 0, 0, 0.45)", "var(--shadow-color)"],
  ["rgba(127, 29, 45, 0.55)", "var(--overdue-bg)"],
  ["rgba(159, 18, 57, 0.65)", "var(--overdue-bg-active)"],
  ["rgba(190, 18, 60, 0.75)", "var(--overdue-border)"],
  ["rgba(190, 18, 60, 0.55)", "var(--overdue-pulse)"],
  ["rgba(190, 18, 60, 0.35)", "var(--overdue-glow)"],
  ["rgba(255, 51, 102, 0.14)", "var(--danger-subtle)"],
  ["rgba(255, 51, 102, 0.35)", "var(--overdue-border)"],
  ["color: #fff", "color: var(--on-accent)"],
  ["color: #fff;", "color: var(--on-accent);"],
  ["background: #fff", "background: var(--bg-secondary)"],
];

let total = 0;
for (const rel of CSS_FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, "utf8");
  let n = 0;
  for (const [from, to] of REPLACEMENTS) {
    const parts = content.split(from);
    if (parts.length > 1) {
      n += parts.length - 1;
      content = parts.join(to);
    }
  }
  if (n > 0) {
    fs.writeFileSync(file, content);
    console.log(`${rel}: ${n}`);
    total += n;
  }
}
console.log(`\nDone: ${total} CSS replacements`);