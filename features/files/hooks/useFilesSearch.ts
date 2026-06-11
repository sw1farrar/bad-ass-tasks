"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api/apiFetch";
import {
  buildFilesSearchIndex,
  mergeFilesSearchResultIds,
  rankFilesSearchIds,
} from "@/lib/files/filesSearchRank";
import type { FilesSearchScope } from "@/lib/files/searchFilesInWorkspace";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Note } from "@/types";

const REMOTE_SEARCH_DEBOUNCE_MS = 180;

type UseFilesSearchOptions = {
  notes: Note[];
  workspaceId: string;
  scope: FilesSearchScope;
};

export function useFilesSearch({ notes, workspaceId, scope }: UseFilesSearchOptions) {
  const [searchQuery, setSearchQuery] = useState("");
  const [remoteIds, setRemoteIds] = useState<string[] | null>(null);
  const [isRemoteSearching, setIsRemoteSearching] = useState(false);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const searchIndex = useMemo(() => buildFilesSearchIndex(notes), [notes]);

  const trimmedQuery = searchQuery.trim();

  const localResultIds = useMemo(() => {
    if (!trimmedQuery) return null;
    return rankFilesSearchIds(searchIndex, trimmedQuery, { scope, limit: 100 });
  }, [searchIndex, trimmedQuery, scope]);

  const resultIds = useMemo(() => {
    if (!localResultIds) return null;
    if (!remoteIds) return localResultIds;
    return mergeFilesSearchResultIds(localResultIds, remoteIds);
  }, [localResultIds, remoteIds]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setRemoteIds(null);
    setIsRemoteSearching(false);
  }, []);

  useEffect(() => {
    if (!trimmedQuery || !workspaceId) {
      setRemoteIds(null);
      setIsRemoteSearching(false);
      return;
    }

    if (!isSupabaseConfigured()) {
      setRemoteIds(null);
      setIsRemoteSearching(false);
      return;
    }

    setRemoteIds(null);
    const controller = new AbortController();

    const handle = window.setTimeout(() => {
      setIsRemoteSearching(true);
      const includePending = scope === "review";

      void apiFetch(
        `/api/workspace/files/search?workspaceId=${encodeURIComponent(workspaceId)}&q=${encodeURIComponent(trimmedQuery)}&includePending=${includePending}`,
        { signal: controller.signal },
      )
        .then(async (res) => {
          if (!res.ok) throw new Error("search failed");
          const json = (await res.json()) as { results?: Array<{ id: string }> };
          setRemoteIds((json.results ?? []).map((row) => row.id));
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          const fallbackIds = rankFilesSearchIds(
            buildFilesSearchIndex(notesRef.current),
            trimmedQuery,
            { scope, limit: 100 },
          );
          setRemoteIds(fallbackIds);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsRemoteSearching(false);
          }
        });
    }, REMOTE_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
      setIsRemoteSearching(false);
    };
  }, [trimmedQuery, workspaceId, scope]);

  return {
    searchQuery,
    setSearchQuery,
    resultIds,
    isSearching: !!trimmedQuery,
    isRemoteSearching,
    clearSearch,
  };
}