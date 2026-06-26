"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { isMobileViewportWidth } from "@/lib/constants/viewport";

function shouldEqualizeTileHeights(): boolean {
  return typeof window !== "undefined" && !isMobileViewportWidth(window.innerWidth);
}

function clearUnifiedTileHeights(grid: HTMLDivElement): void {
  grid.style.removeProperty("--home-ws-tile-height");
  grid.querySelectorAll<HTMLElement>(".home-ws-card").forEach((card) => {
    card.style.minHeight = "";
    card.style.height = "";
  });
}

function measureTallestTile(grid: HTMLDivElement): number {
  const cards = Array.from(grid.querySelectorAll<HTMLElement>(".home-ws-card"));
  if (cards.length === 0) return 0;

  grid.style.removeProperty("--home-ws-tile-height");
  cards.forEach((card) => {
    card.style.minHeight = "";
    card.style.height = "";
  });

  return Math.max(...cards.map((card) => card.getBoundingClientRect().height), 0);
}

/** Desktop only: measure natural tile heights, then unify all cards to the tallest. */
export function useEqualHomeTileHeights(deps: React.DependencyList) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [tileHeight, setTileHeight] = useState<number | undefined>();

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    let frame = 0;

    const sync = () => {
      if (!shouldEqualizeTileHeights()) {
        clearUnifiedTileHeights(grid);
        setTileHeight(undefined);
        return;
      }

      const max = measureTallestTile(grid);
      if (max <= 0) return;

      const unified = Math.ceil(max);
      grid.style.setProperty("--home-ws-tile-height", `${unified}px`);
      setTileHeight((prev) => (prev === unified ? prev : unified));
    };

    sync();
    frame = requestAnimationFrame(sync);

    const observer = new ResizeObserver(() => sync());
    observer.observe(grid);
    grid.querySelectorAll(".home-ws-card").forEach((card) => observer.observe(card));
    window.addEventListener("resize", sync);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", sync);
      clearUnifiedTileHeights(grid);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { gridRef, tileHeight };
}