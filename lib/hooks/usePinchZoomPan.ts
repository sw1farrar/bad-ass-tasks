"use client";

import { useCallback, useRef, useState } from "react";

type Point = { x: number; y: number };

type UsePinchZoomPanOptions = {
  minScale?: number;
  maxScale?: number;
  doubleTapScale?: number;
  enabled?: boolean;
};

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function usePinchZoomPan({
  minScale = 1,
  maxScale = 6,
  doubleTapScale = 2.5,
  enabled = true,
}: UsePinchZoomPanOptions = {}) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const scaleRef = useRef(1);
  const positionRef = useRef<Point>({ x: 0, y: 0 });
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);
  const panStartRef = useRef<Point | null>(null);
  const panOriginRef = useRef<Point>({ x: 0, y: 0 });
  const lastTapRef = useRef<number>(0);

  const clampScale = useCallback(
    (value: number) => Math.min(maxScale, Math.max(minScale, value)),
    [maxScale, minScale],
  );

  const applyScale = useCallback(
    (next: number) => {
      const clamped = clampScale(next);
      scaleRef.current = clamped;
      setScale(clamped);
      if (clamped <= 1) {
        positionRef.current = { x: 0, y: 0 };
        setPosition({ x: 0, y: 0 });
      }
    },
    [clampScale],
  );

  const reset = useCallback(() => {
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
    pinchStartDistRef.current = null;
    panStartRef.current = null;
  }, []);

  const getTouchPoint = (touch: React.Touch): Point => ({
    x: touch.clientX,
    y: touch.clientY,
  });

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled) return;

      if (event.touches.length === 2) {
        const a = getTouchPoint(event.touches[0]);
        const b = getTouchPoint(event.touches[1]);
        pinchStartDistRef.current = distance(a, b);
        pinchStartScaleRef.current = scaleRef.current;
        panStartRef.current = null;
        setIsDragging(false);
        return;
      }

      if (event.touches.length === 1 && scaleRef.current > 1) {
        const point = getTouchPoint(event.touches[0]);
        panStartRef.current = point;
        panOriginRef.current = { ...positionRef.current };
        setIsDragging(true);
      }
    },
    [enabled],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled) return;

      if (event.touches.length === 2 && pinchStartDistRef.current !== null) {
        event.preventDefault();
        const a = getTouchPoint(event.touches[0]);
        const b = getTouchPoint(event.touches[1]);
        const dist = distance(a, b);
        const ratio = dist / pinchStartDistRef.current;
        applyScale(pinchStartScaleRef.current * ratio);
        return;
      }

      if (event.touches.length === 1 && panStartRef.current && scaleRef.current > 1) {
        event.preventDefault();
        const point = getTouchPoint(event.touches[0]);
        const dx = point.x - panStartRef.current.x;
        const dy = point.y - panStartRef.current.y;
        const next = {
          x: panOriginRef.current.x + dx,
          y: panOriginRef.current.y + dy,
        };
        positionRef.current = next;
        setPosition(next);
      }
    },
    [applyScale, enabled],
  );

  const handleTouchEnd = useCallback(() => {
    pinchStartDistRef.current = null;
    panStartRef.current = null;
    setIsDragging(false);
  }, []);

  const handleDoubleTap = useCallback(() => {
    if (!enabled) return;
    if (scaleRef.current > 1.05) {
      reset();
    } else {
      applyScale(doubleTapScale);
    }
  }, [applyScale, doubleTapScale, enabled, reset]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0;
      handleDoubleTap();
      return true;
    }
    lastTapRef.current = now;
    return false;
  }, [handleDoubleTap]);

  const zoomIn = useCallback(
    (step = 0.35) => applyScale(scaleRef.current + step),
    [applyScale],
  );

  const zoomOut = useCallback(
    (step = 0.35) => applyScale(scaleRef.current - step),
    [applyScale],
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!enabled) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.15 : 0.15;
      applyScale(scaleRef.current + delta);
    },
    [applyScale, enabled],
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (!enabled || scaleRef.current <= 1) return;
      setIsDragging(true);
      panStartRef.current = { x: event.clientX, y: event.clientY };
      panOriginRef.current = { ...positionRef.current };
    },
    [enabled],
  );

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!panStartRef.current || scaleRef.current <= 1) return;
    const dx = event.clientX - panStartRef.current.x;
    const dy = event.clientY - panStartRef.current.y;
    const next = {
      x: panOriginRef.current.x + dx,
      y: panOriginRef.current.y + dy,
    };
    positionRef.current = next;
    setPosition(next);
  }, []);

  const handleMouseUp = useCallback(() => {
    panStartRef.current = null;
    setIsDragging(false);
  }, []);

  const transformStyle = {
    transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
    transition: isDragging ? "none" : "transform 0.12s cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: "transform" as const,
  };

  return {
    scale,
    position,
    isDragging,
    transformStyle,
    reset,
    zoomIn,
    zoomOut,
    setScale: applyScale,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    },
    mouseHandlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseUp,
    },
    handleWheel,
    handleTap,
  };
}