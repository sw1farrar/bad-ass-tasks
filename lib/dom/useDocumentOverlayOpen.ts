"use client";

import { useEffect, useState } from "react";
import { hasOpenOverlay } from "@/lib/dom/hasOpenOverlay";

/** Re-renders when a modal/dialog opens or closes (file preview, confirmations, etc.). */
export function useDocumentOverlayOpen(): boolean {
  const [open, setOpen] = useState(() =>
    typeof document !== "undefined" ? hasOpenOverlay() : false,
  );

  useEffect(() => {
    const sync = () => setOpen(hasOpenOverlay());
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role", "aria-modal", "class"],
    });

    return () => observer.disconnect();
  }, []);

  return open;
}