"use client";

import { useEffect } from "react";

const ROOT_VARS = {
  vvh: "--vvh",
  offsetTop: "--vv-offset-top",
  keyboard: "--keyboard-inset",
} as const;

/** Publishes visualViewport dimensions as CSS variables on documentElement. */
export function useVisualViewportInsets(active = true) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const update = () => {
      const keyboard = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      root.style.setProperty(ROOT_VARS.vvh, `${vv.height}px`);
      root.style.setProperty(ROOT_VARS.offsetTop, `${vv.offsetTop}px`);
      root.style.setProperty(ROOT_VARS.keyboard, `${keyboard}px`);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty(ROOT_VARS.vvh);
      root.style.removeProperty(ROOT_VARS.offsetTop);
      root.style.removeProperty(ROOT_VARS.keyboard);
    };
  }, [active]);
}