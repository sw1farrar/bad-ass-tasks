"use client";

import React, { useId, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SparklinePoint } from "@/lib/health/healthAggregates";
import { formatHealthValue } from "@/lib/health/healthMetrics";

const CHART_WIDTH = 360;
const CHART_HEIGHT = 120;
const PADDING_X = 12;
const PADDING_Y = 14;

function chartPoints(
  values: number[],
  width: number,
  height: number,
  minY?: number,
  maxY?: number,
): Array<{ x: number; y: number }> {
  if (values.length === 0) return [];
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const min = minY ?? dataMin;
  const max = maxY ?? dataMax;
  const span = Math.max(max - min, 0.001);
  const innerW = width - PADDING_X * 2;
  const innerH = height - PADDING_Y * 2;
  return values.map((value, index) => {
    const x = PADDING_X + (index / Math.max(values.length - 1, 1)) * innerW;
    const y = PADDING_Y + innerH - ((value - min) / span) * innerH;
    return { x, y };
  });
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    path += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return path;
}

function buildAreaPath(points: Array<{ x: number; y: number }>, height: number): string {
  if (points.length === 0) return "";
  const line = buildSmoothPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x} ${height - PADDING_Y} L ${first.x} ${height - PADDING_Y} Z`;
}

export function HealthChartCard({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("health-chart-card glass rounded-2xl border border-border-glass p-4 md:p-5", className)}
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {subtitle ? <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p> : null}
      </div>
      {children}
    </motion.div>
  );
}

export function HealthHeroCard({
  label,
  value,
  unit,
  deltaLabel,
  deltaDirection,
  sparkline,
}: {
  label: string;
  value: number | null;
  unit: string;
  deltaLabel?: string;
  deltaDirection?: "up" | "down" | "flat";
  sparkline: SparklinePoint[];
}) {
  const uid = useId().replace(/:/g, "");
  const values = sparkline.map((p) => p.value);
  const points = useMemo(
    () => chartPoints(values, 200, 56),
    [values],
  );
  const linePath = buildSmoothPath(points);
  const areaPath = buildAreaPath(points, 56);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="health-hero-card glass rounded-2xl border border-border-glass p-5 md:p-6 col-span-full lg:col-span-2"
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-muted font-medium">{label}</p>
          <p className="health-hero-value text-4xl md:text-5xl font-bold text-text-primary mt-1 tabular-nums">
            {value != null ? formatHealthValue(value, unit) : "—"}
          </p>
          {deltaLabel ? (
            <p
              className={cn(
                "text-sm font-medium mt-2",
                deltaDirection === "down"
                  ? "text-emerald-400"
                  : deltaDirection === "up"
                    ? "text-rose-400"
                    : "text-text-muted",
              )}
            >
              {deltaLabel}
            </p>
          ) : null}
        </div>
        {sparkline.length > 1 ? (
          <svg viewBox="0 0 200 56" className="w-full sm:w-48 h-14" role="img" aria-label={`${label} trend`}>
            <defs>
              <linearGradient id={`${uid}-hero-area`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--neon-purple)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--neon-purple)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {areaPath ? <path d={areaPath} fill={`url(#${uid}-hero-area)`} /> : null}
            {linePath ? (
              <path d={linePath} fill="none" stroke="var(--neon-purple)" strokeWidth="2" strokeLinecap="round" />
            ) : null}
          </svg>
        ) : null}
      </div>
    </motion.div>
  );
}

export function HealthGoalRing({
  progress,
  label,
  currentLabel,
  goalLabel,
}: {
  progress: number | null;
  label: string;
  currentLabel: string;
  goalLabel: string;
}) {
  const pct = progress ?? 0;
  const size = 140;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <HealthChartCard title={label} subtitle="Progress toward goal">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <svg width={size} height={size} className="shrink-0 -rotate-90" role="img" aria-label={`${Math.round(pct)}% to goal`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-glass)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--neon-purple)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="space-y-2 text-sm">
          <p className="text-3xl font-bold text-neon-purple-tint tabular-nums">
            {progress != null ? `${Math.round(pct)}%` : "—"}
          </p>
          <p className="text-text-secondary">{currentLabel}</p>
          <p className="text-text-muted text-xs">{goalLabel}</p>
        </div>
      </div>
    </HealthChartCard>
  );
}

