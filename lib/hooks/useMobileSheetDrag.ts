"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useDragControls, type PanInfo } from "framer-motion";
import {
  SHEET_DISMISS_OFFSET,
  SHEET_DISMISS_VELOCITY,
} from "@/lib/motion/sheet";
import { isSheetDragBlockedTarget } from "@/lib/motion/sheetDragTarget";

const TAP_SLOP_PX = 10;
const DRAG_SLOP_PX = 8;

type DeferredDragConfig = {
  getScrollEl?: () => HTMLElement | null;
  canStart?: (target: EventTarget) => boolean;
  onTap?: () => void;
  onTapFromTarget?: (target: EventTarget) => (() => void) | undefined;
  /** When true, only touches inside this selector require scrollTop === 0. */
  scrollGateSelector?: string;
};

type PointerDragState = {
  pointerId: number;
  startY: number;
  startX: number;
  scrollTop: number;
  requireScrollTop: boolean;
  onTap?: () => void;
  dragging: boolean;
  lastY: number;
  lastT: number;
  velocityY: number;
  captureEl: HTMLElement | null;
};

export function useMobileSheetDrag(options: {
  enabled: boolean;
  onDismiss: () => void;
  dragMode?: "handle" | "panel";
  /** manual: 1:1 finger tracking (best for scrollable sheets). framer: legacy drag controls. */
  dragEngine?: "manual" | "framer";
  offsetThreshold?: number;
  velocityThreshold?: number;
}) {
  const {
    enabled,
    onDismiss,
    dragMode = "handle",
    dragEngine = "framer",
    offsetThreshold = SHEET_DISMISS_OFFSET,
    velocityThreshold = SHEET_DISMISS_VELOCITY,
  } = options;

  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragControls = useDragControls();
  const pointerRef = useRef<PointerDragState | null>(null);

  const resetDrag = useCallback(() => {
    setDragY(0);
    setIsDragging(false);
    pointerRef.current = null;
  }, []);

  const finishDrag = useCallback(
    (dy: number, velocityY: number) => {
      if (dy > offsetThreshold || velocityY > velocityThreshold) {
        onDismiss();
      } else {
        setDragY(0);
      }
      setIsDragging(false);
    },
    [onDismiss, offsetThreshold, velocityThreshold],
  );

  const handleDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      finishDrag(info.offset.y, info.velocity.y);
    },
    [finishDrag],
  );

  const handleDrag = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (enabled) setDragY(Math.max(0, info.offset.y));
    },
    [enabled],
  );

  const beginPointerDrag = useCallback(
    (
      e: PointerEvent | ReactPointerEvent,
      config: {
        immediate?: boolean;
        getScrollEl?: () => HTMLElement | null;
        scrollGateSelector?: string;
        onTap?: () => void;
        canStart?: (target: EventTarget) => boolean;
        captureEl?: HTMLElement | null;
      },
    ) => {
      if (!enabled || e.button !== 0) return;
      if (!config.immediate) {
        if (isSheetDragBlockedTarget(e.target)) return;
        if (config.canStart && (!e.target || !config.canStart(e.target))) return;
      }

      const target = e.target;
      const inScrollGate =
        config.scrollGateSelector &&
        target instanceof Element &&
        Boolean(target.closest(config.scrollGateSelector));
      const scrollTop = inScrollGate ? (config.getScrollEl?.()?.scrollTop ?? 0) : 0;

      pointerRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startX: e.clientX,
        scrollTop,
        requireScrollTop: Boolean(inScrollGate),
        onTap: config.onTap,
        dragging: Boolean(config.immediate),
        lastY: e.clientY,
        lastT: performance.now(),
        velocityY: 0,
        captureEl: config.captureEl ?? null,
      };

      if (config.immediate) {
        setIsDragging(true);
        config.captureEl?.setPointerCapture?.(e.pointerId);
      }
    },
    [enabled],
  );

  const movePointerDrag = useCallback(
    (e: PointerEvent) => {
      const state = pointerRef.current;
      if (!state || state.pointerId !== e.pointerId) return;

      const dy = e.clientY - state.startY;
      const dx = e.clientX - state.startX;

      if (!state.dragging) {
        if (Math.abs(dy) <= DRAG_SLOP_PX && Math.abs(dx) <= DRAG_SLOP_PX) return;
        if (Math.abs(dy) < Math.abs(dx)) {
          pointerRef.current = null;
          return;
        }
        if (dy < 0) {
          pointerRef.current = null;
          return;
        }
        if (state.requireScrollTop && state.scrollTop > 1) {
          pointerRef.current = null;
          return;
        }

        state.dragging = true;
        setIsDragging(true);
        state.captureEl?.setPointerCapture?.(e.pointerId);
      }

      e.preventDefault();

      const now = performance.now();
      const dt = Math.max(1, now - state.lastT);
      state.velocityY = ((e.clientY - state.lastY) / dt) * 1000;
      state.lastY = e.clientY;
      state.lastT = now;
      setDragY(Math.max(0, dy));
    },
    [],
  );

  const endPointerDrag = useCallback(
    (e: PointerEvent) => {
      const state = pointerRef.current;
      if (!state || state.pointerId !== e.pointerId) return;

      const dy = e.clientY - state.startY;
      const dx = e.clientX - state.startX;
      pointerRef.current = null;

      if (state.captureEl?.hasPointerCapture?.(e.pointerId)) {
        state.captureEl.releasePointerCapture(e.pointerId);
      }

      if (state.dragging) {
        finishDrag(dy, state.velocityY);
        return;
      }

      if (Math.abs(dy) <= TAP_SLOP_PX && Math.abs(dx) <= TAP_SLOP_PX) {
        state.onTap?.();
      }
      setDragY(0);
    },
    [finishDrag],
  );

  const cancelPointerDrag = useCallback((e: PointerEvent) => {
    const state = pointerRef.current;
    if (state?.pointerId !== e.pointerId) return;
    pointerRef.current = null;
    setIsDragging(false);
    setDragY(0);
  }, []);

  const startDrag = useCallback(
    (e: ReactPointerEvent) => {
      if (!enabled) return;
      if (dragEngine === "manual") {
        beginPointerDrag(e, {
          immediate: true,
          captureEl: e.currentTarget instanceof HTMLElement ? e.currentTarget : null,
        });
        return;
      }
      if (dragMode === "handle") dragControls.start(e);
    },
    [enabled, dragEngine, dragMode, dragControls, beginPointerDrag],
  );

  const beginDeferredDrag = useCallback(
    (
      e: PointerEvent | ReactPointerEvent,
      config: DeferredDragConfig & { captureEl?: HTMLElement | null },
    ) => {
      beginPointerDrag(e, {
        getScrollEl: config.getScrollEl,
        scrollGateSelector: config.scrollGateSelector,
        onTap: e.target
          ? (config.onTapFromTarget?.(e.target) ?? config.onTap)
          : config.onTap,
        canStart: config.canStart,
        captureEl:
          config.captureEl ??
          (e.currentTarget instanceof HTMLElement ? e.currentTarget : null),
      });
    },
    [beginPointerDrag],
  );

  useEffect(() => {
    if (!enabled || dragEngine !== "manual") return;

    const onMove = (e: PointerEvent) => movePointerDrag(e);
    const onEnd = (e: PointerEvent) => endPointerDrag(e);
    const onCancel = (e: PointerEvent) => cancelPointerDrag(e);

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [enabled, dragEngine, movePointerDrag, endPointerDrag, cancelPointerDrag]);

  useEffect(() => {
    if (!enabled || dragEngine !== "framer") return;

    const onMove = (e: PointerEvent) => {
      const state = pointerRef.current;
      if (!state || state.pointerId !== e.pointerId || state.dragging) return;

      const dy = e.clientY - state.startY;
      const dx = e.clientX - state.startX;
      if (dy <= DRAG_SLOP_PX) return;
      if (Math.abs(dy) < Math.abs(dx)) return;
      if (dy < 0) {
        pointerRef.current = null;
        return;
      }
      if (state.requireScrollTop && state.scrollTop > 1) {
        pointerRef.current = null;
        return;
      }

      pointerRef.current = null;
      if (dragMode === "handle") dragControls.start(e);
    };

    const onEnd = (e: PointerEvent) => {
      const state = pointerRef.current;
      if (!state || state.pointerId !== e.pointerId) return;
      pointerRef.current = null;

      const dy = Math.abs(e.clientY - state.startY);
      const dx = Math.abs(e.clientX - state.startX);
      if (dy <= TAP_SLOP_PX && dx <= TAP_SLOP_PX) {
        state.onTap?.();
      }
    };

    const onCancel = (e: PointerEvent) => {
      const state = pointerRef.current;
      if (state?.pointerId === e.pointerId) pointerRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [enabled, dragEngine, dragControls, dragMode]);

  const createDeferredDragHandlers = useCallback(
    (config: DeferredDragConfig) => ({
      onPointerDown: (e: ReactPointerEvent) => beginDeferredDrag(e, config),
    }),
    [beginDeferredDrag],
  );

  const attachCaptureDragSurface = useCallback(
    (el: HTMLElement | null, config: DeferredDragConfig) => {
      if (!el || !enabled || dragEngine !== "manual") return;

      const onPointerDown = (e: PointerEvent) => {
        if (!(e.target instanceof Element)) return;
        if (e.target.closest(".sheet-drag-handle-zone")) return;
        beginDeferredDrag(e, { ...config, captureEl: el });
      };

      el.addEventListener("pointerdown", onPointerDown, { capture: true });
      return () => el.removeEventListener("pointerdown", onPointerDown, { capture: true });
    },
    [enabled, dragEngine, beginDeferredDrag],
  );

  const backdropOpacity = Math.max(0.15, 1 - dragY / 280);
  const useFramerDrag = enabled && dragEngine === "framer";

  return {
    dragY,
    isDragging,
    backdropOpacity,
    dragControls,
    resetDrag,
    startDrag,
    createDeferredDragHandlers,
    attachCaptureDragSurface,
    handleDragEnd: useFramerDrag ? handleDragEnd : undefined,
    handleDrag: useFramerDrag ? handleDrag : undefined,
    drag: useFramerDrag ? ("y" as const) : false,
    dragControlsProp: useFramerDrag && dragMode === "handle" ? dragControls : undefined,
    dragListener: useFramerDrag && dragMode === "panel",
    dragMomentum: useFramerDrag ? false : undefined,
    dragConstraints: { top: 0, bottom: dragMode === "handle" ? 500 : 400 },
    dragElastic: dragMode === "handle" ? { top: 0, bottom: 0.28 } : 0.15,
  };
}