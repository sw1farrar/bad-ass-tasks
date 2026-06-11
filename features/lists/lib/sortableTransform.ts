import type { Transform } from "@dnd-kit/utilities";
import { CSS } from "@dnd-kit/utilities";

/** Apply translation only — rectSortingStrategy scale would distort card sizes. */
export function sortableTranslateOnly(transform: Transform | null): string | undefined {
  if (!transform) return undefined;
  return CSS.Translate.toString(transform);
}