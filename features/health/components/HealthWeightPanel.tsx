"use client";

import React, { useMemo, useState } from "react";
import {
  buildDailySeries,
  computeBmi,
  computeGoalProgress,
  lbToKg,
} from "@/lib/health/healthAggregates";
import { formatHealthValue } from "@/lib/health/healthMetrics";
import type { HealthProfile, HealthReading } from "@/types";
import {
  HealthAreaChart,
  HealthChartCard,
  HealthRangePills,
} from "./HealthCharts";
import { HealthRecentEntries } from "./HealthRecentEntries";
import type { WorkspaceMember } from "@/types";
import { memberColorMap } from "@/lib/health/healthAggregates";

interface HealthWeightPanelProps {
  readings: HealthReading[];
  profiles: HealthProfile[];
  members: WorkspaceMember[];
  selectedMemberId: string | "all";
  currentUserId?: string;
  onDeleteReading: (id: string) => void;
  onUpdateProfile: (input: {
    heightCm?: number | null;
    weightGoal?: number | null;
    weightUnit?: string;
  }) => Promise<boolean>;
}

const RANGE_OPTIONS = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "All" },
];

export function HealthWeightPanel({
  readings,
  profiles,
  members,
  selectedMemberId,
  currentUserId,
  onDeleteReading,
  onUpdateProfile,
}: HealthWeightPanelProps) {
  const [rangeDays, setRangeDays] = useState(90);
  const [goalInput, setGoalInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const colorMap = useMemo(() => memberColorMap(members), [members]);

  const weightReadings = useMemo(
    () =>
      readings.filter(
        (r) =>
          r.metricType === "weight" &&
          (selectedMemberId === "all" || r.userId === selectedMemberId),
      ),
    [readings, selectedMemberId],
  );

  const series = buildDailySeries(weightReadings, rangeDays);
  const latest = weightReadings[0];
  const profileUserId =
    selectedMemberId !== "all" ? selectedMemberId : currentUserId ?? latest?.userId;
  const profile = profileUserId
    ? profiles.find((p) => p.userId === profileUserId)
    : null;

  const values = series.map((p) => p.value);
  const stats = values.length
    ? {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((s, v) => s + v, 0) / values.length,
        change: values.length > 1 ? values[values.length - 1] - values[0] : 0,
      }
    : null;

  const weightKg =
    latest?.unit === "kg" ? latest.value : latest ? lbToKg(latest.value) : null;
  const bmi =
    weightKg && profile?.heightCm ? computeBmi(weightKg, profile.heightCm) : null;

  const goalProgress = computeGoalProgress(
    latest?.value ?? null,
    profile?.weightGoal ?? null,
    weightReadings[weightReadings.length - 1]?.value,
  );

  const saveProfile = async () => {
    const goal = goalInput ? parseFloat(goalInput) : profile?.weightGoal ?? null;
    const heightCm = heightInput ? parseFloat(heightInput) : profile?.heightCm ?? null;
    await onUpdateProfile({
      weightGoal: goal,
      heightCm,
      weightUnit: latest?.unit ?? profile?.weightUnit ?? "lb",
    });
  };

  return (
    <div className="health-weight-panel space-y-4 p-3 md:p-4">
      <HealthChartCard
        title="Weight trend"
        subtitle={`${rangeDays === 365 ? "All time" : `Last ${rangeDays} days`} · shared workspace`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <HealthRangePills value={rangeDays} onChange={setRangeDays} options={RANGE_OPTIONS} />
          {stats ? (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3 text-[11px] text-text-muted tabular-nums">
              <span>Min {formatHealthValue(stats.min, latest?.unit ?? "lb")}</span>
              <span>Max {formatHealthValue(stats.max, latest?.unit ?? "lb")}</span>
              <span>Avg {formatHealthValue(stats.avg, latest?.unit ?? "lb")}</span>
              <span>
                Δ {stats.change >= 0 ? "+" : ""}
                {stats.change.toFixed(1)} {latest?.unit ?? "lb"}
              </span>
            </div>
          ) : null}
        </div>
        {series.length > 0 ? (
          <HealthAreaChart
            series={series}
            unit={latest?.unit ?? "lb"}
            goalLine={profile?.weightGoal ?? null}
            rangeLabel={`${rangeDays}d`}
          />
        ) : (
          <p className="text-sm text-text-muted text-center py-10">
            Log a weight to see your trend.
          </p>
        )}
      </HealthChartCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HealthChartCard title="BMI" subtitle={profile?.heightCm ? "From height + latest weight" : "Add height below"}>
          <p className="text-3xl font-bold text-text-primary tabular-nums">
            {bmi != null ? bmi.toFixed(1) : "—"}
          </p>
        </HealthChartCard>
        <HealthChartCard title="Goal progress" subtitle="Toward target weight">
          <p className="text-3xl font-bold text-neon-purple-tint tabular-nums">
            {goalProgress != null ? `${Math.round(goalProgress)}%` : "—"}
          </p>
        </HealthChartCard>
        <HealthChartCard title="Goals & height" subtitle="Per member in this workspace">
          <div className="space-y-2">
            <input
              type="number"
              step={0.1}
              inputMode="decimal"
              placeholder={`Goal (${profile?.weightUnit ?? "lb"})`}
              defaultValue={profile?.weightGoal ?? ""}
              onChange={(e) => setGoalInput(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-border-glass bg-bg px-3 py-2 text-base"
            />
            <input
              type="number"
              step={0.1}
              inputMode="decimal"
              placeholder="Height (cm)"
              defaultValue={profile?.heightCm ?? ""}
              onChange={(e) => setHeightInput(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-border-glass bg-bg px-3 py-2 text-base"
            />
            <button
              type="button"
              onClick={() => void saveProfile()}
              className="w-full min-h-[44px] rounded-lg text-sm font-semibold bg-neon-purple/15 text-neon-purple-tint border border-neon-purple/25"
            >
              Save profile
            </button>
          </div>
        </HealthChartCard>
      </div>

      <HealthChartCard title="Weight history">
        <HealthRecentEntries
          readings={weightReadings}
          members={members}
          colorMap={colorMap}
          onDelete={onDeleteReading}
        />
      </HealthChartCard>
    </div>
  );
}