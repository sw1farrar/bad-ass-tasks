"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function useNoteAttachmentCounts(workspaceId: string | undefined) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspaceId || !isSupabaseConfigured() || ["w1", "w2"].includes(workspaceId)) {
      setCounts({});
      setLoading(false);
      return;
    }

    setLoading(true);
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
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setNoteCount = useCallback((noteId: string, count: number) => {
    setCounts((prev) => {
      if (count <= 0) {
        const next = { ...prev };
        delete next[noteId];
        return next;
      }
      return { ...prev, [noteId]: count };
    });
  }, []);

  return { counts, loading, refresh, setNoteCount };
}