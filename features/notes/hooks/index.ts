/**
 * Notes hooks barrel (M0 prep).
 * Planned: useBacklinks, useNoteEditor, etc. (bidir linking logic).
 *
 * === Agent 1 (Editor Migration Support Wave) 2026-05-25 ===
 * Safe parallel prep: comment enhanced during monitoring of Batch 1 TipTapEditor move.
 * Ready for future useNote* once editor lands and later extractions.
 */

export { useNoteOperations, type CreateTaskAndLinkOptions } from "./useNoteOperations";
export { useNoteHistory } from "./useNoteHistory";
export { useBacklinks } from "./useBacklinks";
export { useNoteKeyboard } from "./useNoteKeyboard";
export { useNoteSearch } from "./useNoteSearch";
export { useMentions, extractMentionsFromDoc, type MentionRef } from "./useMentions";
export { getBacklinkNotes, getBacklinkCount } from "./useBacklinks";
export { useNoteAttachmentCounts } from "./useNoteAttachmentCounts";

