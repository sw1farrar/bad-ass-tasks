"use client";

import React, { useMemo } from "react";
import { computeLoggingStreak, memberColorMap, weekdayActivityTotals } from "@/lib/health/healthAggregates";
import { formatHealthValue } from "@/lib/health/healthMetrics";
import type { HealthReading, WorkspaceMember } from "@/types";
import { HealthBarChart, HealthChartCard } from "./HealthCharts";
import { HealthRecentEntries } from "./HealthRecentEntries";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface HealthActivityPanelProps {
  readings: HealthReading[];
  members: WorkspaceMember[];
  selectedMemberId: string | "all";
  onDeleteReading: (id: string) => void;
}

export function HealthActivityPanel({
  readings,
  members,
  selectedMemberId,
  onDeleteReading,
}: HealthActivityPanelProps) {
  const colorMap = useMemo(() => memberColorMap(members), [members]);

  const activityReadings = readings.filter(
    (r) =>
      ["steps", "active_minutes", "calories_burned"].includes(r.metricType) &&
      (selectedMemberId === "all" || r.userId === selectedMemberId),
  );

  const stepsReadings = activityReadings.filter((r) => r.metricType === "steps");
  const weekdaySteps = weekdayActivityTotals(stepsReadings);
  const streak = computeLoggingStreak(activityReadings);
  const latestSteps = stepsReadings[0];

  return (
    <div className="health-activity-panel space-y-4 p-3 md:p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HealthChartCard title="Today's steps" subtitle="Most recent entry">
          <p className="text-3xl font-bold text-text-primary tabular-nums">
            {latestSteps ? formatHealthValue(latestSteps.value, latestSteps.unit) : "—"}
          </p>
        </HealthChartCard>
        <HealthChartCard title="Logging streak" subtitle="Consecutive days with activity logged">
          <p className="text-3xl font-bold text-emerald-400 tabular-nums">{streak} days</p>
        </HealthChartCard>
        <HealthChartCard title="Active minutes" subtitle="Latest">
          <p className="text-3xl font-bold text-text-primary tabular-nums">
            {activityReadings.find((r) => r.metricType === "active_minutes")
              ? formatHealthValue(
                  activityReadings.find((r) => r.metricType === "active_minutes")!.value,
                  "min",
                )
              : "—"}
          </p>
        </HealthChartCard>
      </div>

      <HealthChartCard title="Steps by weekday" subtitle="Average steps per day of week">
        <HealthBarChart
          labels={WEEKDAY_LABELS}
          values={weekdaySteps}
          unit="count"
          color="#34d399"
        />
      </HealthChartCard>

      <HealthChartCard title="Activity log">
        <HealthRecentEntries
          readings={activityReadings}
          members={members}
          colorMap={colorMap}
          onDelete={onDeleteReading}
        />
      </HealthChartCard>
    </div>
  );
}