"use client";

import { useMemo } from "react";
import { Note } from "@/types";

/**
 * Pure function (single source of truth): returns FULL Note objects
 * that backlink (link *to*) the target noteId via:
 *  - shared linkedTaskIds (task symmetry / co-linking)
 *  - or @mention / [[ ]] pills in TipTap content (robust JSON doc walk + safe parse)
 *
 * Deduped. Excludes self. Used for badge counts (← N), jump-to, panels.
 * All consumers (sidebar, NoteHeader, LinkedTasksPanel, TipTap backlink sections)
 * must use this or the derived getBacklinkCount / the useBacklinks hook.
 */
export function getBacklinkNotes(allNotes: Note[], noteId: string | null): Note[] {
  if (!noteId) return [];

  const currentNote = allNotes.find(n => n.id === noteId);
  if (!currentNote) return [];

  const myTaskIds = new Set(currentNote.linkedTaskIds || []);

  const backlinks: Note[] = [];

  allNotes.forEach(note => {
    if (note.id === noteId) return;

    // Task symmetry: note shares any task link with target (bidirectional co-link surfacing)
    const sharesTask = (note.linkedTaskIds || []).some(tid => myTaskIds.has(tid));

    // Mention-based (from content) — exact mark scan (not naive string match)
    let isMentioned = false;
    let doc: any = null;
    if (typeof note.content === "string") {
      try { doc = JSON.parse(note.content); } catch {}
    } else if (note.content && typeof note.content === "object") {
      doc = note.content;
    }

    if (doc) {
      const walk = (node: any) => {
        if (node?.marks) {
          node.marks.forEach((m: any) => {
            if (m.type === "mention" && m.attrs?.refId === noteId) {
              isMentioned = true;
            }
          });
        }
        if (node?.content) node.content.forEach(walk);
      };
      if (doc?.content) doc.content.forEach(walk);
    }

    if (sharesTask || isMentioned) {
      backlinks.push(note);
    }
  });

  // Dedupe by id (a note can qualify via both task + mention paths)
  const seen = new Set<string>();
  return backlinks.filter(n => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}

/** Tiny stable selector exported for count-only use (derived, zero duplication). */
export function getBacklinkCount(allNotes: Note[], noteId: string | null): number {
  return getBacklinkNotes(allNotes, noteId).length;
}

/**
 * useBacklinks
 * M2: Central hook for computing backlinks summary for the *currently selected* note.
 * Delegates entirely to getBacklinkNotes (the undisputed single source) + lightweight map.
 * Preserves exact original return shape + all hybrid/demo/live/guard behavior.
 */
export function useBacklinks(
  allNotes: Note[],
  currentNoteId: string | null
) {
  return useMemo(() => {
    const full = getBacklinkNotes(allNotes, currentNoteId);
    return full.map(n => ({ id: n.id, title: n.title || "Untitled", type: "note" as const }));
  }, [allNotes, currentNoteId]);
}
