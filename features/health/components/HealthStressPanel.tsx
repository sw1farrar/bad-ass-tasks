"use client";

import React, { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { formatHealthValue } from "@/lib/health/healthMetrics";
import {
  STRESS_RANGE_OPTIONS,
  STRESS_ROLLING_WINDOW_DAYS,
  getStressBand,
  getStressDriverLabel,
  parseStressDrivers,
} from "@/lib/health/stressLabels";
import {
  currentAndPriorWindowAverages,
  dailyStressMeans,
  filterDailyToRange,
  rollingStressAverage,
  stressReadings,
} from "@/lib/health/stressStats";
import type { HealthReading } from "@/types";
import {
  HealthChartCard,
  HealthStressTrendChart,
  HealthHeroCard,
  HealthRangePills,
} from "./HealthCharts";

interface HealthStressPanelProps {
  readings: HealthReading[];
  onDeleteReading: (id: string) => void;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const deltaMin = Math.round((Date.now() - then) / 60000);
  if (deltaMin < 1) return "Just now";
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const hours = Math.round(deltaMin / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function HealthStressPanel({ readings, onDeleteReading }: HealthStressPanelProps) {
  const [rangeDays, setRangeDays] = useState(30);
  const logs = useMemo(() => stressReadings(readings), [readings]);
  const daily = useMemo(() => dailyStressMeans(logs), [logs]);
  const ranged = useMemo(() => filterDailyToRange(daily, rangeDays), [daily, rangeDays]);
  const series = useMemo(
    () => rollingStressAverage(ranged, STRESS_ROLLING_WINDOW_DAYS),
    [ranged],
  );
  const windows = useMemo(() => currentAndPriorWindowAverages(daily), [daily]);
  const latest = logs[0] ?? null;
  const latestDrivers = parseStressDrivers(latest?.metadata);
  const heroBand = windows.current != null ? getStressBand(windows.current) : null;

  const deltaLabel =
    windows.delta == null
      ? windows.current != null
        ? "First week of check-ins"
        : undefined
      : `${windows.delta > 0 ? "+" : ""}${windows.delta.toFixed(1)} vs prior 7 days`;
  const deltaDirection =
    windows.delta == null ? "flat" : windows.delta > 0.05 ? "up" : windows.delta < -0.05 ? "down" : "flat";

  if (logs.length === 0) {
    return (
      <div className="health-stress-panel p-3 md:p-4">
        <HealthChartCard title="Stress" subtitle="Private to you">
          <div className="py-8 text-center space-y-2">
            <p className="text-base font-semibold text-text-primary">How stressed are you?</p>
            <p className="text-sm text-text-muted max-w-sm mx-auto">
              Log a 1–10 check-in to start your rolling average. Teammates never see this.
            </p>
          </div>
        </HealthChartCard>
      </div>
    );
  }

  return (
    <div className="health-stress-panel space-y-4 p-3 md:p-4">
      <HealthHeroCard
        label="7-day average"
        value={windows.current}
        unit="score"
        deltaLabel={deltaLabel}
        deltaDirection={deltaDirection}
        sparkline={series.map((p) => ({ date: p.date, value: p.rolling }))}
      />

      {heroBand && windows.current != null ? (
        <p className="text-sm text-text-secondary px-1">
          You’re in the{" "}
          <span className="font-semibold" style={{ color: heroBand.color }}>
            {heroBand.label.toLowerCase()}
          </span>{" "}
          range
          {latest?.note ? (
            <>
              . Latest: <span className="text-text-primary">“{latest.note}”</span>
            </>
          ) : latestDrivers.length > 0 ? (
            <>
              . Latest drivers:{" "}
              {latestDrivers.map(getStressDriverLabel).join(", ")}
            </>
          ) : (
            "."
          )}
        </p>
      ) : null}

      <HealthChartCard
        title="Rolling average"
        subtitle="Solid line is the 7-day average. Dashed line is each day’s mean."
      >
        <div className="mb-3">
          <HealthRangePills
            value={rangeDays}
            onChange={setRangeDays}
            options={[...STRESS_RANGE_OPTIONS]}
          />
        </div>
        <HealthStressTrendChart
          raw={series.map((p) => ({ date: p.date, value: p.raw }))}
          rolling={series.map((p) => ({ date: p.date, value: p.rolling }))}
          rangeLabel={`${rangeDays} days`}
        />
      </HealthChartCard>

      <HealthChartCard title="Check-ins" subtitle="Only you can see these">
        {logs.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">
            No check-ins yet. Tap Log stress to record how you feel.
          </p>
        ) : (
          <ul className="divide-y divide-border-glass">
            {logs.map((entry) => {
              const band = getStressBand(entry.value);
              const drivers = parseStressDrivers(entry.metadata);
              return (
                <li key={entry.id} className="flex items-start gap-3 py-3 min-w-0">
                  <span
                    className="mt-0.5 shrink-0 h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold tabular-nums"
                    style={{ backgroundColor: `${band.color}22`, color: band.color }}
                    aria-label={`Stress ${entry.value}, ${band.label}`}
                  >
                    {formatHealthValue(entry.value, "score")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-text-primary">{band.label}</span>
                      <span className="text-xs text-text-muted">{formatRelative(entry.recordedAt)}</span>
                    </div>
                    {drivers.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {drivers.map((id) => (
                          <span
                            key={id}
                            className="rounded-full bg-surface-hover text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 text-text-secondary"
                          >
                            {getStressDriverLabel(id)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {entry.note ? (
                      <p className="mt-1 text-sm text-text-secondary break-words">{entry.note}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteReading(entry.id)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-400/10 shrink-0"
                    aria-label="Delete check-in"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </HealthChartCard>
    </div>
  );
}
