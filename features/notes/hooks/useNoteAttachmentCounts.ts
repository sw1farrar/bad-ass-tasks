"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const PATCH_EVENT = "note-attachment-count-patch";

type PatchDetail = { workspaceId: string; noteId: string; count: number };

function dispatchPatch(workspaceId: string, noteId: string, count: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PatchDetail>(PATCH_EVENT, {
      detail: { workspaceId, noteId, count },
    }),
  );
}

/** Optimistically patch a single note's count across all hook instances (no refetch). */
export function patchNoteAttachmentCount(
  workspaceId: string,
  noteId: string,
  count: number,
) {
  dispatchPatch(workspaceId, noteId, count);
}

function applyCountPatch(
  prev: Record<string, number>,
  noteId: string,
  count: number,
): Record<string, number> {
  if (count <= 0) {
    if (!(noteId in prev)) return prev;
    const next = { ...prev };
    delete next[noteId];
    return next;
  }
  if (prev[noteId] === count) return prev;
  return { ...prev, [noteId]: count };
}

export function useNoteAttachmentCounts(workspaceId: string | undefined) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!workspaceId || !isSupabaseConfigured() || ["w1", "w2"].includes(workspaceId)) {
      setCounts({});
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    if (!hasLoadedRef.current) setLoading(true);
    try {
      const res = await fetch(
        `/api/workspace/note-attachment-counts?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      const data = await res.json();
      if (res.ok) {
        setCounts(data.counts ?? {});
      }
    } catch {
      // table may not exist in demo
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    hasLoadedRef.current = false;
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!workspaceId) return;

    const onPatch = (e: Event) => {
      const { workspaceId: ws, noteId, count } = (e as CustomEvent<PatchDetail>).detail;
      if (ws !== workspaceId) return;
      setCounts((prev) => applyCountPatch(prev, noteId, count));
    };

    window.addEventListener(PATCH_EVENT, onPatch);
    return () => window.removeEventListener(PATCH_EVENT, onPatch);
  }, [workspaceId]);

  const setNoteCount = useCallback(
    (noteId: string, count: number) => {
      if (!workspaceId) return;
      setCounts((prev) => {
        const next = applyCountPatch(prev, noteId, count);
        if (next === prev) return prev;
        dispatchPatch(workspaceId, noteId, count);
        return next;
      });
    },
    [workspaceId],
  );

  return { counts, loading, refresh, setNoteCount };
}