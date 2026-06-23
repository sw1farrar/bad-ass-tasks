"use client";

import { useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api/apiFetch";
import {
  parseFileAiSuggestion,
  type FileAiSuggestion,
} from "@/lib/files/fileAiSuggestion";
import type { Note } from "@/types";
import { useTaskStore } from "@/store/useTaskStore";

const MAX_CONCURRENT = 2;

function needsPreemptiveAnalysis(note: Note): boolean {
  if (note.reviewStatus !== "pending_review") return false;
  const suggestion = note.aiSuggestion;
  if (suggestion?.status === "ready" && suggestion.title?.trim()) return false;
  if (suggestion?.status === "pending") return false;
  return true;
}

async function prepareReviewSuggestion(
  noteId: string,
  availableTags: string[],
): Promise<FileAiSuggestion | null> {
  const res = await apiFetch("/api/ai/prepare-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noteId, availableTags }),
  });

  let data: { suggestion?: unknown; error?: string; inProgress?: boolean } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return null;
  }

  const suggestion = parseFileAiSuggestion(data.suggestion);
  if (suggestion) return suggestion;
  return null;
}

/**
 * Desktop review queue: run AI filing analysis in the background for pending files
 * so the approve modal opens with suggestions already loaded.
 */
export function usePreemptiveReviewAnalysis(args: {
  pendingFiles: Note[];
  workspaceTags: string[];
  enabled: boolean;
}) {
  const { pendingFiles, workspaceTags, enabled } = args;
  const updateNote = useTaskStore((s) => s.updateNote);
  const inFlightRef = useRef(new Set<string>());
  const queueRef = useRef<string[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const targets = pendingFiles.filter(needsPreemptiveAnalysis).map((n) => n.id);
    const pendingSet = new Set(targets);
    queueRef.current = [
      ...queueRef.current.filter((id) => pendingSet.has(id)),
      ...targets.filter((id) => !queueRef.current.includes(id)),
    ];

    let cancelled = false;

    const pump = async () => {
      while (!cancelled && inFlightRef.current.size < MAX_CONCURRENT) {
        const nextId = queueRef.current.find((id) => !inFlightRef.current.has(id));
        if (!nextId) break;

        inFlightRef.current.add(nextId);
        queueRef.current = queueRef.current.filter((id) => id !== nextId);

        void prepareReviewSuggestion(nextId, workspaceTags)
          .then(async (suggestion) => {
            if (!suggestion || cancelled) return;
            await updateNote(nextId, { aiSuggestion: suggestion });
          })
          .catch(() => {
            // prepare-review persists failed state when possible
          })
          .finally(() => {
            inFlightRef.current.delete(nextId);
            if (!cancelled) void pump();
          });
      }
    };

    void pump();

    return () => {
      cancelled = true;
    };
  }, [enabled, pendingFiles, workspaceTags, updateNote]);
}