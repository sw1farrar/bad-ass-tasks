"use client";

import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SharedListBadgeProps {
  sourceWorkspaceName?: string;
  sharedByName?: string;
  className?: string;
}

export function SharedListBadge({
  sourceWorkspaceName,
  sharedByName,
  className,
}: SharedListBadgeProps) {
  if (!sourceWorkspaceName) return null;

  const title = sharedByName
    ? `Shared from ${sourceWorkspaceName} by ${sharedByName}`
    : `Shared from ${sourceWorkspaceName}`;

  return (
    <div
      className={cn("list-header-badge list-card-shared-badge mb-1", className)}
      title={title}
    >
      <Link2 className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      <span>Shared from {sourceWorkspaceName}</span>
    </div>
  );
}