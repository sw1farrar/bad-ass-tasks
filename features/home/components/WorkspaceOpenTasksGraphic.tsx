"use client";

import React, { useMemo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceOpenTasksGraphicProps {
  openTasks: number;
  overdue?: number;
  dueToday?: number;
  size?: 48 | 56 | 60 | 72 | 80 | 96;
  className?: string;
  showSublabel?: boolean;
}

type ArcSegment = {
  key: "overdue" | "dueToday" | "open";
  length: number;
  dashOffset: number;
};

function ringMetrics(size: number) {
  const stroke = size >= 96 ? 6 : size >= 72 ? 5 : 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return { stroke, radius, circumference, size };
}

/** Full ring = 100% of open tasks; red = overdue, orange = due today, purple = the rest. */
function buildOpenRingSegments(
  openTasks: number,
  overdue: number,
  dueToday: number,
  circumference: number,
): ArcSegment[] {
  if (openTasks <= 0) return [];

  const safeOverdue = Math.min(Math.max(overdue, 0), openTasks);
  const remainingAfterOverdue = openTasks - safeOverdue;
  const safeDueToday = Math.min(Math.max(dueToday, 0), remainingAfterOverdue);
  const onTrack = remainingAfterOverdue - safeDueToday;

  const overdueLength = (safeOverdue / openTasks) * circumference;
  const dueTodayLength = (safeDueToday / openTasks) * circumference;
  const onTrackLength = (onTrack / openTasks) * circumference;

  const segments: ArcSegment[] = [];
  let offset = 0;

  if (overdueLength > 0) {
    segments.push({
      key: "overdue",
      length: overdueLength,
      dashOffset: offset,
    });
    offset -= overdueLength;
  }
  if (dueTodayLength > 0) {
    segments.push({
      key: "dueToday",
      length: dueTodayLength,
      dashOffset: offset,
    });
    offset -= dueTodayLength;
  }
  if (onTrackLength > 0) {
    segments.push({
      key: "open",
      length: onTrackLength,
      dashOffset: offset,
    });
  }

  return segments;
}

function segmentClassName(key: ArcSegment["key"]): string {
  switch (key) {
    case "overdue":
      return "home-ws-task-ring-segment--overdue";
    case "dueToday":
      return "home-ws-task-ring-segment--due-today";
    default:
      return "home-ws-task-ring-segment--open";
  }
}

export function WorkspaceOpenTasksGraphic({
  openTasks,
  overdue = 0,
  dueToday = 0,
  size = 56,
  className,
  showSublabel = true,
}: WorkspaceOpenTasksGraphicProps) {
  const { stroke, radius, circumference } = ringMetrics(size);
  const isAllClear = openTasks <= 0;
  const safeOverdue = Math.min(Math.max(overdue, 0), openTasks);
  const safeDueToday = Math.min(
    Math.max(dueToday, 0),
    Math.max(openTasks - safeOverdue, 0),
  );
  const hasOverdue = safeOverdue > 0;
  const hasDueToday = safeDueToday > 0;

  const segments = useMemo(
    () => buildOpenRingSegments(openTasks, safeOverdue, safeDueToday, circumference),
    [openTasks, safeOverdue, safeDueToday, circumference],
  );

  const ariaLabel = isAllClear
    ? "No open tasks"
    : `${openTasks} open task${openTasks === 1 ? "" : "s"}` +
      (hasOverdue ? `, ${safeOverdue} overdue` : "") +
      (hasDueToday ? `, ${safeDueToday} due today` : "");

  const countAccentClass = hasOverdue
    ? "home-ws-task-ring-count--overdue"
    : hasDueToday
      ? "home-ws-task-ring-count--due-today"
      : "text-neon-purple";

  const subLabel = hasOverdue
    ? `${safeOverdue} late`
    : hasDueToday
      ? `${safeDueToday} today`
      : "open";

  const subLabelClass = hasOverdue
    ? "home-ws-task-ring-sublabel--overdue"
    : hasDueToday
      ? "home-ws-task-ring-sublabel--due-today"
      : "text-text-muted";

  const countSizeClass =
    size >= 96 ? "text-2xl" : size >= 80 ? "text-xl" : size >= 72 ? "text-lg" : "text-base";
  const subLabelSizeClass =
    size >= 96 ? "text-[9px]" : size >= 72 ? "text-[8px]" : "text-[7px]";
  const checkSizeClass = size >= 96 ? "h-6 w-6" : size >= 72 ? "h-5 w-5" : "h-4 w-4";

  return (
    <div
      className={cn("relative shrink-0", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        shapeRendering="geometricPrecision"
        className="home-ws-task-ring-graphic block"
        aria-hidden
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {isAllClear ? (
            <>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="var(--success-subtle)"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={stroke}
                className="home-ws-task-ring-clear"
              />
            </>
          ) : (
            <>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={stroke}
                className="home-ws-task-ring-track"
              />
              {segments.map((seg) => (
                <circle
                  key={seg.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  strokeWidth={stroke}
                  strokeLinecap="butt"
                  strokeDasharray={`${Math.max(seg.length, 0.001)} ${circumference}`}
                  strokeDashoffset={seg.dashOffset}
                  className={cn("home-ws-task-ring-segment", segmentClassName(seg.key))}
                />
              ))}
            </>
          )}
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {isAllClear ? (
          <Check className={cn(checkSizeClass, "text-neon-green")} strokeWidth={2.5} aria-hidden />
        ) : (
          <>
            <span
              className={cn(
                countSizeClass,
                "font-semibold leading-none tabular-nums",
                countAccentClass,
              )}
            >
              {openTasks > 99 ? "99+" : openTasks}
            </span>
            {showSublabel && (
              <span
                className={cn(
                  subLabelSizeClass,
                  "uppercase tracking-wider mt-0.5 leading-none",
                  subLabelClass,
                )}
              >
                {subLabel}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}