"use client";

import { useEffect } from "react";

const ROOT_VARS = {
  vvh: "--vvh",
  offsetTop: "--vv-offset-top",
  keyboard: "--keyboard-inset",
} as const;

/**
 * Pixels of the layout viewport hidden by the keyboard.
 * Zero when `innerHeight` has already shrunk to the visual viewport (Chrome
 * `interactive-widget=resizes-content`), so a sheet that is already short is
 * not padded a second time.
 */
export function keyboardOverlapPx(
  innerHeight: number,
  viewportHeight: number,
  offsetTop: number,
): number {
  return Math.max(0, innerHeight - (viewportHeight + offsetTop));
}

/** Publishes visualViewport dimensions as CSS variables on documentElement. */
export function useVisualViewportInsets(active = true) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const update = () => {
      const keyboard = keyboardOverlapPx(window.innerHeight, vv.height, vv.offsetTop);
      root.style.setProperty(ROOT_VARS.vvh, `${vv.height}px`);
      root.style.setProperty(ROOT_VARS.offsetTop, `${vv.offsetTop}px`);
      root.style.setProperty(ROOT_VARS.keyboard, `${keyboard}px`);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      root.style.removeProperty(ROOT_VARS.vvh);
      root.style.removeProperty(ROOT_VARS.offsetTop);
      root.style.removeProperty(ROOT_VARS.keyboard);
    };
  }, [active]);
}