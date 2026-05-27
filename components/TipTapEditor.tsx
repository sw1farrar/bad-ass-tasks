"use client";

// Backward-compatible re-export during M0 transition (additive, zero breakage).
// After full verification + import updates across codebase, this shim can be deleted.
// All consumers (page.tsx + any handoff tests/docs) continue working unchanged.

export { TipTapEditor } from "@/features/notes/editor/TipTapEditor";

// (Optional: re-export the MentionMark type if ever externalized)