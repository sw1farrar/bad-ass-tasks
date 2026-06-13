"use client";

import { useLayoutEffect, useRef, useState } from "react";

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

/** Measure natural tile heights, then unify all cards to the tallest. */
export function useEqualHomeTileHeights(deps: React.DependencyList) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [tileHeight, setTileHeight] = useState<number | undefined>();

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    let frame = 0;

    const sync = () => {
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

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      grid.style.removeProperty("--home-ws-tile-height");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { gridRef, tileHeight };
}