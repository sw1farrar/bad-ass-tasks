/**
 * AI domain barrel (cross-cutting superpowers, 2026 target).
 *
 * M0 prep skeleton. Core AI logic (xaiClient, prompts, extract/generateBriefing/decomp/aiTransform)
 * currently lives in lib/utils.ts (to be extracted).
 *
 * Planned substructure:
 * - lib/xaiClient.ts (or adapters)
 * - prompts/ (structured prompt templates)
 * - hooks/useAIContext.ts (domain-aware: tasks+notes+graph)
 *
 * Editor AI stays co-located under features/notes/editor/ai/
 * All AI paths must honor hybrid demo/live (no direct DB; use store/hybrid).
 *
 * @see AGENT-RESEARCH-2026-ARCHITECTURE-FOLDER-STRUCTURE.md
 */

export {};
