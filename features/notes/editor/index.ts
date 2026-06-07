/**
 * Barrel for the rich Notes Editor domain (colocated TipTap implementation).
 *
 * M0 Folder Migration Prep: Barrel created as safe non-destructive step.
 * No code moved yet. All editor logic (MentionMark, slash registry, AI polish,
 * bidirectional linking UI, version snapshots, live cursors) remains in
 * components/TipTapEditor.tsx for now.
 *
 * Planned structure (per 2026 research):
 *   TipTapEditor.tsx
 *   extensions/
 *     mention.ts (extract MentionMark + attrs for refType bidirectional)
 *     embeds.ts (future TaskEmbedNode, etc.)
 *   commands/
 *     slash.ts (slashCommandsBase registry + scoring/filter)
 *   ai/
 *     transforms.ts (editor-specific wrappers around aiTransformText*)
 *   collab/
 *     cursors.ts (live cursor hooks, future Yjs)
 *
 * Backward compat: After move, components/TipTapEditor.tsx will re-export from here.
 *
 * Guard note: This module must never import or call hybridStore functions
 * bypassing isSupabaseLive() / w1/w2 demo ID blocks. Editor is pure client UI.
 *
 * @see M0-Folder-Migration-Plan.md for exact move diffs and proposal.
 *
 * === Agent 1 (Parallel Support Wave for M0 Editor Batch 1) - 2026-05-25 ===
 * STATUS: Awaiting migration writes to begin (target: features/notes/editor/TipTapEditor.tsx).
 * Current FS: Only skeleton barrels + migration notes present. Source still monolithic in components/.
 * Prep complete: 20+ barrels (this + subs + notes/ level) with guard warnings ready.
 * Role: Real-time monitor for writes, safe parallel comment/docs prep, immediate post-land guard re-audit on new file + shim.
 * All consumers (app/page.tsx, tests/TipTapEditor.test.tsx) protected via planned shim at components/TipTapEditor.tsx.
 * Next action trigger: Detect new TipTapEditor.tsx in editor/ dir (or shim overwrite).
 */

// Main editor component
export { TipTapEditor } from "./TipTapEditor";

// Extensions (Milestone 2+)
export * from "./extensions";
