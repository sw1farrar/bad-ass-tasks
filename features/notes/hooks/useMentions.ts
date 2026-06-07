import { Note, Task } from "@/types";
import React from "react";

export type MentionRef = {
  label: string;
  refType?: "task" | "note" | string;
  refId?: string | null;
};

/**
 * Pure function: walk TipTap JSON doc and extract all mention marks.
 * This is the single source of truth for mention scanning (M2 bidirectional sync).
 * Moved to centralized hook for reuse across editor, NotesView, backlinks, etc.
 */
export function extractMentionsFromDoc(doc: any): MentionRef[] {
  const mentions: MentionRef[] = [];
  const walk = (node: any) => {
    if (node?.marks) {
      node.marks.forEach((m: any) => {
        if (m.type === "mention" && m.attrs) {
          mentions.push({
            label: m.attrs.label || "",
            refType: m.attrs.refType,
            refId: m.attrs.refId,
          });
        }
      });
    }
    if (node?.content) node.content.forEach(walk);
  };
  if (doc?.content) doc.content.forEach(walk);
  return mentions;
}

interface UseMentionsProps {
  notes: Note[];
  tasks: Task[];
  currentNoteId: string | null;

  // Callbacks for actual mutations (provided by useNoteOperations or parent)
  onLinkTaskToNote?: (noteId: string, taskId: string) => void | Promise<void>;
  onUnlinkTaskFromNote?: (noteId: string, taskId: string) => void | Promise<void>;
  onLinkNoteToNote?: (noteId: string, targetNoteId: string) => void | Promise<void>;
  onUnlinkNoteFromNote?: (noteId: string, targetNoteId: string) => void | Promise<void>;
}

/**
 * useMentions
 *
 * Centralizes all mention scanning, diffing, and automatic bidirectional link/unlink logic.
 * - Call onMentionsChanged(mentions) from the editor whenever content changes.
 * - Hook maintains last-seen set per note (auto-reset on note switch).
 * - Auto-creates links for newly detected real refs (task or note).
 * - Auto-removes links when a mention disappears from the document text (true symmetry).
 *
 * This replaces the duplicated handleMentionsChanged + lastMentionedRef logic
 * that was previously split between NotesView and inline code.
 *
 * All changes flow through the provided callbacks → store → hybrid (demo + live safe).
 */
export function useMentions({
  notes,
  tasks,
  currentNoteId,
  onLinkTaskToNote,
  onUnlinkTaskFromNote,
  onLinkNoteToNote,
  onUnlinkNoteFromNote,
}: UseMentionsProps) {
  const lastMentionedRef = React.useRef<Set<string>>(new Set());

  // Reset tracking when switching notes (prevents cross-note ghost links)
  React.useEffect(() => {
    lastMentionedRef.current = new Set();
  }, [currentNoteId]);

  /**
   * Primary handler to wire to TipTapEditor's onMentionsChanged.
   * Performs diff against previous scan and triggers precise link/unlink mutations.
   */
  const onMentionsChanged = (mentions: MentionRef[]) => {
    if (!currentNoteId) return;

    const currentMentioned = new Set<string>();

    mentions.forEach((m) => {
      if (m.refId && (m.refType === "task" || m.refType === "note")) {
        currentMentioned.add(m.refId);
      }
    });

    // Auto-link newly appeared mentions (add direction is always safe + magical)
    currentMentioned.forEach((id) => {
      if (!lastMentionedRef.current.has(id)) {
        const isTask = tasks.some((t) => t.id === id);
        if (isTask) {
          onLinkTaskToNote?.(currentNoteId, id);
        } else {
          // Could be a note id or a label-only mention we resolve here in future
          const isNote = notes.some((n) => n.id === id);
          if (isNote) {
            onLinkNoteToNote?.(currentNoteId, id);
          }
        }
      }
    });

    // Auto-unlink mentions that were removed from the document (true bidirectional sync)
    lastMentionedRef.current.forEach((id) => {
      if (!currentMentioned.has(id)) {
        const isTask = tasks.some((t) => t.id === id);
        if (isTask) {
          onUnlinkTaskFromNote?.(currentNoteId, id);
        } else {
          const isNote = notes.some((n) => n.id === id);
          if (isNote) {
            onUnlinkNoteFromNote?.(currentNoteId, id);
          }
        }
      }
    });

    lastMentionedRef.current = currentMentioned;
  };

  /**
   * Current live mentions for the active note (derived on demand if needed).
   * Consumers can also call extractMentionsFromDoc directly.
   */
  const getCurrentMentions = (doc: any): MentionRef[] => {
    return extractMentionsFromDoc(doc);
  };

  return {
    onMentionsChanged,
    extractMentionsFromDoc,
    getCurrentMentions,
    // Expose for advanced consumers / testing
    lastMentionedRef, // (read-only intent)
  };
}
