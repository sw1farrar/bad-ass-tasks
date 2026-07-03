"use client";

import { useState, useMemo } from "react";
import { useTaskStore } from "@/store/useTaskStore";

/**
 * useTasksFilters
 *
 * Extracted filter + search state for the Tasks domain (M0 Batch 2.10).
 *
 * Responsibilities:
 * - Global semantic search query (drives hybrid search + legacy filter sync)
 * - Result type filter (all / task / note)
 * - Derived filteredTasks (memoized)
 *
 * Guard note: This hook only deals with UI filter state.
 * All actual data fetching, demo/live guards, and mutations stay in the store + parent orchestrator.
 */
export function useTasksFilters() {
  const tasks = useTaskStore((s) => s.tasks);
  const taskFilter = useTaskStore((s) => s.taskFilter);
  const setTaskFilter = useTaskStore((s) => s.setTaskFilter);
  const getFilteredTasks = useTaskStore((s) => s.getFilteredTasks);

  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [searchResultType, setSearchResultType] = useState<'all' | 'task' | 'note'>('all');

  // Sync global search into the legacy taskFilter for compatibility with existing list logic
  const handleSetGlobalSearchQuery = (query: string) => {
    setGlobalSearchQuery(query);
    setTaskFilter({ search: query });
  };

  // Memoized filtered + sorted tasks (expensive for large lists)
  const filteredTasks = useMemo(() => {
    return getFilteredTasks();
  }, [getFilteredTasks, tasks, taskFilter]);

  const clearFilters = () => {
    setGlobalSearchQuery("");
    setSearchResultType('all');
    setTaskFilter({ search: "", statusMode: "incomplete", recurrenceMode: "all" });
  };

  return {
    // State
    globalSearchQuery,
    searchResultType,
    taskFilter,
    filteredTasks,

    // Setters (with sync where needed)
    setGlobalSearchQuery: handleSetGlobalSearchQuery,
    setSearchResultType,
    setTaskFilter,

    // Helpers
    clearFilters,
  };
}
