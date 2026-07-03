"use client";

import React, { useMemo } from "react";
import { getMemberDisplayName } from "@/lib/assignee";
import {
  buildDailySeries,
  buildSparklineSeries,
  computeGoalProgress,
  computeTrendDelta,
  memberColorMap,
} from "@/lib/health/healthAggregates";
import { formatHealthValue } from "@/lib/health/healthMetrics";
import type { HealthProfile, HealthReading, WorkspaceMember } from "@/types";
import {
  HealthChartCard,
  HealthGoalRing,
  HealthHeroCard,
  HealthSparklineGrid,
  HealthTeamStrip,
} from "./HealthCharts";
import { HealthRecentEntries } from "./HealthRecentEntries";

interface HealthOverviewPanelProps {
  readings: HealthReading[];
  profiles: HealthProfile[];
  members: WorkspaceMember[];
  selectedMemberId: string | "all";
  onDeleteReading: (id: string) => void;
}

export function HealthOverviewPanel({
  readings,
  profiles,
  members,
  selectedMemberId,
  onDeleteReading,
}: HealthOverviewPanelProps) {
  const colorMap = useMemo(() => memberColorMap(members), [members]);

  const weightReadings = readings.filter((r) => r.metricType === "weight");
  const latestWeight = weightReadings[0] ?? null;
  const priorWeight = weightReadings[1] ?? null;
  const delta = computeTrendDelta(latestWeight, priorWeight);

  const profile =
    latestWeight && selectedMemberId !== "all"
      ? profiles.find((p) => p.userId === selectedMemberId)
      : latestWeight
        ? profiles.find((p) => p.userId === latestWeight.userId)
        : null;

  const sparkWeight = buildSparklineSeries(
    weightReadings.filter((r) => selectedMemberId === "all" || r.userId === selectedMemberId),
    7,
  );

  const goalProgress = computeGoalProgress(
    latestWeight?.value ?? null,
    profile?.weightGoal ?? null,
    weightReadings[weightReadings.length - 1]?.value,
  );

  const teamRows = members
    .map((m) => {
      const latest = readings.find((r) => r.metricType === "weight" && r.userId === m.userId);
      if (!latest) return null;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const prior = readings.find(
        (r) =>
          r.metricType === "weight" &&
          r.userId === m.userId &&
          new Date(r.recordedAt) < weekAgo,
      );
      const change = prior ? latest.value - prior.value : 0;
      return {
        id: m.userId,
        label: getMemberDisplayName(m),
        value: latest.value,
        max: Math.max(...members.map((mm) => readings.find((r) => r.metricType === "weight" && r.userId === mm.userId)?.value ?? 0)),
        color: colorMap[m.userId],
        sublabel: `${formatHealthValue(latest.value, latest.unit)}${change ? ` (${change > 0 ? "+" : ""}${change.toFixed(1)})` : ""}`,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    label: string;
    value: number;
    max: number;
    color: string;
    sublabel?: string;
  }>;

  const gridCards = (["weight", "sleep_hours", "steps", "resting_hr"] as const).map((metric) => {
    const filtered = readings.filter(
      (r) =>
        r.metricType === metric &&
        (selectedMemberId === "all" || r.userId === selectedMemberId),
    );
    const latest = filtered[0];
    const series = buildDailySeries(filtered, 14);
    return {
      title: metric === "sleep_hours" ? "Sleep" : metric === "resting_hr" ? "Resting HR" : metric.charAt(0).toUpperCase() + metric.slice(1),
      value: latest ? formatHealthValue(latest.value, latest.unit) : "—",
      series,
    };
  });

  return (
    <div className="health-overview-panel space-y-4 p-3 md:p-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <HealthHeroCard
          label="Latest weight"
          value={latestWeight?.value ?? null}
          unit={latestWeight?.unit ?? "lb"}
          deltaLabel={delta?.label}
          deltaDirection={delta?.direction}
          sparkline={sparkWeight}
        />
        <HealthGoalRing
          progress={goalProgress}
          label="Weight goal"
          currentLabel={
            latestWeight
              ? `Current: ${formatHealthValue(latestWeight.value, latestWeight.unit)}`
              : "No weight logged"
          }
          goalLabel={
            profile?.weightGoal
              ? `Goal: ${formatHealthValue(profile.weightGoal, profile.weightUnit)}`
              : "Set a goal in Weight tab"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HealthChartCard title="14-day snapshot" subtitle="Key metrics at a glance">
          <HealthSparklineGrid cards={gridCards} />
        </HealthChartCard>
        {teamRows.length > 0 ? (
          <HealthChartCard title="Team weights" subtitle="Latest reading per member">
            <HealthTeamStrip rows={teamRows} />
          </HealthChartCard>
        ) : null}
      </div>

      <HealthChartCard title="Recent activity" subtitle="Shared workspace log">
        <HealthRecentEntries
          readings={readings}
          members={members}
          colorMap={colorMap}
          onDelete={onDeleteReading}
        />
      </HealthChartCard>
    </div>
  );
}