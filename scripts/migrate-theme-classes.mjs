#!/usr/bin/env node
/**
 * One-time migration: replace hardcoded dark hex / white-opacity utilities
 * with semantic theme-aware Tailwind classes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const REPLACEMENTS = [
  ["bg-[#0a0a0f]/95", "bg-bg/95"],
  ["bg-[#0a0a0f]/60", "bg-bg/60"],
  ["bg-[#0a0a0f]", "bg-bg"],
  ["bg-[#0a0a0a]", "bg-bg"],
  ["bg-[#111114]/95", "bg-bg-secondary/95"],
  ["bg-[#111114]", "bg-bg-secondary"],
  ["bg-[#0f0f12]", "bg-bg-panel"],
  ["bg-[#141418]", "bg-bg-card"],
  ["bg-[#141416]", "bg-bg-card"],
  ["bg-[#18181b]/95", "bg-bg-tertiary/95"],
  ["bg-[#18181b]", "bg-bg-tertiary"],
  ["bg-[#1a1a1f]", "bg-bg-elevated"],
  ["text-[#faf5ff]", "text-neon-purple-tint"],
  ["text-[#e9d5ff]", "text-neon-purple-tint"],
  ["text-[#f4f4f5]", "text-text-primary"],
  ["text-[#e4e4e7]", "text-text-primary"],
  ["text-[#e5e5e7]", "text-text-primary"],
  ["text-[#d4d4d8]", "text-text-soft"],
  ["text-[#a1a1aa]", "text-text-secondary"],
  ["text-[#71717a]", "text-text-muted"],
  ["text-[#52525b]", "text-text-faint"],
  ["text-[#c084fc]", "text-neon-purple"],
  ["bg-[#c084fc]", "bg-neon-purple"],
  ["border-[#c084fc]", "border-neon-purple"],
  ["ring-[#c084fc]", "ring-neon-purple"],
  ["accent-[#c084fc]", "accent-neon-purple"],
  ["from-[#c084fc]", "from-neon-purple"],
  ["to-[#a855f7]", "to-neon-purple-dark"],
  ["hover:text-white", "hover:text-text-primary"],
  ["border-white/15", "border-border-glass"],
  ["border-white/12", "border-border-glass"],
  ["border-white/10", "border-border-glass"],
  ["border-white/5", "border-border-glass/60"],
  ["divide-white/5", "divide-border-glass/60"],
  ["divide-white/10", "divide-border-glass"],
  ["hover:bg-white/10", "hover:bg-surface-hover"],
  ["hover:bg-white/5", "hover:bg-surface-hover"],
  ["hover:bg-white/[0.03]", "hover:bg-surface-hover"],
  ["bg-white/[0.02]", "bg-surface-hover/50"],
  ["bg-white/8", "bg-surface-hover"],
  ["bg-white/5", "bg-surface-hover"],
  ["bg-white/6", "bg-surface-hover"],
  ["bg-black/80", "overlay-scrim"],
  ["bg-black/75", "overlay-scrim"],
  ["bg-black/70", "overlay-scrim"],
  ["bg-black/60", "overlay-scrim"],
];

const EXTENSIONS = new Set([".tsx", ".ts", ".css"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git", "terminals"]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

let changedFiles = 0;
let totalReplacements = 0;

for (const file of walk(ROOT)) {
  if (file.includes(`${path.sep}scripts${path.sep}migrate-theme-classes.mjs`)) continue;
  let content = fs.readFileSync(file, "utf8");
  let fileChanged = false;
  for (const [from, to] of REPLACEMENTS) {
    const count = content.split(from).length - 1;
    if (count > 0) {
      content = content.split(from).join(to);
      totalReplacements += count;
      fileChanged = true;
    }
  }
  if (fileChanged) {
    fs.writeFileSync(file, content, "utf8");
    changedFiles += 1;
    console.log(path.relative(ROOT, file));
  }
}

console.log(`\nDone: ${totalReplacements} replacements across ${changedFiles} files.`);