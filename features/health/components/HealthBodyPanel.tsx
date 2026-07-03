"use client";

import React, { useMemo } from "react";
import { memberColorMap } from "@/lib/health/healthAggregates";
import { formatHealthValue, getHealthMetricDef } from "@/lib/health/healthMetrics";
import type { HealthReading, WorkspaceMember } from "@/types";
import { HealthBarChart, HealthChartCard } from "./HealthCharts";
import { HealthRecentEntries } from "./HealthRecentEntries";

const BODY_METRICS = ["body_fat", "muscle_mass", "waist"] as const;

interface HealthBodyPanelProps {
  readings: HealthReading[];
  members: WorkspaceMember[];
  selectedMemberId: string | "all";
  onDeleteReading: (id: string) => void;
}

export function HealthBodyPanel({
  readings,
  members,
  selectedMemberId,
  onDeleteReading,
}: HealthBodyPanelProps) {
  const colorMap = useMemo(() => memberColorMap(members), [members]);

  const bodyReadings = readings.filter(
    (r) =>
      BODY_METRICS.includes(r.metricType as (typeof BODY_METRICS)[number]) &&
      (selectedMemberId === "all" || r.userId === selectedMemberId),
  );

  const barLabels: string[] = [];
  const barValues: number[] = [];
  for (const metric of BODY_METRICS) {
    const latest = bodyReadings.find((r) => r.metricType === metric);
    if (latest) {
      barLabels.push(getHealthMetricDef(metric).label);
      barValues.push(latest.value);
    }
  }

  const fat = bodyReadings.find((r) => r.metricType === "body_fat");
  const muscle = bodyReadings.find((r) => r.metricType === "muscle_mass");
  const compositionSegments =
    fat && muscle
      ? [
          { label: "Body fat", value: fat.value, pct: fat.value },
          { label: "Lean", value: muscle.value, pct: muscle.value },
        ]
      : [];

  return (
    <div className="health-body-panel space-y-4 p-3 md:p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HealthChartCard title="Latest measurements" subtitle="Most recent per metric">
          {barLabels.length > 0 ? (
            <HealthBarChart
              labels={barLabels}
              values={barValues}
              unit={bodyReadings[0]?.unit ?? "%"}
              color="#a855f7"
            />
          ) : (
            <p className="text-sm text-text-muted text-center py-10">Log body metrics to see charts.</p>
          )}
        </HealthChartCard>
        <HealthChartCard title="Composition" subtitle="Body fat vs muscle mass">
          {compositionSegments.length === 2 ? (
            <div className="space-y-4 pt-2">
              {compositionSegments.map((s) => {
                const total = compositionSegments.reduce((sum, x) => sum + x.value, 0);
                const pct = total > 0 ? (s.value / total) * 100 : 0;
                return (
                  <div key={s.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{s.label}</span>
                      <span className="tabular-nums">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-bg-secondary border border-border-glass overflow-hidden">
                      <div
                        className="h-full rounded-full bg-neon-purple/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-muted text-center py-10">
              Log both body fat and muscle mass for composition view.
            </p>
          )}
        </HealthChartCard>
      </div>

      <HealthChartCard title="Body log">
        <HealthRecentEntries
          readings={bodyReadings}
          members={members}
          colorMap={colorMap}
          onDelete={onDeleteReading}
        />
      </HealthChartCard>
    </div>
  );
}