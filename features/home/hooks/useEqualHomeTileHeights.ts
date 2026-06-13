"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Measure natural tile heights, then unify all cards to the tallest. */
export function useEqualHomeTileHeights(deps: React.DependencyList) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [tileMinHeight, setTileMinHeight] = useState<number | undefined>();

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const sync = () => {
      const cards = Array.from(grid.querySelectorAll<HTMLElement>(".home-ws-card"));
      if (cards.length === 0) return;

      cards.forEach((card) => {
        card.style.minHeight = "";
      });

      const max = Math.max(...cards.map((card) => card.getBoundingClientRect().height));
      if (max > 0) setTileMinHeight(Math.ceil(max));
    };

    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(grid);
    grid.querySelectorAll(".home-ws-card").forEach((card) => observer.observe(card));

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { gridRef, tileMinHeight };
}