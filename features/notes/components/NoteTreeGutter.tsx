"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface NoteTreeGutterProps {
  depth: number;
  isLastSibling?: boolean;
  isInActiveFamily?: boolean;
}

/**
 * Fixed-width hierarchy rail: rounded elbows + dot anchors (replaces 1px hairlines).
 */
export function NoteTreeGutter({
  depth,
  isLastSibling = false,
  isInActiveFamily = false,
}: NoteTreeGutterProps) {
  if (depth <= 0) return null;

  return (
    <div
      className={cn(
        "note-tree-gutter",
        `note-tree-gutter--depth-${depth}`,
        isLastSibling && "note-tree-gutter--last",
        isInActiveFamily && "note-tree-gutter--active",
      )}
      aria-hidden
    >
      {Array.from({ length: depth }, (_, index) => (
        <span key={index} className="note-tree-gutter__segment" />
      ))}
      <span className="note-tree-elbow" />
      <span
        className={cn(
          "note-tree-node",
          depth >= 2 && "note-tree-node--grandchild",
        )}
      />
    </div>
  );
}