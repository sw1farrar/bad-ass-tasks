"use client";

import { Loader2 } from "lucide-react";

type AuthTransitionPanelProps = {
  title?: string;
  subtitle?: string;
  className?: string;
};

export function AuthTransitionPanel({
  title = "Opening your workspace…",
  subtitle = "Just a moment",
  className,
}: AuthTransitionPanelProps) {
  return (
    <div
      className={`glass modal-panel w-full max-w-md rounded-3xl p-8 text-center ${className ?? ""}`}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-neon-purple" aria-hidden />
      <h2 className="text-2xl font-semibold tracking-tight mb-2">{title}</h2>
      <p className="text-text-secondary text-sm">{subtitle}</p>
    </div>
  );
}