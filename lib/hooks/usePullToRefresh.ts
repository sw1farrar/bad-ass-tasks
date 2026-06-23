"use client";

import { useEffect, useRef, useState } from "react";
import { hasOpenOverlay } from "@/lib/dom/hasOpenOverlay";

function scrollChainAtTop(target: EventTarget | null): boolean {
  let node = target as HTMLElement | null;
  while (node && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const canScrollY =
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight + 1;
    if (canScrollY && node.scrollTop > 8) return false;
    node = node.parentElement;
  }
  return true;
}

function shouldIgnoreTouchTarget(target: HTMLElement | null): boolean {
  if (!target) return true;
  if (target.closest("[data-pull-refresh-ignore]")) return true;
  if (
    target.closest(
      ".list-item-drag, .list-card-drag-handle, .list-item-drag-overlay, .list-card-drag-overlay, .lists-board--dragging",
    )
  ) {
    return true;
  }
  if (hasOpenOverlay()) return true;
  return false;
}

export type UsePullToRefreshOptions = {
  enabled: boolean;
  onRefresh: () => Promise<void>;
  canStartPull?: () => boolean;
  threshold?: number;
  maxPull?: number;
};

export function usePullToRefresh({
  enabled,
  onRefresh,
  canStartPull,
  threshold = 52,
  maxPull = 70,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const canStartPullRef = useRef(canStartPull);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    canStartPullRef.current = canStartPull;
  }, [canStartPull]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let startY = 0;
    let isPulling = false;
    let activeTouchId: number | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current) return;
      if (canStartPullRef.current && !canStartPullRef.current()) return;
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const target = e.target as HTMLElement | null;
      if (shouldIgnoreTouchTarget(target)) return;
      if (!scrollChainAtTop(target)) return;

      isPulling = true;
      activeTouchId = touch.identifier;
      startY = touch.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling || activeTouchId === null) return;
      const touch = Array.from(e.touches).find((t) => t.identifier === activeTouchId);
      if (!touch) return;

      const dy = Math.max(0, touch.clientY - startY);
      const next = Math.min(dy, maxPull);
      pullDistanceRef.current = next;
      setPullDistance(next);
    };

    const resetPull = () => {
      isPulling = false;
      activeTouchId = null;
      pullDistanceRef.current = 0;
      setPullDistance(0);
    };

    const onTouchEnd = async () => {
      if (!isPulling) return;
      const dist = pullDistanceRef.current;
      resetPull();
      if (dist < threshold) return;

      isRefreshingRef.current = true;
      setIsRefreshing(true);
      try {
        await onRefreshRef.current();
      } finally {
        isRefreshingRef.current = false;
        window.setTimeout(() => setIsRefreshing(false), 350);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", resetPull, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", resetPull);
    };
  }, [enabled, threshold, maxPull]);

  return { pullDistance, isRefreshing };
}