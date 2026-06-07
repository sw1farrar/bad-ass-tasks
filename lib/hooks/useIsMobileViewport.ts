"use client";

import { useEffect, useState } from "react";
import { isMobileViewportWidth, MOBILE_MAX_WIDTH_PX } from "@/lib/constants/viewport";

export function useIsMobileViewport(breakpoint = MOBILE_MAX_WIDTH_PX + 1) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? isMobileViewportWidth(window.innerWidth) : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}