export function HealthAreaChart({
  series,
  unit,
  goalLine,
  rangeLabel,
}: {
  series: SparklinePoint[];
  unit: string;
  goalLine?: number | null;
  rangeLabel: string;
}) {
  const uid = useId().replace(/:/g, "");
  const values = series.map((p) => p.value);
  const goal = goalLine ?? null;
  const minY = goal != null ? Math.min(...values, goal) * 0.98 : undefined;
  const maxY = goal != null ? Math.max(...values, goal) * 1.02 : undefined;
  const points = useMemo(
    () => chartPoints(values, CHART_WIDTH, CHART_HEIGHT, minY, maxY),
    [values, minY, maxY],
  );
  const linePath = buildSmoothPath(points);
  const areaPath = buildAreaPath(points, CHART_HEIGHT);

  let goalY: number | null = null;
  if (goal != null && values.length > 0) {
    const dataMin = minY ?? Math.min(...values);
    const dataMax = maxY ?? Math.max(...values);
    const span = Math.max(dataMax - dataMin, 0.001);
    const innerH = CHART_HEIGHT - PADDING_Y * 2;
    goalY = PADDING_Y + innerH - ((goal - dataMin) / span) * innerH;
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full h-32 md:h-36"
        role="img"
        aria-label={`Trend over ${rangeLabel}`}
      >
        <defs>
          <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--neon-purple)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--neon-purple)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {goalY != null ? (
          <line
            x1={PADDING_X}
            x2={CHART_WIDTH - PADDING_X}
            y1={goalY}
            y2={goalY}
            stroke="var(--success)"
            strokeWidth="1.5"
            strokeDasharray="6 4"
            opacity="0.7"
          />
        ) : null}
        {areaPath ? <path d={areaPath} fill={`url(#${uid}-area)`} /> : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke="var(--neon-purple)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ) : null}
        {points.map((pt, i) => (
          <circle
            key={series[i]?.date ?? i}
            cx={pt.x}
            cy={pt.y}
            r={3}
            fill="var(--accent-purple-text)"
            opacity={0.9}
          />
        ))}
      </svg>
      {series.length > 0 ? (
        <div className="flex justify-between text-[10px] text-text-muted mt-1 px-1">
          <span>{new Date(series[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          <span>{formatHealthValue(series[series.length - 1].value, unit)}</span>
          <span>{new Date(series[series.length - 1].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        </div>
      ) : (
        <p className="text-xs text-text-muted text-center py-6">No data for this range yet.</p>
      )}
    </div>
  );
}

export function HealthSparklineGrid({
  cards,
}: {
  cards: Array<{ title: string; value: string; series: SparklinePoint[]; color?: string }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => {
        const uid = useId().replace(/:/g, "");
        const values = card.series.map((p) => p.value);
        const points = chartPoints(values, 120, 40);
        const linePath = buildSmoothPath(points);
        return (
          <div
            key={card.title}
            className="rounded-xl border border-border-glass bg-bg-secondary/40 p-3"
          >
            <p className="text-[10px] uppercase tracking-wider text-text-muted">{card.title}</p>
            <p className="text-lg font-bold text-text-primary tabular-nums mt-0.5">{card.value}</p>
            {values.length > 1 ? (
              <svg viewBox="0 0 120 40" className="w-full h-8 mt-2">
                <path
                  d={linePath}
                  fill="none"
                  stroke={card.color ?? "var(--neon-purple)"}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <div className="h-8 mt-2 rounded bg-border-glass/30" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function HealthBarChart({
  labels,
  values,
  unit,
  color = "var(--neon-purple)",
}: {
  labels: string[];
  values: number[];
  unit: string;
  color?: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end justify-between gap-2 h-36 px-1">
      {values.map((v, i) => {
        const h = (v / max) * 100;
        return (
          <div key={labels[i]} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-text-muted tabular-nums truncate w-full text-center">
              {v > 0 ? formatHealthValue(v, unit) : ""}
            </span>
            <div className="w-full flex items-end justify-center h-24">
              <div
                className="w-full max-w-[28px] rounded-t-md transition-all duration-500"
                style={{ height: `${h}%`, backgroundColor: color, opacity: v > 0 ? 0.85 : 0.15 }}
              />
            </div>
            <span className="text-[10px] font-medium text-text-secondary">{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function HealthTeamStrip({
  rows,
}: {
  rows: Array<{ id: string; label: string; value: number; max: number; color: string; sublabel?: string }>;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = row.max > 0 ? (row.value / row.max) * 100 : 0;
        return (
          <div key={row.id}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-text-primary">{row.label}</span>
              <span className="text-text-muted tabular-nums">{row.sublabel}</span>
            </div>
            <div className="h-2.5 rounded-full bg-bg-secondary border border-border-glass overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, pct)}%`, backgroundColor: row.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HealthDualLineChart({
  seriesA,
  seriesB,
  labelA,
  labelB,
}: {
  seriesA: SparklinePoint[];
  seriesB: SparklinePoint[];
  labelA: string;
  labelB: string;
}) {
  const valuesA = seriesA.map((p) => p.value);
  const valuesB = seriesB.map((p) => p.value);
  const all = [...valuesA, ...valuesB];
  const minY = all.length ? Math.min(...all) * 0.95 : undefined;
  const maxY = all.length ? Math.max(...all) * 1.05 : undefined;
  const pointsA = useMemo(
    () => chartPoints(valuesA, CHART_WIDTH, CHART_HEIGHT, minY, maxY),
    [valuesA, minY, maxY],
  );
  const pointsB = useMemo(
    () => chartPoints(valuesB, CHART_WIDTH, CHART_HEIGHT, minY, maxY),
    [valuesB, minY, maxY],
  );

  return (
    <div>
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-32">
        <path d={buildSmoothPath(pointsA)} fill="none" stroke="var(--neon-purple)" strokeWidth="2.25" />
        <path
          d={buildSmoothPath(pointsB)}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
          strokeDasharray="5 3"
        />
      </svg>
      <div className="flex gap-4 text-[11px] text-text-muted mt-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-neon-purple" /> {labelA}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-400" /> {labelB}
        </span>
      </div>
    </div>
  );
}

export function HealthRangePills({
  value,
  onChange,
  options,
}: {
  value: number;
  onChange: (days: number) => void;
  options: Array<{ days: number; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.days}
          type="button"
          onClick={() => onChange(opt.days)}
          className={cn(
            "rounded-full px-3.5 py-2 min-h-[44px] text-xs font-semibold border transition",
            value === opt.days
              ? "bg-neon-purple/15 text-neon-purple-tint border-neon-purple/30"
              : "text-text-secondary border-border-glass hover:bg-surface-hover",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}