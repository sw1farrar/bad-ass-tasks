"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";

interface WorkspaceItemDeepLinkProps {
  workspaceName: string;
  destination: "Tasks" | "Lists";
  onNavigate: () => void;
  className?: string;
}

export function WorkspaceItemDeepLink({
  workspaceName,
  destination,
  onNavigate,
  className,
}: WorkspaceItemDeepLinkProps) {
  return (
    <button
      type="button"
      onClick={onNavigate}
      className={
        className ??
        "inline-flex items-center gap-1.5 text-xs text-[#c084fc] hover:text-[#d8b4fe] transition mt-2 group"
      }
    >
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
      <span>
        Open in <span className="font-medium text-[#e4e4e7]">{workspaceName}</span>
        <span className="text-[#71717a]"> · {destination}</span>
      </span>
    </button>
  );
}