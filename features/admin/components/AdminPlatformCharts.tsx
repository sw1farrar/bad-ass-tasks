"use client";

import React, { useId, useMemo } from "react";
import { motion } from "framer-motion";
import type { PlatformAnalytics, PlatformStats } from "@/lib/admin/platformData";
import { cn } from "@/lib/utils";

const CHART_WIDTH = 320;
const CHART_HEIGHT = 96;
const PADDING_X = 8;
const PADDING_Y = 10;

function chartPoints(values: number[], width: number, height: number): Array<{ x: number; y: number }> {
  if (values.length === 0) return [];
  const max = Math.max(...values, 1);
  const innerW = width - PADDING_X * 2;
  const innerH = height - PADDING_Y * 2;
  return values.map((value, index) => {
    const x = PADDING_X + (index / Math.max(values.length - 1, 1)) * innerW;
    const y = PADDING_Y + innerH - (value / max) * innerH;
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

interface ChartCardProps {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, className, children }: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn("site-admin-chart-card", className)}
    >
      <div className="site-admin-chart-header">
        <div>
          <h3 className="site-admin-chart-title">{title}</h3>
          {subtitle ? <p className="site-admin-chart-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

export function AdminEngagementHero({
  stats,
  analytics,
}: {
  stats: PlatformStats;
  analytics: PlatformAnalytics;
}) {
  const uid = useId().replace(/:/g, "");
  const values = analytics.activityByDay.map((d) => d.events);
  const points = useMemo(
    () => chartPoints(values, CHART_WIDTH, CHART_HEIGHT),
    [values],
  );
  const linePath = buildSmoothPath(points);
  const areaPath = buildAreaPath(points, CHART_HEIGHT);
  const total14d = values.reduce((sum, v) => sum + v, 0);

  return (
    <ChartCard
      title="Platform engagement"
      subtitle="Meaningful activity over the last 14 days (workspace switches excluded)"
      className="site-admin-chart-hero"
    >
      <div className="site-admin-hero-grid">
        <div className="site-admin-hero-metrics">
          <div className="site-admin-hero-metric">
            <div className="site-admin-hero-metric-value">{analytics.engagementRate7d}%</div>
            <div className="site-admin-hero-metric-label">Active users (7d)</div>
            <div className="site-admin-hero-metric-hint">
              {stats.activeUsers7d.toLocaleString()} of {stats.totalUsers.toLocaleString()} users
            </div>
          </div>
          <div className="site-admin-hero-metric">
            <div className="site-admin-hero-metric-value">{total14d.toLocaleString()}</div>
            <div className="site-admin-hero-metric-label">Events (14d)</div>
            <div className="site-admin-hero-metric-hint">
              Peak: {analytics.peakDay ? `${analytics.peakDay.count} on ${analytics.peakDay.label}` : "—"}
            </div>
          </div>
          <div className="site-admin-hero-metric">
            <div className="site-admin-hero-metric-value">{analytics.contentEvents7d.toLocaleString()}</div>
            <div className="site-admin-hero-metric-label">Content actions (7d)</div>
            <div className="site-admin-hero-metric-hint">Tasks + notes created or completed</div>
          </div>
        </div>

        <div className="site-admin-sparkline-wrap">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="site-admin-sparkline"
            role="img"
            aria-label="14-day activity trend"
          >
            <defs>
              <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--neon-purple)" stopOpacity="0.45" />
                <stop offset="100%" stopColor="var(--neon-purple)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${uid}-line`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--neon-purple-dark)" />
                <stop offset="100%" stopColor="var(--neon-purple)" />
              </linearGradient>
            </defs>
            {areaPath ? <path d={areaPath} fill={`url(#${uid}-area)`} /> : null}
            {linePath ? (
              <path
                d={linePath}
                fill="none"
                stroke={`url(#${uid}-line)`}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ) : null}
            {points.map((point, index) => (
              <circle
                key={analytics.activityByDay[index]?.date ?? index}
                cx={point.x}
                cy={point.y}
                r={values[index] > 0 ? 2.5 : 0}
                fill="var(--accent-purple-text)"
              />
            ))}
          </svg>
          <div className="site-admin-sparkline-labels">
            <span>{analytics.activityByDay[0]?.label}</span>
            <span>{analytics.activityByDay[analytics.activityByDay.length - 1]?.label}</span>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

export function AdminActivityTrendChart({ analytics }: { analytics: PlatformAnalytics }) {
  const uid = useId().replace(/:/g, "");
  const events = analytics.activityByDay.map((d) => d.events);
  const users = analytics.activityByDay.map((d) => d.uniqueUsers);
  const eventPoints = useMemo(
    () => chartPoints(events, CHART_WIDTH, CHART_HEIGHT),
    [events],
  );
  const userPoints = useMemo(
    () => chartPoints(users, CHART_WIDTH, CHART_HEIGHT),
    [users],
  );

  return (
    <ChartCard
      title="Activity & participation"
      subtitle="Daily events vs unique contributors"
    >
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="site-admin-sparkline"
        role="img"
        aria-label="Daily activity and unique users"
      >
        <defs>
          <linearGradient id={`${uid}-events-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--neon-purple)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--neon-purple)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={buildAreaPath(eventPoints, CHART_HEIGHT)} fill={`url(#${uid}-events-area)`} />
        <path
          d={buildSmoothPath(eventPoints)}
          fill="none"
          stroke="var(--neon-purple)"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
        <path
          d={buildSmoothPath(userPoints)}
          fill="none"
          stroke="var(--success)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 4"
        />
      </svg>
      <div className="site-admin-chart-legend">
        <span><i className="site-admin-legend-dot is-purple" /> Events</span>
        <span><i className="site-admin-legend-dot is-green" /> Unique users</span>
      </div>
      <div className="site-admin-bar-labels">
        {analytics.activityByDay.map((day) => (
          <span key={day.date} title={`${day.events} events · ${day.uniqueUsers} users`}>
            {day.label.split(" ")[0]}
          </span>
        ))}
      </div>
    </ChartCard>
  );
}

export function AdminSignupChart({ analytics }: { analytics: PlatformAnalytics }) {
  const max = Math.max(...analytics.signupsByDay.map((d) => d.count), 1);

  return (
    <ChartCard title="New signups" subtitle="Account creation over 14 days">
      <div className="site-admin-bar-chart">
        {analytics.signupsByDay.map((day) => {
          const heightPct = (day.count / max) * 100;
          return (
            <div key={day.date} className="site-admin-bar-col" title={`${day.label}: ${day.count}`}>
              <div className="site-admin-bar-track">
                <motion.div
                  className="site-admin-bar-fill is-blue"
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(heightPct, day.count > 0 ? 8 : 0)}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <span className="site-admin-bar-value">{day.count > 0 ? day.count : ""}</span>
              <span className="site-admin-bar-label">{day.label.split(" ")[0]}</span>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

export function AdminActivityMixDonut({ analytics }: { analytics: PlatformAnalytics }) {
  const total = analytics.activityMix.reduce((sum, slice) => sum + slice.count, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = analytics.activityMix.map((slice) => {
    const pct = total > 0 ? slice.count / total : 0;
    const length = pct * circumference;
    const segment = { ...slice, length, offset, pct };
    offset += length;
    return segment;
  });

  return (
    <ChartCard title="What people are doing" subtitle="Activity mix (14 days)">
      {total === 0 ? (
        <div className="site-admin-chart-empty">No tracked activity in this window yet.</div>
      ) : (
        <div className="site-admin-donut-layout">
          <svg viewBox="0 0 120 120" className="site-admin-donut" role="img" aria-label="Activity mix breakdown">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="14"
            />
            {segments.map((segment) => (
              <circle
                key={segment.key}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="14"
                strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                strokeDashoffset={-segment.offset}
                strokeLinecap="butt"
                transform="rotate(-90 60 60)"
              />
            ))}
            <text x="60" y="56" textAnchor="middle" className="site-admin-donut-total">
              {total}
            </text>
            <text x="60" y="72" textAnchor="middle" className="site-admin-donut-caption">
              events
            </text>
          </svg>
          <ul className="site-admin-donut-legend">
            {segments.map((segment) => (
              <li key={segment.key}>
                <span className="site-admin-donut-swatch" style={{ background: segment.color }} />
                <span className="site-admin-donut-label">{segment.label}</span>
                <span className="site-admin-donut-pct">{Math.round(segment.pct * 100)}%</span>
                <span className="site-admin-donut-count">{segment.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

export function AdminVitalsStrip({ stats }: { stats: PlatformStats }) {
  const vitals = [
    { label: "Users", value: stats.totalUsers, accent: "purple" as const },
    { label: "Workspaces", value: stats.totalWorkspaces, accent: "blue" as const },
    { label: "Tasks", value: stats.totalTasks, accent: "purple" as const },
    { label: "Notes", value: stats.totalNotes, accent: "blue" as const },
    { label: "Comments", value: stats.totalComments, accent: "amber" as const },
    { label: "Signups 24h", value: stats.signupsLast24h, accent: "green" as const },
    { label: "Activity 24h", value: stats.activityLast24h, accent: "purple" as const },
  ];

  return (
    <div className="site-admin-vitals-strip">
      {vitals.map((vital) => (
        <div key={vital.label} className={`site-admin-vital is-${vital.accent}`}>
          <div className="site-admin-vital-value">{vital.value.toLocaleString()}</div>
          <div className="site-admin-vital-label">{vital.label}</div>
        </div>
      ))}
    </div>
  );
}