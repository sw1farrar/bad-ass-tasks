"use client";

import { useEffect, type RefObject } from "react";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";

/** On mobile, scroll focused inputs into view inside a sheet scroll container. */
export function useFocusWithinScroll(
  scrollRef: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const isMobile = useIsMobileViewport();

  useEffect(() => {
    const el = scrollRef.current;
    if (!enabled || !isMobile || !el) return;

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target;
      if (
        !(t instanceof HTMLInputElement) &&
        !(t instanceof HTMLTextAreaElement) &&
        !(t instanceof HTMLSelectElement)
      ) {
        return;
      }
      requestAnimationFrame(() => {
        t.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    };

    el.addEventListener("focusin", onFocusIn);
    return () => el.removeEventListener("focusin", onFocusIn);
  }, [enabled, isMobile, scrollRef]);
}