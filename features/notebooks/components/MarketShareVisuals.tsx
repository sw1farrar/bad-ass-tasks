"use client";

import React from "react";
import { cn } from "@/lib/utils";

const dollarFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatCompetitorCurrency(value: number): string {
  return dollarFormatter.format(value || 0);
}

export function formatCompetitorShare(value: number): string {
  if (value >= 10) return `${value.toFixed(1)}%`;
  if (value >= 1) return `${value.toFixed(1)}%`;
  return `${value.toFixed(2)}%`;
}

export interface MarketShareSegment {
  id: string;
  value: number;
  colorClass: string;
  label: string;
}

export function MarketShareBar({
  segments,
  className,
  heightClass = "h-2.5",
}: {
  segments: MarketShareSegment[];
  className?: string;
  heightClass?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    return (
      <div
        className={cn(
          "rounded-full bg-bg-secondary border border-border-glass",
          heightClass,
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-full bg-bg-secondary border border-border-glass",
        heightClass,
        className,
      )}
      role="img"
      aria-label={segments
        .map((s) => `${s.label}: ${formatCompetitorShare((s.value / total) * 100)}`)
        .join(", ")}
    >
      {segments.map((segment) => {
        const width = (segment.value / total) * 100;
        if (width <= 0) return null;
        return (
          <div
            key={segment.id}
            className={cn("h-full transition-all duration-500", segment.colorClass)}
            style={{ width: `${width}%` }}
            title={`${segment.label}: ${formatCompetitorShare(width)}`}
          />
        );
      })}
    </div>
  );
}

export function MarketShareDonut({
  segments,
  size = 160,
  className,
}: {
  segments: MarketShareSegment[];
  size?: number;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const colorMap: Record<string, string> = {
    "bg-neon-purple/80": "#a855f7",
    "bg-neon-purple/70": "#a855f7",
    "bg-text-faint/50": "#6b7280",
    "bg-text-faint/40": "#6b7280",
    "bg-text-faint/30": "#9ca3af",
    "bg-amber-400/70": "#fbbf24",
    "bg-amber-400/60": "#fbbf24",
    "bg-sky-400/70": "#38bdf8",
    "bg-emerald-400/70": "#34d399",
    "bg-rose-400/70": "#fb7185",
    "bg-orange-400/70": "#fb923c",
    "bg-cyan-400/70": "#22d3ee",
    "bg-violet-400/70": "#a78bfa",
    "bg-lime-400/70": "#a3e635",
  };

  let gradient = "conic-gradient(#374151 0% 100%)";
  if (total > 0) {
    let cursor = 0;
    const stops: string[] = [];
    for (const segment of segments) {
      if (segment.value <= 0) continue;
      const pct = (segment.value / total) * 100;
      const color = colorMap[segment.colorClass] ?? "#6b7280";
      stops.push(`${color} ${cursor}% ${cursor + pct}%`);
      cursor += pct;
    }
    gradient = `conic-gradient(${stops.join(", ")})`;
  }

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Market share breakdown"
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: gradient }}
      />
      <div
        className="absolute rounded-full bg-bg border border-border-glass flex flex-col items-center justify-center text-center"
        style={{
          inset: size * 0.22,
        }}
      >
        <span className="text-[10px] uppercase tracking-wide text-text-faint">Market</span>
        <span className="text-sm font-bold text-text-primary tabular-nums">
          {formatCompetitorCurrency(total)}
        </span>
      </div>
    </div>
  );
}