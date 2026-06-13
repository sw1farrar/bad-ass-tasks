"use client";

import {
  AutoScrollActivator,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type AutoScrollOptions,
  type Modifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/** Keep stack reorder strictly vertical — avoids horizontal finger drift on phones. */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

export const LIST_DRAG_DROP_ANIMATION = {
  duration: 220,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
} as const;

const LIST_DRAG_LAYOUT_SHIFT = { x: false, y: true } as const;

/** Stack/mobile — generous edge zones; compensate for live reorder layout shifts. */
export function getMobileListAutoScrollOptions(): AutoScrollOptions {
  return {
    threshold: { x: 0, y: 0.24 },
    acceleration: 22,
    interval: 3,
    activator: AutoScrollActivator.Pointer,
    layoutShiftCompensation: LIST_DRAG_LAYOUT_SHIFT,
  };
}

/** Desktop stack — same layout-shift compensation, slightly calmer speed. */
export function getStackListAutoScrollOptions(): AutoScrollOptions {
  return {
    threshold: { x: 0, y: 0.2 },
    acceleration: 16,
    interval: 4,
    activator: AutoScrollActivator.Pointer,
    layoutShiftCompensation: LIST_DRAG_LAYOUT_SHIFT,
  };
}

type ListDndSensorOptions = {
  /** Touch-first tuning for phones — slightly longer activation avoids scroll fights. */
  isMobile?: boolean;
};

/** Mouse + touch on drag handles (touch-action: none) — tolerance prevents accidental drags. */
export function useListDndSensors(options: ListDndSensorOptions = {}) {
  const { isMobile = false } = options;

  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: isMobile
        ? { delay: 100, tolerance: 8 }
        : { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}