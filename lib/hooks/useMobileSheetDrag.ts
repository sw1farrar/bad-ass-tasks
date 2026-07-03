"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useDragControls, type PanInfo } from "framer-motion";
import {
  SHEET_DISMISS_OFFSET,
  SHEET_DISMISS_VELOCITY,
  SHEET_RUBBER_BAND_PREVIEW,
  SHEET_RUBBER_BAND_PX,
} from "@/lib/motion/sheet";
import { isSheetDragBlockedTarget } from "@/lib/motion/sheetDragTarget";

const TAP_SLOP_PX = 10;
const DRAG_SLOP_PX = 6;

type DeferredDragConfig = {
  getScrollEl?: () => HTMLElement | null;
  canStart?: (target: EventTarget) => boolean;
  onTap?: () => void;
  onTapFromTarget?: (target: EventTarget) => (() => void) | undefined;
};

type DeferredDragState = {
  pointerId: number;
  startY: number;
  startX: number;
  scrollTop: number;
  onTap?: () => void;
  previewing?: boolean;
};

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
  const deferredRef = useRef<DeferredDragState | null>(null);

  const resetDrag = useCallback(() => {
    setDragY(0);
    deferredRef.current = null;
  }, []);

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
    (e: ReactPointerEvent) => {
      if (enabled && dragMode === "handle") dragControls.start(e);
    },
    [enabled, dragMode, dragControls],
  );

  const beginDeferredDrag = useCallback(
    (e: ReactPointerEvent, config: DeferredDragConfig) => {
      if (!enabled || e.button !== 0) return;
      if (isSheetDragBlockedTarget(e.target)) return;
      if (config.canStart && !config.canStart(e.target)) return;

      deferredRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startX: e.clientX,
        scrollTop: config.getScrollEl?.()?.scrollTop ?? 0,
        onTap: config.onTapFromTarget?.(e.target) ?? config.onTap,
      };
    },
    [enabled],
  );

  const moveDeferredDrag = useCallback(
    (e: PointerEvent | ReactPointerEvent) => {
      const state = deferredRef.current;
      if (!state || state.pointerId !== e.pointerId) return;

      const dy = e.clientY - state.startY;
      const dx = e.clientX - state.startX;
      if (dy <= DRAG_SLOP_PX) return;
      if (Math.abs(dy) < Math.abs(dx)) return;
      if (dy < 0) {
        deferredRef.current = null;
        if (state.previewing) setDragY(0);
        return;
      }
      if (state.scrollTop > 1) {
        deferredRef.current = null;
        if (state.previewing) setDragY(0);
        return;
      }

      if (dy < SHEET_RUBBER_BAND_PX) {
        state.previewing = true;
        setDragY(dy * SHEET_RUBBER_BAND_PREVIEW);
        return;
      }

      deferredRef.current = null;
      setDragY(0);
      if (dragMode === "handle") dragControls.start(e);
    },
    [dragControls, dragMode],
  );

  const endDeferredDrag = useCallback((e: PointerEvent | ReactPointerEvent) => {
    const state = deferredRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    deferredRef.current = null;

    const dy = Math.abs(e.clientY - state.startY);
    const dx = Math.abs(e.clientX - state.startX);
    if (dy <= TAP_SLOP_PX && dx <= TAP_SLOP_PX) {
      state.onTap?.();
    }
    if (state.previewing) setDragY(0);
  }, []);

  const cancelDeferredDrag = useCallback((e: PointerEvent | ReactPointerEvent) => {
    const state = deferredRef.current;
    if (state?.pointerId === e.pointerId) deferredRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onMove = (e: PointerEvent) => moveDeferredDrag(e);
    const onEnd = (e: PointerEvent) => endDeferredDrag(e);
    const onCancel = (e: PointerEvent) => cancelDeferredDrag(e);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [enabled, moveDeferredDrag, endDeferredDrag, cancelDeferredDrag]);

  const createDeferredDragHandlers = useCallback(
    (config: DeferredDragConfig) => ({
      onPointerDown: (e: ReactPointerEvent) => beginDeferredDrag(e, config),
    }),
    [beginDeferredDrag],
  );

  const backdropOpacity = Math.max(0.15, 1 - dragY / 280);

  return {
    dragY,
    backdropOpacity,
    dragControls,
    resetDrag,
    startDrag,
    createDeferredDragHandlers,
    handleDragEnd: enabled ? handleDragEnd : undefined,
    handleDrag: enabled ? handleDrag : undefined,
    drag: enabled ? ("y" as const) : false,
    dragControlsProp: dragMode === "handle" ? dragControls : undefined,
    dragListener: dragMode === "panel",
    dragMomentum: enabled ? false : undefined,
    dragConstraints: { top: 0, bottom: dragMode === "handle" ? 500 : 400 },
    dragElastic: dragMode === "handle" ? { top: 0, bottom: 0.28 } : 0.15,
  };
}