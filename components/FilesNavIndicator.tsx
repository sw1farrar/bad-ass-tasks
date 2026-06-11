"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface FilesNavIndicatorProps {
  reviewCount: number;
  variant?: "sidebar" | "bottom";
  className?: string;
}

export function FilesNavIndicator({
  reviewCount,
  variant = "sidebar",
  className,
}: FilesNavIndicatorProps) {
  if (reviewCount <= 0) return null;

  const display = reviewCount > 99 ? "99+" : String(reviewCount);
  const ariaLabel = `${reviewCount} file${reviewCount === 1 ? "" : "s"} in Review`;

  if (variant === "bottom") {
    return (
      <span
        className={cn("nav-count-badge nav-count-badge--bottom", className)}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        {display}
      </span>
    );
  }

  return (
    <span
      className={cn("nav-count-badge nav-count-badge--sidebar", className)}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {display}
    </span>
  );
}