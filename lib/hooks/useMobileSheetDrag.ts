"use client";

import { useCallback, useState } from "react";
import { useDragControls, type PanInfo } from "framer-motion";
import {
  SHEET_DISMISS_OFFSET,
  SHEET_DISMISS_VELOCITY,
} from "@/lib/motion/sheet";

export function useMobileSheetDrag(options: {
  enabled: boolean;
  onDismiss: () => void;
  dragMode?: "handle" | "panel";
  offsetThreshold?: number;
  velocityThreshold?: number;
}) {
  const {
    enabled,
    onDismiss,
    dragMode = "handle",
    offsetThreshold = SHEET_DISMISS_OFFSET,
    velocityThreshold = SHEET_DISMISS_VELOCITY,
  } = options;

  const [dragY, setDragY] = useState(0);
  const dragControls = useDragControls();

  const resetDrag = useCallback(() => setDragY(0), []);

  const handleDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y > offsetThreshold || info.velocity.y > velocityThreshold) {
        onDismiss();
      } else {
        setDragY(0);
      }
    },
    [onDismiss, offsetThreshold, velocityThreshold],
  );

  const handleDrag = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (enabled) setDragY(Math.max(0, info.offset.y));
    },
    [enabled],
  );

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (enabled && dragMode === "handle") dragControls.start(e);
    },
    [enabled, dragMode, dragControls],
  );

  return {
    dragY,
    dragControls,
    resetDrag,
    startDrag,
    handleDragEnd: enabled ? handleDragEnd : undefined,
    handleDrag: enabled ? handleDrag : undefined,
    drag: enabled ? ("y" as const) : false,
    dragControlsProp: dragMode === "handle" ? dragControls : undefined,
    dragListener: dragMode === "panel",
    dragConstraints: { top: 0, bottom: dragMode === "handle" ? 500 : 400 },
    dragElastic: dragMode === "handle" ? { top: 0, bottom: 0.2 } : 0.15,
  };
}