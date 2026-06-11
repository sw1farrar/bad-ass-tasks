#!/usr/bin/env node
/**
 * Phase 2 migration: accent hex, white/black utilities, ring offsets → semantic tokens.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const REPLACEMENTS = [
  ["text-[#00ff9f]", "text-neon-green"],
  ["bg-[#00ff9f]", "bg-neon-green"],
  ["border-[#00ff9f]", "border-neon-green"],
  ["ring-[#00ff9f]", "ring-neon-green"],
  ["text-[#34d399]", "text-neon-green"],
  ["bg-[#34d399]", "bg-neon-green"],
  ["border-[#34d399]", "border-neon-green"],
  ["text-[#ff3366]", "text-[var(--priority-p0)]"],
  ["bg-[#ff3366]", "bg-[var(--priority-p0)]"],
  ["border-[#ff3366]", "border-[var(--priority-p0)]"],
  ["hover:text-[#ff3366]", "hover:text-[var(--priority-p0)]"],
  ["hover:bg-[#ff3366]", "hover:bg-[var(--priority-p0)]"],
  ["text-[#ff9500]", "text-[var(--priority-p1)]"],
  ["border-[#ff9500]", "border-[var(--priority-p1)]"],
  ["text-[#fbbf24]", "text-[var(--priority-p2)]"],
  ["text-[#ff00aa]", "text-neon-pink"],
  ["text-[#a855f7]", "text-neon-purple-dark"],
  ["bg-[#a855f7]", "bg-neon-purple-dark"],
  ["hover:bg-[#a855f7]", "hover:bg-neon-purple-dark"],
  ["from-[#a855f7]", "from-neon-purple-dark"],
  ["via-[#c084fc]", "via-neon-purple"],
  ["text-[#d8b4fe]", "text-neon-purple-tint"],
  ["hover:text-[#d8b4fe]", "hover:text-neon-purple-tint"],
  ["active:text-[#e0a8ff]", "active:text-neon-purple-tint"],
  ["text-[#e9d5ff]", "text-neon-purple-tint"],
  ["bg-[#e9d5ff]", "bg-neon-purple-tint"],
  ["text-[#7c3aed]", "text-neon-purple-dark"],
  ["bg-[#7c3aed]", "bg-neon-purple-dark"],
  ["border-[#7c3aed]", "border-neon-purple-dark"],
  ["text-[#9333ea]", "text-neon-purple-dark"],
  ["text-[#be123c]", "text-[var(--priority-p0)]"],
  ["text-[#9f1239]", "text-[var(--priority-p0)]"],
  ["from-[#9f1239]", "from-[var(--priority-p0)]"],
  ["to-[#be123c]", "to-[var(--priority-p0)]"],
  ["border-[#fb7185]/35", "border-[var(--priority-p0)]/35"],
  ["text-[#fda4af]", "text-[var(--priority-p0)]/70"],
  ["hover:bg-[#be123c]/15", "hover:bg-[var(--priority-p0)]/15"],
  ["hover:bg-[#be123c]", "hover:bg-[var(--priority-p0)]"],
  ["bg-[#be123c]", "bg-[var(--priority-p0)]"],
  ["border-[#3a3a42]", "border-border"],
  ["ring-[#0a0a0f]", "ring-bg"],
  ["ring-offset-[#0a0a0f]", "ring-offset-bg"],
  ["text-[#0a0a0f]", "text-accent-on"],
  ["border-white/30", "border-border-glass"],
  ["border-white/20", "border-border-glass"],
  ["border-white/[0.08]", "border-border-glass"],
  ["border-white/[0.06]", "border-border-subtle"],
  ["hover:border-white/20", "hover:border-border-glass"],
  ["hover:border-white/30", "hover:border-border-glass"],
  ["bg-black/[0.88]", "overlay-scrim"],
  ["bg-black/[0.9]", "overlay-scrim"],
  ["bg-black/50", "overlay-scrim"],
  ["bg-black/40", "overlay-scrim"],
  ["bg-[#ff3366]/10", "bg-[var(--priority-p0)]/10"],
  ["hover:bg-[#ff3366]/10", "hover:bg-[var(--priority-p0)]/10"],
  ["hover:bg-[#00ff9f]/10", "hover:bg-neon-green/10"],
  ["bg-[#00ff9f]/10", "bg-neon-green/10"],
  ["border-[#00ff9f]/20", "border-neon-green/20"],
  ["border-[#ff9500]/35", "border-[var(--priority-p1)]/35"],
  ["border-[#ff9500]/40", "border-[var(--priority-p1)]/40"],
  ["bg-[#00ff9f]/30", "bg-neon-green/30"],
  ["bg-black/20", "bg-surface-elevated"],
  ["bg-black/30", "bg-surface-elevated"],
  ["bg-white/10", "bg-surface-hover"],
  ["hover:bg-neon-green/90", "hover:bg-neon-green/90"],
  ["bg-neon-green hover:bg-neon-green/90", "bg-neon-green hover:bg-neon-green/90"],
  ["bg-[#00ff9f] hover:bg-[#00ff9f]/90", "bg-neon-green hover:bg-neon-green/90"],
  ["hover:bg-[#00ff9f]/90", "hover:bg-neon-green/90"],
  ["bg-red-600/90 text-white", "bg-[var(--priority-p0)] text-accent-on"],
  ["bg-[var(--priority-p0)] text-white", "bg-[var(--priority-p0)] text-accent-on"],
  ["bg-neon-green text-white", "bg-neon-green text-accent-on"],
];

const SKIP_FILES = new Set([
  "components/ImagePreviewModal.tsx",
  "features/notes/editor/components/ImagePreviewModal.tsx",
  "components/FilePreviewModal.tsx",
  "components/PreviewMobileActions.tsx",
  "components/PdfAnnotationPreview.tsx",
  "components/LandingPage.tsx",
  "components/Confetti.tsx",
]);

const EXTENSIONS = new Set([".tsx", ".ts"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git", "terminals", "scripts"]);

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
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (SKIP_FILES.has(rel)) continue;

  let content = fs.readFileSync(file, "utf8");
  let fileReplacements = 0;

  for (const [from, to] of REPLACEMENTS) {
    const parts = content.split(from);
    if (parts.length > 1) {
      fileReplacements += parts.length - 1;
      content = parts.join(to);
    }
  }

  if (fileReplacements > 0) {
    fs.writeFileSync(file, content);
    changedFiles++;
    totalReplacements += fileReplacements;
    console.log(`${rel}: ${fileReplacements}`);
  }
}

console.log(`\nDone: ${totalReplacements} replacements in ${changedFiles} files`);