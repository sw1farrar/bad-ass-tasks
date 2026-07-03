"use client";

import React, { useMemo } from "react";
import { buildDailySeries, memberColorMap } from "@/lib/health/healthAggregates";
import { formatHealthValue } from "@/lib/health/healthMetrics";
import type { HealthReading, WorkspaceMember } from "@/types";
import { HealthBarChart, HealthChartCard, HealthDualLineChart } from "./HealthCharts";
import { HealthRecentEntries } from "./HealthRecentEntries";

interface HealthVitalsPanelProps {
  readings: HealthReading[];
  members: WorkspaceMember[];
  selectedMemberId: string | "all";
  onDeleteReading: (id: string) => void;
}

export function HealthVitalsPanel({
  readings,
  members,
  selectedMemberId,
  onDeleteReading,
}: HealthVitalsPanelProps) {
  const colorMap = useMemo(() => memberColorMap(members), [members]);

  const vitalsReadings = readings.filter(
    (r) =>
      ["blood_pressure_systolic", "resting_hr", "sleep_hours"].includes(r.metricType) &&
      (selectedMemberId === "all" || r.userId === selectedMemberId),
  );

  const bpReadings = vitalsReadings.filter((r) => r.metricType === "blood_pressure_systolic");
  const sleepReadings = vitalsReadings.filter((r) => r.metricType === "sleep_hours");
  const hrReadings = vitalsReadings.filter((r) => r.metricType === "resting_hr");

  const sysSeries = buildDailySeries(bpReadings, 30);
  const diaSeries = bpReadings
    .filter((r) => r.metadata?.diastolic != null)
    .map((r) => ({
      date: r.recordedAt.slice(0, 10),
      value: Number(r.metadata?.diastolic),
    }));

  const sleepSeries = buildDailySeries(sleepReadings, 14);
  const sleepLabels = sleepSeries.map((p) =>
    new Date(p.date).toLocaleDateString(undefined, { weekday: "narrow" }),
  );

  return (
    <div className="health-vitals-panel space-y-4 p-3 md:p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HealthChartCard title="Blood pressure" subtitle="Systolic (solid) · diastolic (dashed)">
          {sysSeries.length > 1 ? (
            <HealthDualLineChart
              seriesA={sysSeries}
              seriesB={diaSeries}
              labelA="Systolic"
              labelB="Diastolic"
            />
          ) : (
            <p className="text-sm text-text-muted text-center py-10">Log blood pressure to see trends.</p>
          )}
        </HealthChartCard>
        <HealthChartCard title="Sleep (14 days)" subtitle="Hours per night">
          {sleepSeries.length > 0 ? (
            <HealthBarChart
              labels={sleepLabels}
              values={sleepSeries.map((p) => p.value)}
              unit="hrs"
              color="#38bdf8"
            />
          ) : (
            <p className="text-sm text-text-muted text-center py-10">Log sleep hours to see bars.</p>
          )}
        </HealthChartCard>
      </div>

      <HealthChartCard title="Resting heart rate" subtitle="Latest readings">
        {hrReadings[0] ? (
          <p className="text-4xl font-bold text-text-primary tabular-nums">
            {formatHealthValue(hrReadings[0].value, hrReadings[0].unit)}
          </p>
        ) : (
          <p className="text-sm text-text-muted">No resting HR logged yet.</p>
        )}
      </HealthChartCard>

      <HealthChartCard title="Vitals log">
        <HealthRecentEntries
          readings={vitalsReadings}
          members={members}
          colorMap={colorMap}
          onDelete={onDeleteReading}
        />
      </HealthChartCard>
    </div>
  );
}