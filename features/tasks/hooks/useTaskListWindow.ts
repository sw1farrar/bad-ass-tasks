"use client";

import { useCallback, useEffect, useState } from "react";
import { TASK_LIST_PAGE_SIZE } from "@/features/tasks/lib/taskListPage";

export function useTaskListWindow<T>(
  items: T[],
  resetKey: string,
  options?: { hasMoreRemote?: boolean; onLoadMore?: () => void; isLoadingMore?: boolean },
) {
  const [visibleCount, setVisibleCount] = useState(TASK_LIST_PAGE_SIZE);
  const onLoadMore = options?.onLoadMore;
  const hasMoreRemote = !!options?.hasMoreRemote;
  const isLoadingMore = !!options?.isLoadingMore;

  useEffect(() => {
    setVisibleCount(TASK_LIST_PAGE_SIZE);
  }, [resetKey]);

  const visibleItems = items.slice(0, visibleCount);
  const canRevealMore = visibleCount < items.length;
  const hasMore = canRevealMore || hasMoreRemote;

  const loadMore = useCallback(() => {
    if (canRevealMore) {
      setVisibleCount((n) => Math.min(items.length, n + TASK_LIST_PAGE_SIZE));
      return;
    }
    if (hasMoreRemote && !isLoadingMore) onLoadMore?.();
  }, [canRevealMore, hasMoreRemote, isLoadingMore, items.length, onLoadMore]);

  return { visibleItems, hasMore, loadMore, visibleCount };
}
