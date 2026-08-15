"use client";

import { useEffect } from "react";

/** Inner scroll surfaces that can scroll behind modals on desktop (body lock alone is insufficient). */
const INNER_SCROLL_LOCK_SELECTOR =
  ".main-content, .tasks-root .tasks-workspace, .lists-root .lists-workspace, .notes-root .notes-editor-scroll, .settings-root .settings-workspace, .files-root .files-list-scroll, .files-root .files-review-list, .files-root .notes-files-preview-body, .notebooks-note-editor:not(.notebooks-note-editor--expanded) .notes-editor-scroll-body, .notebooks-root .files-mobile-list-scroll, .notebooks-root .notebooks-section-panel, .meetings-root .meeting-agenda-board__list, .meetings-root .meeting-summary-view__canvas, .health-workspace__content, .list-detail-body";

type SavedOverflow = { el: HTMLElement; overflow: string };

let lockCount = 0;
let previousBodyOverflow: string | null = null;
let previousHtmlOverflow: string | null = null;
let previousHtmlOverscroll: string | null = null;
let previousBodyOverscroll: string | null = null;
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
    previousHtmlOverflow = document.documentElement.style.overflow;
    previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    previousBodyOverscroll = document.body.style.overscrollBehavior;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.documentElement.classList.add("scroll-locked");
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    lockInnerScrollContainers();
  }
  lockCount += 1;
}

function releaseScrollLock() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = previousBodyOverflow ?? "";
    document.body.style.overscrollBehavior = previousBodyOverscroll ?? "";
    document.documentElement.style.overflow = previousHtmlOverflow ?? "";
    document.documentElement.style.overscrollBehavior = previousHtmlOverscroll ?? "";
    document.documentElement.classList.remove("scroll-locked");
    previousBodyOverflow = null;
    previousHtmlOverflow = null;
    previousHtmlOverscroll = null;
    previousBodyOverscroll = null;
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