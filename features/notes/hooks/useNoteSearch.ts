"use client";

import { useState, useMemo } from "react";
import { Note } from "@/types";

/**
 * useNoteSearch
 * M2 extraction: Encapsulates note search logic, filtering, and state.
 * Previously scattered or duplicated in page.tsx and NotesView.
 * Returns search state + filtered/sorted notes + helpers.
 */
export function useNoteSearch(notes: Note[]) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNotes = useMemo(() => {
    if (!searchQuery) {
      return [...notes].sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt).getTime();
        return timeB - timeA; // Most recently updated first
      });
    }

    const q = searchQuery.toLowerCase();
    return notes
      .filter((note) => {
        return (
          note.title.toLowerCase().includes(q) ||
          JSON.stringify(note.content || {}).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt).getTime();
        return timeB - timeA;
      });
  }, [notes, searchQuery]);

  const isSearching = !!searchQuery;

  const clearSearch = () => setSearchQuery("");

  return {
    searchQuery,
    setSearchQuery,
    filteredNotes,
    isSearching,
    clearSearch,
  };
}
