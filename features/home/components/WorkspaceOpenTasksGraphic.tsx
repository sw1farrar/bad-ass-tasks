"use client";

import React, { useId, useMemo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceOpenTasksGraphicProps {
  openTasks: number;
  overdue?: number;
  className?: string;
}

const SIZE = 56;
const STROKE = 4.5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Deeper crimson for overdue — crisp on small rings (no hot-pink cast). */
const OVERDUE_RED = "#be123c";
const OVERDUE_RED_DEEP = "#9f1239";

type ArcSegment = {
  key: string;
  length: number;
  dashOffset: number;
};

/** Full ring = 100% of open tasks; red slice = overdue share, purple = the rest. */
function buildOpenRingSegments(openTasks: number, overdue: number): ArcSegment[] {
  if (openTasks <= 0) return [];

  const safeOverdue = Math.min(Math.max(overdue, 0), openTasks);
  const onTrack = openTasks - safeOverdue;
  const overdueLength = (safeOverdue / openTasks) * CIRCUMFERENCE;
  const onTrackLength = (onTrack / openTasks) * CIRCUMFERENCE;

  const segments: ArcSegment[] = [];

  if (overdueLength > 0) {
    segments.push({
      key: "overdue",
      length: overdueLength,
      dashOffset: 0,
    });
  }
  if (onTrackLength > 0) {
    segments.push({
      key: "open",
      length: onTrackLength,
      dashOffset: -overdueLength,
    });
  }

  return segments;
}

export function WorkspaceOpenTasksGraphic({
  openTasks,
  overdue = 0,
  className,
}: WorkspaceOpenTasksGraphicProps) {
  const uid = useId().replace(/:/g, "");
  const isAllClear = openTasks <= 0;
  const safeOverdue = Math.min(Math.max(overdue, 0), openTasks);
  const hasOverdue = safeOverdue > 0;

  const segments = useMemo(
    () => buildOpenRingSegments(openTasks, safeOverdue),
    [openTasks, safeOverdue],
  );

  const ariaLabel = isAllClear
    ? "No open tasks"
    : `${openTasks} open task${openTasks === 1 ? "" : "s"}` +
      (hasOverdue ? `, ${safeOverdue} overdue` : "");

  return (
    <div
      className={cn("relative shrink-0", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        shapeRendering="geometricPrecision"
        className="block"
        style={{ transform: "rotate(-90deg)" }}
      >
        <defs>
          <filter id={`ws-ring-glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={`ws-ring-clear-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id={`ws-ring-open-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d8b4fe" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#c084fc" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id={`ws-ring-overdue-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={OVERDUE_RED} stopOpacity="1" />
            <stop offset="100%" stopColor={OVERDUE_RED_DEEP} stopOpacity="1" />
          </linearGradient>
        </defs>

        {isAllClear ? (
          <>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="rgba(52, 211, 153, 0.08)"
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={`url(#ws-ring-clear-${uid})`}
              strokeWidth={STROKE}
              filter={`url(#ws-ring-glow-${uid})`}
              className="home-ws-task-ring-clear"
            />
          </>
        ) : (
          <>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill={hasOverdue ? "rgba(159, 18, 57, 0.07)" : "rgba(192, 132, 252, 0.06)"}
            />
            {segments.map((seg) => (
              <circle
                key={seg.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={
                  seg.key === "overdue"
                    ? `url(#ws-ring-overdue-${uid})`
                    : `url(#ws-ring-open-${uid})`
                }
                strokeWidth={STROKE}
                strokeLinecap="butt"
                strokeDasharray={`${Math.max(seg.length, 0.001)} ${CIRCUMFERENCE}`}
                strokeDashoffset={seg.dashOffset}
                className="home-ws-task-ring-segment"
              />
            ))}
          </>
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {isAllClear ? (
          <Check className="h-4 w-4 text-[#34d399]" strokeWidth={2.5} aria-hidden />
        ) : (
          <>
            <span
              className={cn(
                "text-base font-semibold leading-none tabular-nums",
                hasOverdue ? "text-[#be123c]" : "text-[#f4f4f5]",
              )}
            >
              {openTasks > 99 ? "99+" : openTasks}
            </span>
            <span
              className={cn(
                "text-[7px] uppercase tracking-wider mt-0.5 leading-none",
                hasOverdue ? "text-[#9f1239]" : "text-[#71717a]",
              )}
            >
              {hasOverdue
                ? `${safeOverdue} late`
                : "open"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}