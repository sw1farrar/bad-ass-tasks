"use client";

import React from "react";

interface ListItemInsertionIndicatorProps {
  depth?: number;
}

export function ListItemInsertionIndicator({ depth = 0 }: ListItemInsertionIndicatorProps) {
  return (
    <div
      className="list-item-insertion-indicator"
      style={{ ["--list-item-depth" as string]: depth }}
      aria-hidden="true"
    />
  );
}