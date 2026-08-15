import type { HealthMetricType, HealthReading, WorkspaceMember } from "@/types";
import { getHealthMetricDef } from "@/lib/health/healthMetrics";

const MEMBER_COLORS = [
  "var(--neon-purple)",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#fb7185",
];

export type TrendDelta = {
  value: number;
  unit: string;
  direction: "down" | "up" | "flat";
  label: string;
};

export type SparklinePoint = { date: string; value: number };

function sortNewestFirst(readings: HealthReading[]): HealthReading[] {
  return [...readings].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );
}

export function filterHealthReadings(
  readings: HealthReading[],
  opts?: {
    workspaceId?: string;
    userId?: string | "all";
    metricType?: HealthMetricType;
    since?: Date;
    until?: Date;
  },
): HealthReading[] {
  return readings.filter((r) => {
    if (opts?.workspaceId && r.workspaceId !== opts.workspaceId) return false;
    if (opts?.userId && opts.userId !== "all" && r.userId !== opts.userId) return false;
    if (opts?.metricType && r.metricType !== opts.metricType) return false;
    const at = new Date(r.recordedAt).getTime();
    if (opts?.since && at < opts.since.getTime()) return false;
    if (opts?.until && at > opts.until.getTime()) return false;
    return true;
  });
}

export function getLatestReading(
  readings: HealthReading[],
  metricType: HealthMetricType,
  userId?: string,
): HealthReading | null {
  const filtered = filterHealthReadings(readings, {
    metricType,
    userId: userId ?? "all",
  });
  return sortNewestFirst(filtered)[0] ?? null;
}

export function computeTrendDelta(
  latest: HealthReading | null,
  previous: HealthReading | null,
): TrendDelta | null {
  if (!latest) return null;
  const unit = latest.unit;
  if (!previous) {
    return { value: 0, unit, direction: "flat", label: "First entry" };
  }
  const delta = latest.value - previous.value;
  const def = getHealthMetricDef(latest.metricType);
  const lowerIsBetter =
    def.type === "weight" ||
    def.type === "body_fat" ||
    def.type === "waist" ||
    def.type === "stress";
  const direction = Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down";
  const sign = delta > 0 ? "+" : "";
  const label =
    direction === "flat"
      ? "No change"
      : `${sign}${delta.toFixed(1)} ${unit} since prior entry`;
  const sentiment =
    direction === "flat"
      ? "flat"
      : lowerIsBetter
        ? direction === "down"
          ? "good"
          : "warn"
        : direction === "up"
          ? "good"
          : "warn";
  return { value: delta, unit, direction, label: `${label}${sentiment === "good" && direction !== "flat" ? "" : ""}` };
}

export function buildSparklineSeries(
  readings: HealthReading[],
  days: number,
): SparklinePoint[] {
  const sorted = [...readings].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
  if (sorted.length === 0) return [];

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const buckets = new Map<string, number>();
  for (const r of sorted) {
    const d = new Date(r.recordedAt);
    if (d < start) continue;
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, r.value);
  }

  const points: SparklinePoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const value = buckets.get(key);
    if (value !== undefined) points.push({ date: key, value });
  }
  return points;
}

export function buildDailySeries(
  readings: HealthReading[],
  days: number,
): SparklinePoint[] {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const buckets = new Map<string, number[]>();
  for (const r of readings) {
    const d = new Date(r.recordedAt);
    if (d < start) continue;
    const key = d.toISOString().slice(0, 10);
    const list = buckets.get(key) ?? [];
    list.push(r.value);
    buckets.set(key, list);
  }

  const points: SparklinePoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const vals = buckets.get(key);
    if (vals?.length) {
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      points.push({ date: key, value: avg });
    }
  }
  return points;
}

export function computeBmi(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function lbToKg(lb: number): number {
  return lb * 0.453592;
}

export function kgToLb(kg: number): number {
  return kg / 0.453592;
}

export function memberColorMap(members: WorkspaceMember[]): Record<string, string> {
  const map: Record<string, string> = {};
  members.forEach((m, i) => {
    map[m.userId] = MEMBER_COLORS[i % MEMBER_COLORS.length];
  });
  return map;
}

export function computeGoalProgress(
  current: number | null,
  goal: number | null,
  start?: number | null,
): number | null {
  if (current == null || goal == null) return null;
  const baseline = start ?? current;
  const total = Math.abs(baseline - goal);
  if (total <= 0) return current === goal ? 100 : 0;
  const progressed = Math.abs(baseline - current);
  return Math.min(100, Math.max(0, (progressed / total) * 100));
}

export function computeLoggingStreak(readings: HealthReading[]): number {
  if (readings.length === 0) return 0;
  const days = new Set(
    readings.map((r) => new Date(r.recordedAt).toISOString().slice(0, 10)),
  );
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function weekdayActivityTotals(readings: HealthReading[]): number[] {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const r of readings) {
    const dow = new Date(r.recordedAt).getDay();
    totals[dow] += r.value;
    counts[dow] += 1;
  }
  return totals.map((t, i) => (counts[i] ? t / counts[i] : 0));
}