/**
 * Extensions barrel for TipTap editor (M0 prep skeleton).
 *
 * Planned:
 * - mention.ts : MentionMark custom Mark for @ / [[ ]] bidirectional pills (refType: task|note|external)
 * - (future) task-embed.ts, etc.
 *
 * Currently (pre-migration): MentionMark defined inline in components/TipTapEditor.tsx
 *
 * === Agent 1 (Parallel Support Wave) 2026-05-25 Update ===
 * Barrel ready. Awaiting Batch 1 move of TipTapEditor.tsx (which will import from here post-extract).
 * Guard: No hybridStore access in this domain. Pure UI extensions.
 */

// TaskEmbed - live editable task cards inside notes (Milestone 2 core feature)
export { TaskEmbed, default as TaskEmbedNode } from "./task-embed";

// DatabaseBlock - real interactive database views inside notes (M2 parallel work)
export { DatabaseBlock } from "./database-block";
