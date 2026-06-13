"use client";

import { useEffect } from "react";

/** Inner scroll surfaces that can scroll behind modals on desktop (body lock alone is insufficient). */
const INNER_SCROLL_LOCK_SELECTOR =
  ".main-content, .tasks-root .tasks-workspace, .lists-root .lists-workspace, .notes-root .notes-editor-scroll, .settings-root .settings-workspace, .files-root .files-list-scroll, .files-root .files-review-list, .files-root .notes-files-preview-body, .list-detail-body";

type SavedOverflow = { el: HTMLElement; overflow: string };

let lockCount = 0;
let previousBodyOverflow: string | null = null;
let innerSaved: SavedOverflow[] = [];

function lockInnerScrollContainers() {
  if (typeof document === "undefined") return;
  innerSaved = [];
  document.querySelectorAll(INNER_SCROLL_LOCK_SELECTOR).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    innerSaved.push({ el: node, overflow: node.style.overflow });
    node.style.overflow = "hidden";
  });
}

function unlockInnerScrollContainers() {
  for (const { el, overflow } of innerSaved) {
    el.style.overflow = overflow;
  }
  innerSaved = [];
}

function acquireScrollLock() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    lockInnerScrollContainers();
  }
  lockCount += 1;
}

function releaseScrollLock() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = previousBodyOverflow ?? "";
    previousBodyOverflow = null;
    unlockInnerScrollContainers();
  }
}

/** Ref-counted scroll lock for stacked overlays (body + main inner columns). */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    acquireScrollLock();
    return () => releaseScrollLock();
  }, [active]);
}