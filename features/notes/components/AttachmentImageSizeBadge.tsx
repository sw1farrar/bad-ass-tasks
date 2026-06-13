"use client";

import { formatBytes } from "@/lib/files/formatBytes";
import { cn } from "@/lib/utils";

export function AttachmentImageSizeBadge({
  sizeBytes,
  className,
}: {
  sizeBytes: number;
  className?: string;
}) {
  const label = formatBytes(sizeBytes);
  if (!label) return null;

  return (
    <span className={cn("note-attachment-thumb-size", className)} aria-hidden>
      {label}
    </span>
  );
}